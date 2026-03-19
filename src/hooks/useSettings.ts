import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PROVIDER_ORDER } from "../constants/models";
import {
  LocalTtsVoiceSelections,
  Provider,
  ProviderApiKeys,
  ProviderModelSelections,
  ProviderTtsVoiceSelections,
  ReplyPlayback,
  ResponseMode,
  ResponseModeRoute,
  ResponseModeSelections,
  Settings,
  DEFAULT_SETTINGS,
  getDefaultTtsListenLanguages,
  getDefaultAssistantInstructions,
  isDefaultAssistantInstructions,
} from "../types";
import {
  getDefaultModelForProvider,
  isValidModelForProvider,
  RESPONSE_MODE_ORDER,
} from "../utils/responseModes";

const STORAGE_KEY = "@schnackai/settings";
const API_KEY_STORAGE_PREFIX = "schnackai.provider_key";

type PublicSettings = Omit<Settings, "apiKeys">;
type SettingsUpdate = Partial<Omit<Settings, "apiKeys" | "providerModels">>;

type LegacyStoredSettings = Partial<Settings> & {
  ttsPlayback?: ReplyPlayback;
  ttsVoice?: string;
  openaiModel?: string;
  anthropicModel?: string;
  geminiModel?: string;
  cohereModel?: string;
  deepseekModel?: string;
  groqModel?: string;
  mistralModel?: string;
  nvidiaModel?: string;
  togetherModel?: string;
  xaiModel?: string;
};

const LEGACY_MODEL_FIELD_KEYS: Record<Provider, keyof LegacyStoredSettings> = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  gemini: "geminiModel",
  cohere: "cohereModel",
  deepseek: "deepseekModel",
  groq: "groqModel",
  mistral: "mistralModel",
  nvidia: "nvidiaModel",
  together: "togetherModel",
  xai: "xaiModel",
};

function getApiKeyStorageKey(provider: Provider) {
  const safeProvider = provider.replace(/[^0-9A-Za-z._-]/g, "_");
  return `${API_KEY_STORAGE_PREFIX}.${safeProvider}`;
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDER_ORDER.includes(value as Provider);
}

function isResponseMode(value: unknown): value is ResponseMode {
  return (
    typeof value === "string" &&
    RESPONSE_MODE_ORDER.includes(value as ResponseMode)
  );
}

function extractStoredProviderModels(
  storedSettings?: LegacyStoredSettings
): Partial<ProviderModelSelections> {
  if (!storedSettings) {
    return {};
  }

  return PROVIDER_ORDER.reduce((accumulator, provider) => {
    const providerModels = storedSettings.providerModels?.[provider];
    const legacyValue = storedSettings[LEGACY_MODEL_FIELD_KEYS[provider]];
    const value =
      typeof providerModels === "string" && providerModels
        ? providerModels
        : typeof legacyValue === "string" && legacyValue
          ? legacyValue
          : undefined;

    if (value) {
      accumulator[provider] = value;
    }

    return accumulator;
  }, {} as Partial<ProviderModelSelections>);
}

function extractStoredProviderTtsVoices(
  storedSettings?: LegacyStoredSettings
): Partial<ProviderTtsVoiceSelections> {
  if (!storedSettings) {
    return {};
  }

  const storedProviderVoices =
    (storedSettings.providerTtsVoices as Partial<ProviderTtsVoiceSelections> | undefined) ??
    {};
  const legacyTtsVoice =
    typeof storedSettings.ttsVoice === "string" && storedSettings.ttsVoice
      ? storedSettings.ttsVoice
      : undefined;

  return PROVIDER_ORDER.reduce((accumulator, provider) => {
    const providerVoice = storedProviderVoices[provider];
    const value =
      typeof providerVoice === "string" && providerVoice
        ? providerVoice
        : provider === "openai" && legacyTtsVoice
          ? legacyTtsVoice
          : undefined;

    if (value) {
      accumulator[provider] = value;
    }

    return accumulator;
  }, {} as Partial<ProviderTtsVoiceSelections>);
}

function extractStoredLocalTtsVoices(
  storedSettings?: LegacyStoredSettings
): Partial<LocalTtsVoiceSelections> {
  if (!storedSettings?.localTtsVoices) {
    return {};
  }

  return Object.entries(storedSettings.localTtsVoices).reduce(
    (accumulator, [language, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[language as keyof LocalTtsVoiceSelections] = value.trim();
      }

      return accumulator;
    },
    {} as Partial<LocalTtsVoiceSelections>
  );
}

function getLegacyResponseModeRoute(
  storedSettings: LegacyStoredSettings | undefined,
  providerModels: ProviderModelSelections
): ResponseModeRoute {
  const provider = isProvider(storedSettings?.lastProvider)
    ? storedSettings.lastProvider
    : DEFAULT_SETTINGS.lastProvider;
  const providerModel = providerModels[provider];

  return {
    provider,
    model: isValidModelForProvider(provider, providerModel)
      ? providerModel
      : getDefaultModelForProvider(provider),
  };
}

function extractStoredResponseModes(
  storedSettings: LegacyStoredSettings | undefined,
  providerModels: ProviderModelSelections
): Partial<ResponseModeSelections> {
  const storedResponseModes = storedSettings?.responseModes;

  if (!storedResponseModes || typeof storedResponseModes !== "object") {
    return {};
  }

  return RESPONSE_MODE_ORDER.reduce((accumulator, mode) => {
    const entry = storedResponseModes[mode];

    if (!entry || typeof entry !== "object") {
      return accumulator;
    }

    const provider = isProvider(entry.provider) ? entry.provider : undefined;

    if (!provider) {
      return accumulator;
    }

    const fallbackModel = providerModels[provider] || getDefaultModelForProvider(provider);
    const model =
      typeof entry.model === "string" &&
      isValidModelForProvider(provider, entry.model)
        ? entry.model
        : isValidModelForProvider(provider, fallbackModel)
          ? fallbackModel
          : getDefaultModelForProvider(provider);

    accumulator[mode] = {
      provider,
      model,
    };

    return accumulator;
  }, {} as Partial<ResponseModeSelections>);
}

