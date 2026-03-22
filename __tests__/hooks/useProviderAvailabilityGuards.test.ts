import { renderHook, waitFor } from "@testing-library/react-native";

import { useProviderAvailabilityGuards } from "../../src/screens/main/useProviderAvailabilityGuards";
import { DEFAULT_SETTINGS } from "../../src/types";

describe("useProviderAvailabilityGuards", () => {
  it("switches to the first ready response mode when the active provider has no key", async () => {
    const updateActiveResponseMode = jest.fn();

    renderHook(() =>
      useProviderAvailabilityGuards({
        activeResponseMode: "normal",
        availableResponseModes: ["quick", "deep"],
        availableSttProviders: ["openai"],
        availableTtsProviders: ["openai"],
        loaded: true,
        providerApiKey: "",
        settings: DEFAULT_SETTINGS,
        sttProvider: DEFAULT_SETTINGS.sttProvider,
        ttsProvider: DEFAULT_SETTINGS.ttsProvider,
        updateActiveResponseMode,
        updateSettings: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(updateActiveResponseMode).toHaveBeenCalledWith("quick");
    });
  });

  it("repairs unavailable STT and TTS provider selections", async () => {
    const updateSettings = jest.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      sttMode: "provider" as const,
      sttProvider: "openai" as const,
      ttsMode: "provider" as const,
      ttsProvider: "openai" as const,
    };

    renderHook(() =>
      useProviderAvailabilityGuards({
        activeResponseMode: "normal",
        availableResponseModes: ["normal"],
        availableSttProviders: ["groq"],
        availableTtsProviders: ["xai"],
        loaded: true,
        providerApiKey: "key",
        settings,
        sttProvider: "openai",
        ttsProvider: "openai",
        updateActiveResponseMode: jest.fn(),
        updateSettings,
      }),
    );

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ sttProvider: "groq" });
      expect(updateSettings).toHaveBeenCalledWith({ ttsProvider: "xai" });
    });
  });
});
