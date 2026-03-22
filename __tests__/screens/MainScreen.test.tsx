import React from "react";
import { fireEvent } from "@testing-library/react-native";

import { MainScreen } from "../../src/screens/MainScreen";
import { renderWithProviders } from "../test-utils/renderWithProviders";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("../../src/context/SettingsContext", () => ({
  useSharedSettings: jest.fn(() => ({
    settings: require("../../src/types").DEFAULT_SETTINGS,
    updateSettings: jest.fn(),
    updateActiveResponseMode: jest.fn(),
    updateResponseModeRoute: jest.fn(),
    updateProviderSttModel: jest.fn(),
    updateProviderTtsModel: jest.fn(),
    updateProviderTtsVoice: jest.fn(),
    updateLocalTtsVoice: jest.fn(),
    updateApiKey: jest.fn(),
    loaded: true,
  })),
}));

jest.mock("../../src/hooks/useConversations", () => ({
  useConversations: jest.fn(() => ({
    conversations: [],
    activeConversation: null,
    createConversation: jest.fn(),
    selectConversation: jest.fn(),
    getConversationById: jest.fn(),
    addMessage: jest.fn(),
    updateConversationContextSummary: jest.fn(),
    clearConversationMemory: jest.fn(),
    renameConversation: jest.fn(),
    toggleConversationPinned: jest.fn(),
    searchConversations: jest.fn(async () => []),
    deleteConversation: jest.fn(),
    clearActiveConversation: jest.fn(),
    captureActiveConversationSnapshot: jest.fn(),
    restoreActiveConversationSnapshot: jest.fn(),
  })),
}));

jest.mock("../../src/hooks/useAudioRecorder", () => ({
  useAudioRecorder: jest.fn(() => ({
    isRecording: false,
    meteringData: -160,
    waveformData: undefined,
    waveformVariant: "bars",
  })),
}));

jest.mock("../../src/hooks/useNativeSpeechRecognizer", () => ({
  useNativeSpeechRecognizer: jest.fn(() => ({
    isRecording: false,
    meteringData: -160,
    waveformData: undefined,
    waveformVariant: "bars",
  })),
}));

jest.mock("../../src/hooks/useAudioPlayer", () => ({
  useAudioPlayer: jest.fn(() => ({
    isPlaying: false,
    meteringData: -160,
    waveformData: undefined,
    waveformVariant: "bars",
  })),
}));

jest.mock("../../src/hooks/useLocalTtsPacks", () => ({
  useLocalTtsPacks: jest.fn(() => ({
    packStates: {},
    installLanguagePack: jest.fn(async () => undefined),
    refreshPackStates: jest.fn(async () => undefined),
  })),
}));

jest.mock("../../src/hooks/useVoicePipeline", () => ({
  useVoicePipeline: jest.fn(() => ({
    pipelinePhase: "idle",
    setPipelinePhase: jest.fn(),
    streamingText: "",
    setStreamingText: jest.fn(),
    abortRef: { current: null },
    lastCompletedReplyRef: { current: "" },
    replayPhase: "idle",
    activeReplayMessageId: null,
    handleRepeatLastReply: jest.fn(async () => undefined),
    stopReplay: jest.fn(async () => undefined),
    handleVoiceCaptureDone: jest.fn(async () => undefined),
  })),
}));

jest.mock("../../src/services/llm", () => ({
  validateProviderConnection: jest.fn(async () => undefined),
}));

jest.mock("../../src/screens/main/MainScreenTopBar", () => ({
  MainScreenTopBar: ({
    onOpenDrawer,
    onOpenSettings,
  }: {
    onOpenDrawer: () => void;
    onOpenSettings: () => void;
  }) => {
    const React = require("react");
    const { Text, TouchableOpacity, View } = require("react-native");

    return React.createElement(
      View,
      null,
      React.createElement(
        TouchableOpacity,
        { onPress: onOpenDrawer },
        React.createElement(Text, null, "open-drawer"),
      ),
      React.createElement(
        TouchableOpacity,
        { onPress: onOpenSettings },
        React.createElement(Text, null, "open-settings"),
      ),
    );
  },
}));

