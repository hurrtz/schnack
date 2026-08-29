import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Provider, ProviderApiKeys, Settings } from "../../types";
import { reportPersistenceAlert } from "../../services/persistenceAlerts";
import { recordDebugLogEvent } from "../../services/debugLogCapture";
import { RUNTIME_PROVIDER_IDS } from "../../constants/providers/runtimeState";
import { RETIRED_PROVIDER_IDS } from "../../constants/providers/retiredProviders";
import {
  API_KEY_STORAGE_PREFIX,
  type LegacyStoredSettings,
  STORAGE_KEY,
  type PublicSettings,
  type SettingsLoadResult,
} from "./types";

const mutationQueues = new Map<string, Promise<void>>();
const SECURE_STORE_READ_BATCH_SIZE = 3;

function enqueueSettingsMutation(
  key: string,
  operation: () => Promise<void>,
) {
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(operation)
    .catch((error) => {
      recordDebugLogEvent({
        event: "persistence-operation-failed",
        level: "warn",
        payload: { domain: "settings", error, operation: "save" },
      });
      console.error(`[settings-storage] persistence failed for ${key}`, error);
      reportPersistenceAlert("settings", "save");
    });

  mutationQueues.set(key, queued);
  void queued.then(() => {
    if (mutationQueues.get(key) === queued) {
      mutationQueues.delete(key);
    }
  });

  return queued;
}

async function awaitPendingMutation(key: string) {
  await mutationQueues.get(key);
}

export function getApiKeyStorageKey(provider: Provider | string) {
  const safeProvider = provider.replace(/[^0-9A-Za-z._-]/g, "_");
  return `${API_KEY_STORAGE_PREFIX}.${safeProvider}`;
}

export function toPublicSettings(settings: Settings): PublicSettings {
  const { apiKeys: _apiKeys, ...publicSettings } = settings;
  return publicSettings;
}

function persistSerializedPublicSettings(serialized: string) {
  return enqueueSettingsMutation(STORAGE_KEY, () =>
    AsyncStorage.setItem(STORAGE_KEY, serialized),
  );
}

export function persistPublicSettings(settings: Settings) {
  return persistSerializedPublicSettings(
    JSON.stringify(toPublicSettings(settings)),
  );
}

export function persistNormalizedPublicSettings(
  storedSettings: LegacyStoredSettings | undefined,
  normalizedSettings: Settings,
) {
  if (!storedSettings) {
    return Promise.resolve();
  }

  const serialized = JSON.stringify(toPublicSettings(normalizedSettings));

  if (JSON.stringify(storedSettings) === serialized) {
    return Promise.resolve();
  }

  return persistSerializedPublicSettings(serialized);
}

export async function loadStoredApiKeys(): Promise<ProviderApiKeys> {
  const apiKeys = Object.fromEntries(
    RUNTIME_PROVIDER_IDS.map((provider) => [provider, ""]),
  ) as ProviderApiKeys;
  const failedStorageKeys = new Set<string>();

  await Promise.all(
    RETIRED_PROVIDER_IDS.map(async (provider) => {
      try {
        await SecureStore.deleteItemAsync(getApiKeyStorageKey(provider));
      } catch (error) {
        recordDebugLogEvent({
          event: "persistence-operation-failed",
          level: "warn",
          payload: {
            domain: "secure-settings",
            error,
            operation: "remove-retired-key",
            provider,
          },
        });
        console.error(
          `[settings-storage] failed to remove retired API key for ${provider}`,
          error,
        );
        reportPersistenceAlert("settings", "save");
      }
    }),
  );

  const readStoredValue = async (key: string, label: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      recordDebugLogEvent({
        event: "persistence-operation-failed",
        level: "warn",
        payload: {
          domain: "secure-settings",
          error,
          operation: "load-provider-key",
          provider: label,
        },
      });
      failedStorageKeys.add(key);
      console.error(`[settings-storage] failed to load API key for ${label}`, error);
      return null;
    }
  };

  for (
    let startIndex = 0;
    startIndex < RUNTIME_PROVIDER_IDS.length;
    startIndex += SECURE_STORE_READ_BATCH_SIZE
  ) {
    const providerBatch = RUNTIME_PROVIDER_IDS.slice(
      startIndex,
      startIndex + SECURE_STORE_READ_BATCH_SIZE,
    );
    const apiKeyEntries = await Promise.all(
      providerBatch.map(async (provider) => {
        const stored = await readStoredValue(
          getApiKeyStorageKey(provider),
          provider,
        );
        return [provider, stored?.trim() ?? ""] as const;
      }),
    );

    for (const [provider, apiKey] of apiKeyEntries) {
      apiKeys[provider] = apiKey;
    }
  }

  // Migrate a legacy standalone Grok voice key onto the merged xAI provider.
  const xaiStorageKey = getApiKeyStorageKey("xai");
  if (!apiKeys.xai && !failedStorageKeys.has(xaiStorageKey)) {
    const legacyGrokStorageKey = `${API_KEY_STORAGE_PREFIX}.grok`;
    const legacyGrokKey = await readStoredValue(
      legacyGrokStorageKey,
      "legacy grok",
    );

    if (legacyGrokKey?.trim()) {
      const migratedApiKey = legacyGrokKey.trim();
      apiKeys.xai = migratedApiKey;

      try {
        await SecureStore.setItemAsync(xaiStorageKey, migratedApiKey);
        await SecureStore.deleteItemAsync(legacyGrokStorageKey);
      } catch (error) {
        recordDebugLogEvent({
          event: "persistence-operation-failed",
          level: "warn",
          payload: {
            domain: "secure-settings",
            error,
            operation: "migrate-provider-key",
            provider: "xai",
          },
        });
        console.error(
          "[settings-storage] failed to persist the legacy grok API key migration",
          error,
        );
        reportPersistenceAlert("settings", "save");
      }
    }
  }

  if (failedStorageKeys.size > 0) {
    reportPersistenceAlert("settings", "load");
  }

  return apiKeys;
}

export async function loadStoredSettingsSnapshot(): Promise<SettingsLoadResult> {
  await Promise.all([
    awaitPendingMutation(STORAGE_KEY),
    ...RUNTIME_PROVIDER_IDS.map((provider) =>
      awaitPendingMutation(getApiKeyStorageKey(provider)),
    ),
  ]);
  const [raw, apiKeys] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY),
    loadStoredApiKeys(),
  ]);

  if (!raw) {
    return { storedSettings: undefined, apiKeys };
  }

  try {
    return {
      storedSettings: JSON.parse(raw) as LegacyStoredSettings,
      apiKeys,
    };
  } catch (error) {
    recordDebugLogEvent({
      event: "persistence-operation-failed",
      level: "warn",
      payload: {
        domain: "settings",
        error,
        operation: "parse-public-settings",
      },
    });
    console.error(
      "[settings-storage] failed to parse stored settings",
      error,
    );
    reportPersistenceAlert("settings", "load");
    return {
      storedSettings: undefined,
      apiKeys,
      publicSettingsCorrupt: true,
    };
  }
}

export async function persistApiKey(provider: Provider, apiKey: string) {
  const key = getApiKeyStorageKey(provider);
  await enqueueSettingsMutation(key, async () => {
    if (apiKey) {
      await SecureStore.setItemAsync(key, apiKey);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  });
}
