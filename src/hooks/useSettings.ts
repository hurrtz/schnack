import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PROVIDER_ORDER } from "../constants/models";
import { Provider, ProviderApiKeys, Settings, DEFAULT_SETTINGS } from "../types";

const STORAGE_KEY = "@voxai/settings";
const API_KEY_STORAGE_PREFIX = "voxai.provider_key";

type PublicSettings = Omit<Settings, "apiKeys">;
type SettingsUpdate = Partial<PublicSettings>;

function getApiKeyStorageKey(provider: Provider) {
  const safeProvider = provider.replace(/[^0-9A-Za-z._-]/g, "_");
  return `${API_KEY_STORAGE_PREFIX}.${safeProvider}`;
}

function mergeSettings(
  storedSettings?: Partial<Settings>,
  storedApiKeys?: Partial<ProviderApiKeys>
): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
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

        const storedSettings = raw ? (JSON.parse(raw) as Partial<Settings>) : undefined;
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
      const next = mergeSettings({ ...prev, ...partial, apiKeys: prev.apiKeys });
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

  return { settings, updateSettings, updateApiKey, loaded };
}
