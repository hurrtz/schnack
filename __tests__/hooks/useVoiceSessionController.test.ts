import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useVoiceSessionController } from "../../src/screens/main/useVoiceSessionController";

const mockReleaseLocalTtsResources = jest.fn(async () => undefined);

jest.mock("../../src/services/localTts", () => ({
  releaseLocalTtsResources: () => mockReleaseLocalTtsResources(),
}));

describe("useVoiceSessionController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderController(
    overrides: Partial<
      Parameters<typeof useVoiceSessionController<{ id: string }>>[0]
    > = {},
  ) {
    const params = {
      abortRef: { current: null as AbortController | null },
      availableSttProviders: ["openai"],
      availableTtsProviders: ["openai"],
      captureActiveConversationSnapshot: jest.fn(() => ({ id: "snapshot" })),
      handleVoiceCaptureDone: jest.fn(async () => undefined),
      isBusy: false,
      isRecording: false,
      lastCompletedReplyRef: { current: "" },
      nativeStt: {
        abortRecognition: jest.fn(async () => undefined),
        clearLastError: jest.fn(),
        isAvailable: true,
        lastError: null,
        startRecognition: jest.fn(async () => undefined),
        stopRecognition: jest.fn(async () => null),
      },
      player: {
        isPlaying: false,
        stopPlayback: jest.fn(async () => undefined),
        waitForPlaybackRouteSettle: jest.fn(async () => undefined),
      },
      providerApiKey: "provider-key",
      providerLabel: "OpenAI",
      recorder: {
        clearLastError: jest.fn(),
        lastError: null,
        startRecording: jest.fn(async () => undefined),
        stopRecording: jest.fn(async () => "file://voice.m4a"),
      },
      restoreActiveConversationSnapshot: jest.fn(async () => undefined),
      setPipelinePhase: jest.fn(),
      setStreamingText: jest.fn(),
      settings: {
        sttMode: "provider" as const,
        ttsMode: "provider" as const,
      },
      showToast: jest.fn(),
      sttApiKey: "stt-key",
      sttProvider: "openai" as const,
      t: (key, params) =>
        ({
          addProviderKeyToUseProvider: `missing ${params?.provider}`,
          couldntProcessVoiceInput: "process failed",
          couldntStartVoiceInput: "start failed",
        }[key] ?? key),
      ttsApiKey: "tts-key",
      ttsProvider: "openai" as const,
      ...overrides,
    };

    const hook = renderHook(() => useVoiceSessionController(params));
    return { ...hook, params };
  }

  it("shows a toast instead of starting when the provider key is missing", async () => {
    const { result, params } = renderController({ providerApiKey: "" });

    await act(async () => {
      await result.current.handlePressIn();
    });

    expect(params.showToast).toHaveBeenCalledWith("missing OpenAI");
    expect(params.recorder.startRecording).not.toHaveBeenCalled();
  });

  it("starts recording when idle and all routes are ready", async () => {
    const { result, params } = renderController();

    await act(async () => {
      await result.current.handleTogglePress();
    });

    expect(params.player.waitForPlaybackRouteSettle).toHaveBeenCalledTimes(1);
    expect(params.recorder.startRecording).toHaveBeenCalledTimes(1);
  });

  it("processes a completed recording through the voice pipeline", async () => {
    const { result, params } = renderController({ isRecording: true });

    await act(async () => {
      await result.current.handleTogglePress();
    });

    await waitFor(() => {
      expect(params.recorder.stopRecording).toHaveBeenCalledTimes(1);
      expect(params.captureActiveConversationSnapshot).toHaveBeenCalledTimes(1);
      expect(params.handleVoiceCaptureDone).toHaveBeenCalledWith({
        audioUri: "file://voice.m4a",
      });
    });
  });
});
