import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PROVIDER_ORDER } from "../../constants/models";
import type { Provider, ProviderApiKeys, Settings } from "../../types";
import {
  API_KEY_STORAGE_PREFIX,
  type LegacyStoredSettings,
  STORAGE_KEY,
  type PublicSettings,
  type SettingsLoadResult,
} from "./types";

export function getApiKeyStorageKey(provider: Provider) {
  const safeProvider = provider.replace(/[^0-9A-Za-z._-]/g, "_");
  return `${API_KEY_STORAGE_PREFIX}.${safeProvider}`;
}

export function toPublicSettings(settings: Settings): PublicSettings {
  const { apiKeys: _apiKeys, ...publicSettings } = settings;
  return publicSettings;
}

export function persistPublicSettings(settings: Settings) {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPublicSettings(settings)));
}

export async function loadStoredApiKeys(): Promise<ProviderApiKeys> {
  const apiKeyEntries = await Promise.all(
    PROVIDER_ORDER.map(async (provider) => {
      const stored = await SecureStore.getItemAsync(getApiKeyStorageKey(provider));
      return [provider, stored?.trim() ?? ""] as const;
    }),
  );

  return Object.fromEntries(apiKeyEntries) as ProviderApiKeys;
}

export async function loadStoredSettingsSnapshot(): Promise<SettingsLoadResult> {
  const [raw, apiKeys] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY),
    loadStoredApiKeys(),
  ]);

  return {
    storedSettings: raw ? (JSON.parse(raw) as LegacyStoredSettings) : undefined,
    apiKeys,
  };
}

export async function persistApiKey(provider: Provider, apiKey: string) {
  if (apiKey) {
    await SecureStore.setItemAsync(getApiKeyStorageKey(provider), apiKey);
    return;
  }

  await SecureStore.deleteItemAsync(getApiKeyStorageKey(provider));
}
