import { act, renderHook } from "@testing-library/react-native";

import { translate } from "../../src/i18n";
import { useVoicePipeline } from "../../src/hooks/useVoicePipeline";
import { DEFAULT_SETTINGS, type UsageEstimate } from "../../src/types";

jest.mock("../../src/services/voicePipeline", () => ({
  runVoicePipeline: jest.fn(),
}));

jest.mock("../../src/services/tts", () => ({
  synthesizeSpeechSequence: jest.fn(),
}));

jest.mock("../../src/services/speech/diagnostics", () => ({
  createSpeechRequestId: jest.fn(() => "speech-request-1"),
}));

import { runVoicePipeline } from "../../src/services/voicePipeline";
import { synthesizeSpeechSequence } from "../../src/services/tts";

function createPlayer(overrides: Partial<ReturnType<typeof createPlayerBase>> = {}) {
  return {
    ...createPlayerBase(),
    ...overrides,
  };
}

function createPlayerBase() {
  return {
    isPlaying: false,
    stopPlayback: jest.fn(async () => undefined),
    resetCancellation: jest.fn(),
    waitForDrain: jest.fn(async () => undefined),
    enqueueAudio: jest.fn(),
    speakText: jest.fn(),
    hasPendingPlaybackNow: jest.fn(() => false),
  };
}

function createParams(
  overrides: Partial<Parameters<typeof useVoicePipeline>[0]> = {},
) {
  const player = createPlayer();
  return {
    activeConversation: null,
    addMessage: jest.fn(),
    createConversation: jest.fn(),
    updateConversationContextSummary: jest.fn(),
    player,
    provider: "openai" as const,
    providerApiKey: "sk-test",
    model: "gpt-5.4",
    sttMode: "native" as const,
    sttProvider: null,
    sttApiKey: "",
    selectedSttModel: "",
    ttsMode: "provider" as const,
    ttsProvider: "openai" as const,
    ttsApiKey: "sk-tts",
    selectedTtsModel: "gpt-4o-mini-tts",
    selectedTtsVoice: "alloy",
    ttsListenLanguages: DEFAULT_SETTINGS.ttsListenLanguages,
    localTtsVoices: DEFAULT_SETTINGS.localTtsVoices,
    replyPlayback: DEFAULT_SETTINGS.replyPlayback,
    assistantInstructions: DEFAULT_SETTINGS.assistantInstructions,
    responseLength: DEFAULT_SETTINGS.responseLength,
    responseTone: DEFAULT_SETTINGS.responseTone,
    language: "en" as const,
    isRecording: false,
    showToast: jest.fn(),
    t: (
      key: Parameters<typeof translate>[1],
      params?: Record<string, string | number | undefined>,
    ) => translate("en", key, params),
    ...overrides,
  };
}

describe("useVoicePipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("shows a toast when there is no reply to replay yet", async () => {
    const params = createParams();
    const { result } = renderHook(() => useVoicePipeline(params));

    await act(async () => {
      await result.current.handleRepeatLastReply();
    });

    expect(params.showToast).toHaveBeenCalledWith(
      translate("en", "noReplyToRepeatYet"),
    );
  });

  it("falls back to native speech when replay synthesis fails", async () => {
    const params = createParams({
      ttsMode: "local",
      player: createPlayer(),
    });
    (synthesizeSpeechSequence as jest.Mock).mockRejectedValue(
      new Error("Local TTS unavailable"),
    );

    const { result } = renderHook(() => useVoicePipeline(params));

    await act(async () => {
      await result.current.playReplyText("Replay this", "message-1");
    });

    expect(params.player.speakText).toHaveBeenCalledWith(
      "Replay this",
      expect.objectContaining({
        diagnostics: expect.objectContaining({
          requestId: "speech-request-1",
          source: "repeat",
        }),
      }),
    );
    expect(params.showToast).toHaveBeenCalledWith(
      translate("en", "localVoiceFallback"),
    );
    expect(result.current.replayPhase).toBe("idle");
    expect(result.current.activeReplayMessageId).toBeNull();
  });

  it("runs the full voice pipeline and updates conversation state", async () => {
    const params = createParams();
    const summaryUsage: UsageEstimate = {
      kind: "summary",
      source: "estimated",
      promptTokens: 90,
      completionTokens: 12,
      totalTokens: 102,
      inputCostUsd: 0.0001,
      outputCostUsd: 0.0002,
      totalCostUsd: 0.0003,
    };
    const replyUsage: UsageEstimate = {
      kind: "reply",
      source: "estimated",
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
      inputCostUsd: 0.0002,
      outputCostUsd: 0.0003,
      totalCostUsd: 0.0005,
    };
    (runVoicePipeline as jest.Mock).mockImplementation(
      async ({ callbacks }: any) => {
        callbacks.onTranscription("Hello from the microphone");
        callbacks.onContextSummary("Conversation summary", 3, summaryUsage);
        callbacks.onChunk("Streaming ");
        callbacks.onChunk("reply");
        callbacks.onResponseDone("Completed reply", replyUsage);
        callbacks.onAudioReady("file://reply.wav", {
          requestId: "speech-request-1",
          source: "conversation",
        });
        return "Hello from the microphone";
      },
    );

    const { result } = renderHook(() => useVoicePipeline(params));

    await act(async () => {
      const pending = result.current.handleVoiceCaptureDone({
        audioUri: "file://capture.wav",
      });
      jest.runAllTimers();
      await pending;
    });

    expect(params.createConversation).toHaveBeenCalledWith(
      "Hello from the microphone",
      "gpt-5.4",
      "openai",
    );
    expect(params.addMessage).toHaveBeenCalledWith({
      role: "user",
      content: "Hello from the microphone",
      model: null,
      provider: null,
    });
    expect(params.addMessage).toHaveBeenCalledWith({
      role: "assistant",
      content: "Completed reply",
      model: "gpt-5.4",
      provider: "openai",
      usage: replyUsage,
    });
    expect(params.updateConversationContextSummary).toHaveBeenCalledWith(
      "Conversation summary",
      3,
      summaryUsage,
      "gpt-5.4",
      "openai",
    );
    expect(params.player.enqueueAudio).toHaveBeenCalledWith(
      "file://reply.wav",
      {
        requestId: "speech-request-1",
        source: "conversation",
      },
    );
    expect(result.current.pipelinePhase).toBe("idle");
    expect(result.current.streamingText).toBe("");
    expect(result.current.lastCompletedReplyRef.current).toBe("Completed reply");
  });

  it("shows the retry toast when no transcription is produced", async () => {
    const params = createParams();
    (runVoicePipeline as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useVoicePipeline(params));

    await act(async () => {
      await result.current.handleVoiceCaptureDone({
        audioUri: "file://capture.wav",
      });
    });

    expect(params.showToast).toHaveBeenCalledWith(
      translate("en", "couldntCatchThatTryAgain"),
    );
    expect(result.current.pipelinePhase).toBe("idle");
  });
});
