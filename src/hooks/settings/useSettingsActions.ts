import { useCallback } from "react";
import type {
  LocalTtsVoiceSelections,
  Provider,
  ResponseMode,
  ResponseModeRoute,
  Settings,
} from "../../types";
import {
  getDefaultAssistantInstructions,
  getDefaultTtsListenLanguages,
  isDefaultAssistantInstructions,
} from "../../types";
import { mergeSettings } from "./mergeStoredSettings";
import { persistApiKey, persistPublicSettings } from "./storage";
import type { SettingsUpdate } from "./types";

interface UseSettingsActionsParams {
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export function useSettingsActions({ setSettings }: UseSettingsActionsParams) {
  const updateSettings = useCallback((partial: SettingsUpdate) => {
    setSettings((prev) => {
      const nextLanguage = partial.language ?? prev.language;
      const shouldRefreshAssistantInstructions =
        partial.language &&
        partial.assistantInstructions === undefined &&
        isDefaultAssistantInstructions(prev.assistantInstructions);
      const nextTtsListenLanguages =
        partial.ttsListenLanguages ??
        (partial.language &&
        prev.ttsListenLanguages.join("|") ===
          getDefaultTtsListenLanguages(prev.language).join("|")
          ? getDefaultTtsListenLanguages(nextLanguage)
          : prev.ttsListenLanguages);

      const next = mergeSettings({
        ...prev,
        ...partial,
        ttsListenLanguages: nextTtsListenLanguages,
        assistantInstructions: shouldRefreshAssistantInstructions
          ? getDefaultAssistantInstructions(nextLanguage)
          : partial.assistantInstructions ?? prev.assistantInstructions,
        apiKeys: prev.apiKeys,
        providerModels: prev.providerModels,
        responseModes: partial.responseModes ?? prev.responseModes,
      });
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateProviderModel = useCallback((provider: Provider, value: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providerModels: {
          ...prev.providerModels,
          [provider]: value,
        },
      };
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateResponseModeRoute = useCallback(
    (mode: ResponseMode, value: ResponseModeRoute) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          responseModes: {
            ...prev.responseModes,
            [mode]: value,
          },
        };
        void persistPublicSettings(next);
        return next;
      });
    },
    [setSettings],
  );

  const updateActiveResponseMode = useCallback((value: ResponseMode) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        activeResponseMode: value,
      };
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateProviderTtsVoice = useCallback((provider: Provider, value: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providerTtsVoices: {
          ...prev.providerTtsVoices,
          [provider]: value,
        },
      };
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateProviderTtsModel = useCallback((provider: Provider, value: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providerTtsModels: {
          ...prev.providerTtsModels,
          [provider]: value,
        },
      };
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateProviderSttModel = useCallback((provider: Provider, value: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providerSttModels: {
          ...prev.providerSttModels,
          [provider]: value,
        },
      };
      void persistPublicSettings(next);
      return next;
    });
  }, [setSettings]);

  const updateLocalTtsVoice = useCallback(
    (language: keyof LocalTtsVoiceSelections, value: string) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          localTtsVoices: {
            ...prev.localTtsVoices,
            [language]: value,
          },
        };
        void persistPublicSettings(next);
        return next;
      });
    },
    [setSettings],
  );

  const updateApiKey = useCallback((provider: Provider, value: string) => {
    const nextValue = value.trim();

    setSettings((prev) => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: nextValue,
      },
    }));

    void persistApiKey(provider, nextValue);
  }, [setSettings]);

  return {
    updateSettings,
    updateProviderModel,
    updateProviderSttModel,
    updateProviderTtsModel,
    updateResponseModeRoute,
    updateActiveResponseMode,
    updateProviderTtsVoice,
    updateLocalTtsVoice,
    updateApiKey,
  };
}
