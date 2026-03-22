import { getMainScreenViewModel } from "../../../src/screens/main/mainScreenViewModel";
import {
  Conversation,
  DEFAULT_SETTINGS,
  Settings,
} from "../../../src/types";

function t(key: any, params?: Record<string, string | number | undefined>) {
  if (key === "messageCount") {
    return `${params?.count ?? 0} messages`;
  }

  if (params?.route) {
    return `${String(key)}:${params.route}`;
  }

  return String(key);
}

describe("getMainScreenViewModel", () => {
  it("builds local and fallback route labels plus streaming transcript state", () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      activeResponseMode: "quick",
      responseModes: {
        ...DEFAULT_SETTINGS.responseModes,
        quick: { provider: "openai", model: "gpt-5.4" },
      },
      sttMode: "provider",
      sttProvider: "openai",
      providerSttModels: {
        ...DEFAULT_SETTINGS.providerSttModels,
        openai: "gpt-4o-mini-transcribe",
      },
      ttsMode: "local",
      ttsProvider: "openai",
      providerTtsModels: {
        ...DEFAULT_SETTINGS.providerTtsModels,
        openai: "gpt-4o-mini-tts",
      },
      providerTtsVoices: {
        ...DEFAULT_SETTINGS.providerTtsVoices,
        openai: "alloy",
      },
      ttsListenLanguages: ["en", "de"],
      showUsageStats: true,
    };
    const conversation: Conversation = {
      id: "conv-1",
      title: "Planning",
      createdAt: "2026-03-20T08:00:00.000Z",
      updatedAt: "2026-03-20T08:05:00.000Z",
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "Stored reply",
          provider: "openai",
          model: "gpt-5.4",
          timestamp: "2026-03-20T08:01:00.000Z",
        },
      ],
    };

    const viewModel = getMainScreenViewModel({
      activeConversation: conversation,
      availableTtsProviders: ["openai"],
      isRecording: false,
      language: "en",
      localTtsPackStates: {
        en: {
          supported: true,
          downloaded: true,
          verified: true,
        },
        de: {
          supported: true,
          downloaded: false,
          verified: false,
        },
      },
      model: "gpt-5.4",
      pipelinePhase: "thinking",
      player: {
        isPlaying: false,
        meteringData: -160,
        waveformData: undefined,
        waveformVariant: "bars",
      },
      provider: "openai",
      recordingMetering: -10,
      recordingLevels: [0.2, 0.3],
      recordingWaveformVariant: "oscilloscope",
      selectedSttModel: "gpt-4o-mini-transcribe",
      selectedTtsModel: "gpt-4o-mini-tts",
      selectedTtsVoice: "alloy",
      settings,
      streamingText: "Streaming reply",
      sttProvider: "openai",
      t,
      ttsApiKey: "sk-test",
      ttsProvider: "openai",
    });

    expect(viewModel.visualPhase).toBe("thinking");
    expect(viewModel.isActive).toBe(true);
    expect(viewModel.messages).toHaveLength(2);
    expect(viewModel.lastAssistantReply).toBe("Stored reply");
    expect(viewModel.sttStatusLabel).toContain("OpenAI");
    expect(viewModel.ttsStatusLabel).toContain("localTts");
    expect(viewModel.fallbackTtsStatusLabel).toContain("OpenAI");
    expect(viewModel.routeModelLabel).toContain("GPT-5.4");
    expect(viewModel.activeConversationTitle).toBe("Planning");
  });
});
