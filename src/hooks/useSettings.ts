import { useEffect, useState } from "react";
import { type Settings, DEFAULT_SETTINGS } from "../types";
import { mergeSettings } from "./settings/mergeStoredSettings";
import {
  persistPublicSettings,
  loadStoredSettingsSnapshot,
  persistNormalizedPublicSettings,
  toPublicSettings,
} from "./settings/storage";
import { useSettingsActions } from "./settings/useSettingsActions";
import { reportPersistenceAlert } from "../services/persistenceAlerts";
import {
  ensureRuntimeCapabilityOverridesLoaded,
  subscribeToRuntimeCapabilityOverrides,
} from "../services/runtimeCapabilityOverrides";
import { removeRetiredLocalLlmArtifacts } from "../services/localModelManager";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    void Promise.all([
      loadStoredSettingsSnapshot(),
      ensureRuntimeCapabilityOverridesLoaded(),
      removeRetiredLocalLlmArtifacts().catch((error) => {
        console.warn("[local-models] failed to remove retired LLM artifacts", error);
      }),
    ])
      .then(async ([{ storedSettings, apiKeys, publicSettingsCorrupt }]) => {
        if (!mounted) {
          return;
        }

        const normalizedSettings = mergeSettings(storedSettings, apiKeys);
        setSettings(normalizedSettings);
        if (publicSettingsCorrupt) {
          return;
        }
        await persistNormalizedPublicSettings(
          storedSettings,
          normalizedSettings,
        );
      })
      .catch((error) => {
        console.error("[settings-storage] failed to load settings", error);
        reportPersistenceAlert("settings", "load");
      })
      .finally(() => {
        if (mounted) {
          setLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => {
      if (!loaded) {
        return;
      }

      return subscribeToRuntimeCapabilityOverrides(() => {
        setSettings((current) => {
          const normalized = mergeSettings(
            toPublicSettings(current),
            current.apiKeys,
          );

          if (
            JSON.stringify(toPublicSettings(normalized)) ===
            JSON.stringify(toPublicSettings(current))
          ) {
            return current;
          }

          void persistPublicSettings(normalized);
          return normalized;
        });
      });
    },
    [loaded],
  );

  const {
    updateSettings,
    updateProviderModel,
    updateProviderSttModel,
    updateProviderTtsModel,
    updateResponseModeRoute,
    addResponseMode,
    removeResponseMode,
    updateActiveResponseMode,
    updateProviderTtsVoice,
    updateApiKey,
    updateProviderValidationResult,
    restorePortableSettings,
  } = useSettingsActions({ setSettings });

  return {
    settings,
    updateSettings,
    updateProviderModel,
    updateProviderSttModel,
    updateProviderTtsModel,
    updateResponseModeRoute,
    addResponseMode,
    removeResponseMode,
    updateActiveResponseMode,
    updateProviderTtsVoice,
    updateApiKey,
    updateProviderValidationResult,
    restorePortableSettings,
    loaded,
  };
}
