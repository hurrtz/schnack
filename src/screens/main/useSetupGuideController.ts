import { useCallback, useEffect } from "react";

import { Provider, Settings } from "../../types";

interface UseSetupGuideControllerParams {
  loaded: boolean;
  openSettings: (focusProvider?: Provider) => void;
  setSetupGuideVisible: (visible: boolean) => void;
  setupGuideDismissed: boolean;
  updateSettings: (partial: Partial<Settings>) => void;
}

export function useSetupGuideController({
  loaded,
  openSettings,
  setSetupGuideVisible,
  setupGuideDismissed,
  updateSettings,
}: UseSetupGuideControllerParams) {
  useEffect(() => {
    if (!loaded) {
      return;
    }

    setSetupGuideVisible(!setupGuideDismissed);
  }, [loaded, setSetupGuideVisible, setupGuideDismissed]);

  const handleDismissSetupGuide = useCallback(() => {
    setSetupGuideVisible(false);
    updateSettings({ setupGuideDismissed: true });
  }, [setSetupGuideVisible, updateSettings]);

  const handleChooseSetupPreset = useCallback(
    (preset: "fastest" | "full-voice") => {
      if (preset === "fastest") {
        updateSettings({
          activeResponseMode: "quick",
          responseModes: {
            quick: {
              provider: "groq",
              model: "llama-3.1-8b-instant",
            },
            normal: {
              provider: "groq",
              model: "llama-3.1-8b-instant",
            },
            deep: {
              provider: "groq",
              model: "llama-3.3-70b-versatile",
            },
          },
          setupGuideDismissed: true,
          lastProvider: "groq",
          sttMode: "native",
          sttProvider: null,
          ttsMode: "native",
          ttsProvider: null,
        });
        setSetupGuideVisible(false);
        openSettings("groq");
        return;
      }

      updateSettings({
        activeResponseMode: "normal",
        responseModes: {
          quick: {
            provider: "openai",
            model: "gpt-5-mini",
          },
          normal: {
            provider: "openai",
            model: "gpt-5.4",
          },
          deep: {
            provider: "openai",
            model: "gpt-5.4",
          },
        },
        setupGuideDismissed: true,
        lastProvider: "openai",
        sttMode: "provider",
        sttProvider: "openai",
        ttsMode: "provider",
        ttsProvider: "openai",
      });
      setSetupGuideVisible(false);
      openSettings("openai");
    },
    [openSettings, setSetupGuideVisible, updateSettings],
  );

  return {
    handleDismissSetupGuide,
    handleChooseSetupPreset,
  };
}