jest.mock("../../src/screens/main/MainScreenRouteCard", () => ({
  MainScreenRouteCard: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "route-card");
  },
}));

jest.mock("../../src/screens/main/MainScreenVoiceStage", () => ({
  MainScreenVoiceStage: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "voice-stage");
  },
}));

jest.mock("../../src/screens/main/TranscriptPreviewCard", () => ({
  TranscriptPreviewCard: () => null,
}));

jest.mock("../../src/screens/main/StatusDetailsModal", () => ({
  StatusDetailsModal: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "status:open" : "status:closed");
  },
}));

jest.mock("../../src/screens/main/TranscriptModal", () => ({
  TranscriptModal: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "transcript:open" : "transcript:closed");
  },
}));

jest.mock("../../src/components/SettingsModal", () => ({
  SettingsModal: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "settings:open" : "settings:closed");
  },
}));

jest.mock("../../src/components/SetupGuideModal", () => ({
  SetupGuideModal: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "setup:open" : "setup:closed");
  },
}));

jest.mock("../../src/components/ConversationMemoryModal", () => ({
  ConversationMemoryModal: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "memory:open" : "memory:closed");
  },
}));

jest.mock("../../src/components/ConversationDrawer", () => ({
  ConversationDrawer: ({ visible }: { visible: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, visible ? "drawer:open" : "drawer:closed");
  },
}));

jest.mock("../../src/components/Toast", () => ({
  Toast: () => null,
}));

jest.mock("../../src/screens/main/useProviderAvailabilityGuards", () => ({
  useProviderAvailabilityGuards: jest.fn(),
}));

jest.mock("../../src/screens/main/useSetupGuideController", () => ({
  useSetupGuideController: jest.fn(() => ({
    handleDismissSetupGuide: jest.fn(),
    handleChooseSetupPreset: jest.fn(),
  })),
}));

jest.mock("../../src/screens/main/useVoiceSessionController", () => ({
  useVoiceSessionController: jest.fn(() => ({
    handlePressIn: jest.fn(),
    handlePressOut: jest.fn(),
    handleTogglePress: jest.fn(),
    resetVoiceSessionState: jest.fn(),
  })),
}));

jest.mock("../../src/screens/main/useConversationActions", () => ({
  useConversationActions: jest.fn(() => ({
    handleCopyMessage: jest.fn(),
    handleCopyThread: jest.fn(),
    handleShareThread: jest.fn(),
    handleShareMessage: jest.fn(),
    handleRenameThread: jest.fn(),
    handleTogglePinned: jest.fn(),
    handleSelectConversation: jest.fn(),
    handleStartNewSession: jest.fn(),
    openMemory: jest.fn(),
    handleCopyMemory: jest.fn(),
    handleClearMemory: jest.fn(),
  })),
}));

jest.mock("../../src/screens/main/usePreviewVoiceController", () => ({
  usePreviewVoiceController: jest.fn(() => ({
    handlePreviewVoice: jest.fn(async () => undefined),
    stopPreviewVoice: jest.fn(async () => undefined),
  })),
}));

describe("MainScreen", () => {
  it("renders the shell with the route card", () => {
    const screen = renderWithProviders(<MainScreen />);

    expect(screen.getByText("route-card")).toBeTruthy();
    expect(screen.getByText("voice-stage")).toBeTruthy();
    expect(screen.getByText("settings:closed")).toBeTruthy();
    expect(screen.getByText("drawer:closed")).toBeTruthy();
  });

  it("opens settings and the drawer from the top bar", () => {
    const screen = renderWithProviders(<MainScreen />);

    fireEvent.press(screen.getByText("open-settings"));
    fireEvent.press(screen.getByText("open-drawer"));

    expect(screen.getByText("settings:open")).toBeTruthy();
    expect(screen.getByText("drawer:open")).toBeTruthy();
  });
});