function mergeSettings(
  storedSettings?: LegacyStoredSettings,
  storedApiKeys?: Partial<ProviderApiKeys>
): Settings {
  const replyPlayback =
    storedSettings?.replyPlayback ??
    storedSettings?.ttsPlayback ??
    DEFAULT_SETTINGS.replyPlayback;
  const language = storedSettings?.language ?? DEFAULT_SETTINGS.language;
  const storedTtsListenLanguages = Array.isArray(storedSettings?.ttsListenLanguages)
    ? storedSettings.ttsListenLanguages.filter(
        (value): value is Settings["ttsListenLanguages"][number] =>
          typeof value === "string" && value.length > 0
      )
    : [];
  const assistantInstructions =
    typeof storedSettings?.assistantInstructions === "string" &&
    storedSettings.assistantInstructions.trim()
      ? storedSettings.assistantInstructions
      : getDefaultAssistantInstructions(language);
  const mergedApiKeys = {
    ...DEFAULT_SETTINGS.apiKeys,
    ...(storedSettings?.apiKeys ?? {}),
    ...storedApiKeys,
  };
  const mergedProviderModels = {
    ...DEFAULT_SETTINGS.providerModels,
    ...extractStoredProviderModels(storedSettings),
  };
  const legacyResponseModeRoute = getLegacyResponseModeRoute(
    storedSettings,
    mergedProviderModels,
  );
  const extractedResponseModes = extractStoredResponseModes(
    storedSettings,
    mergedProviderModels,
  );
  const hasStoredResponseModes = RESPONSE_MODE_ORDER.some(
    (mode) => !!extractedResponseModes[mode],
  );
  const hasConfiguredKeys = Object.values(mergedApiKeys).some(
    (apiKey) => apiKey.trim().length > 0
  );

  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    language,
    replyPlayback,
    ttsListenLanguages:
      storedTtsListenLanguages.length > 0
        ? storedTtsListenLanguages
        : getDefaultTtsListenLanguages(language),
    setupGuideDismissed:
      typeof storedSettings?.setupGuideDismissed === "boolean"
        ? storedSettings.setupGuideDismissed
        : hasConfiguredKeys,
    assistantInstructions,
    activeResponseMode: isResponseMode(storedSettings?.activeResponseMode)
      ? storedSettings.activeResponseMode
      : DEFAULT_SETTINGS.activeResponseMode,
    responseModes:
      !storedSettings
        ? DEFAULT_SETTINGS.responseModes
        : hasStoredResponseModes
          ? {
              ...DEFAULT_SETTINGS.responseModes,
              ...extractedResponseModes,
            }
          : {
              quick: legacyResponseModeRoute,
              normal: legacyResponseModeRoute,
              deep: legacyResponseModeRoute,
            },
    providerModels: mergedProviderModels,
    providerTtsVoices: {
      ...DEFAULT_SETTINGS.providerTtsVoices,
      ...extractStoredProviderTtsVoices(storedSettings),
    },
    localTtsVoices: {
      ...DEFAULT_SETTINGS.localTtsVoices,
      ...extractStoredLocalTtsVoices(storedSettings),
    },
    apiKeys: mergedApiKeys,
  };
}

function toPublicSettings(settings: Settings): PublicSettings {
  const { apiKeys: _apiKeys, ...publicSettings } = settings;
  return publicSettings;
}

function persistPublicSettings(settings: Settings) {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPublicSettings(settings)));
}

async function loadStoredApiKeys(): Promise<ProviderApiKeys> {
  const apiKeyEntries = await Promise.all(
    PROVIDER_ORDER.map(async (provider) => {
      const stored = await SecureStore.getItemAsync(getApiKeyStorageKey(provider));
      return [provider, stored?.trim() ?? ""] as const;
    })
  );

  return Object.fromEntries(apiKeyEntries) as ProviderApiKeys;
}

async function persistApiKey(provider: Provider, apiKey: string) {
  if (apiKey) {
    await SecureStore.setItemAsync(getApiKeyStorageKey(provider), apiKey);
    return;
  }

  await SecureStore.deleteItemAsync(getApiKeyStorageKey(provider));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    void Promise.all([AsyncStorage.getItem(STORAGE_KEY), loadStoredApiKeys()])
      .then(([raw, apiKeys]) => {
        if (!mounted) {
          return;
        }

        const storedSettings = raw
          ? (JSON.parse(raw) as LegacyStoredSettings)
          : undefined;
        setSettings(mergeSettings(storedSettings, apiKeys));
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

  const updateSettings = useCallback((partial: SettingsUpdate) => {
    setSettings((prev) => {
      const nextLanguage = partial.language ?? prev.language;
      const shouldRefreshAssistantInstructions =
        partial.language &&
        partial.assistantInstructions === undefined &&
        isDefaultAssistantInstructions(prev.assistantInstructions);
      const nextTtsListenLanguages =
        partial.ttsListenLanguages ??
        (partial.language && prev.ttsListenLanguages.join("|") === getDefaultTtsListenLanguages(prev.language).join("|")
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
  }, []);

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
  }, []);

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
    [],
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
  }, []);

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
  }, []);

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
    []
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
  }, []);

  return {
    settings,
    updateSettings,
    updateProviderModel,
    updateResponseModeRoute,
    updateActiveResponseMode,
    updateProviderTtsVoice,
    updateLocalTtsVoice,
    updateApiKey,
    loaded,
  };
}
