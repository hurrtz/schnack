import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import { SettingsModal } from "../../src/components/SettingsModal";
import { LocalizationProvider } from "../../src/i18n";
import { ThemeProvider } from "../../src/theme/ThemeContext";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name }: { name: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, name);
  },
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
    Easing: {
      out: (value: unknown) => value,
      ease: "ease",
    },
  };
});

jest.mock("expo-speech", () => ({
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../src/hooks/useSpeechDiagnostics", () => ({
  useSpeechDiagnostics: jest.fn(() => []),
}));

function renderSettingsModal(overrideProps: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  return render(
    <ThemeProvider mode="light">
      <LocalizationProvider language="en">
        <SettingsModal
          visible
          settings={DEFAULT_SETTINGS}
          onUpdate={jest.fn()}
          onUpdateResponseModeRoute={jest.fn()}
          onUpdateProviderSttModel={jest.fn()}
          onUpdateProviderTtsModel={jest.fn()}
          onUpdateProviderTtsVoice={jest.fn()}
          onUpdateLocalTtsVoice={jest.fn()}
          onUpdateApiKey={jest.fn()}
          localTtsPackStates={{}}
          onInstallLocalTtsLanguagePack={jest.fn(async () => undefined)}
          onPreviewVoice={jest.fn(async () => undefined)}
          onStopPreviewVoice={jest.fn(async () => undefined)}
          onValidateProvider={jest.fn(async () => undefined)}
          onClose={jest.fn()}
          {...overrideProps}
        />
      </LocalizationProvider>
    </ThemeProvider>,
  );
}

describe("SettingsModal", () => {
  it("renders the modal shell and default tab controls", () => {
    const screen = renderSettingsModal();

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Instructions")).toBeTruthy();
    expect(screen.getByText("Providers")).toBeTruthy();
    expect(screen.getByText("STT")).toBeTruthy();
    expect(screen.getByText("TTS")).toBeTruthy();
    expect(screen.getByText("UI")).toBeTruthy();
  });

  it("opens the providers tab when a focus provider is supplied", async () => {
    const screen = renderSettingsModal({ focusProvider: "openai" });

    await waitFor(() => {
      expect(screen.getByText("Create API key")).toBeTruthy();
    });
  });
});
