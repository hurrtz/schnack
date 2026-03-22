import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSetupGuideController } from "../../src/screens/main/useSetupGuideController";

describe("useSetupGuideController", () => {
  it("shows the setup guide once settings are loaded and not dismissed", async () => {
    const setSetupGuideVisible = jest.fn();

    renderHook(() =>
      useSetupGuideController({
        loaded: true,
        openSettings: jest.fn(),
        setSetupGuideVisible,
        setupGuideDismissed: false,
        updateSettings: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(setSetupGuideVisible).toHaveBeenCalledWith(true);
    });
  });

  it("applies the fastest preset and focuses Groq settings", () => {
    const openSettings = jest.fn();
    const setSetupGuideVisible = jest.fn();
    const updateSettings = jest.fn();
    const { result } = renderHook(() =>
      useSetupGuideController({
        loaded: true,
        openSettings,
        setSetupGuideVisible,
        setupGuideDismissed: false,
        updateSettings,
      }),
    );

    act(() => {
      result.current.handleChooseSetupPreset("fastest");
    });

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        activeResponseMode: "quick",
        lastProvider: "groq",
        sttMode: "native",
        ttsMode: "native",
      }),
    );
    expect(setSetupGuideVisible).toHaveBeenCalledWith(false);
    expect(openSettings).toHaveBeenCalledWith("groq");
  });
});
