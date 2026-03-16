import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PROVIDER_ORDER } from "../constants/models";
import {
  Provider,
  ProviderApiKeys,
  ProviderModelSelections,
  ProviderTtsVoiceSelections,
  ReplyPlayback,
  Settings,
  DEFAULT_SETTINGS,
  getDefaultAssistantInstructions,
  isDefaultAssistantInstructions,
} from "../types";

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

function mergeSettings(
  storedSettings?: LegacyStoredSettings,
  storedApiKeys?: Partial<ProviderApiKeys>
): Settings {
  const replyPlayback =
    storedSettings?.replyPlayback ??
    storedSettings?.ttsPlayback ??
    DEFAULT_SETTINGS.replyPlayback;
  const language = storedSettings?.language ?? DEFAULT_SETTINGS.language;
  const assistantInstructions =
    typeof storedSettings?.assistantInstructions === "string" &&
    storedSettings.assistantInstructions.trim()
      ? storedSettings.assistantInstructions
      : getDefaultAssistantInstructions(language);

  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    language,
    replyPlayback,
    assistantInstructions,
    providerModels: {
      ...DEFAULT_SETTINGS.providerModels,
      ...extractStoredProviderModels(storedSettings),
    },
    providerTtsVoices: {
      ...DEFAULT_SETTINGS.providerTtsVoices,
      ...extractStoredProviderTtsVoices(storedSettings),
    },
    apiKeys: {
      ...DEFAULT_SETTINGS.apiKeys,
      ...(storedSettings?.apiKeys ?? {}),
      ...storedApiKeys,
    },
  };
}

function toPublicSettings(settings: Settings): PublicSettings {
  const { apiKeys: _apiKeys, ...publicSettings } = settings;
  return publicSettings;
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

      const next = mergeSettings({
        ...prev,
        ...partial,
        assistantInstructions: shouldRefreshAssistantInstructions
          ? getDefaultAssistantInstructions(nextLanguage)
          : partial.assistantInstructions ?? prev.assistantInstructions,
        apiKeys: prev.apiKeys,
        providerModels: prev.providerModels,
      });
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPublicSettings(next)));
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
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPublicSettings(next)));
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
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPublicSettings(next)));
      return next;
    });
  }, []);

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
    updateProviderTtsVoice,
    updateApiKey,
    loaded,
  };
}
