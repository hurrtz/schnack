import type {
  Provider,
  ProviderApiKeys,
  ProviderModelSelections,
  ReplyPlayback,
  Settings,
} from "../../types";

export const STORAGE_KEY = "@mrbroccoli/settings";
export const API_KEY_STORAGE_PREFIX = "mrbroccoli.provider_key";

export type PublicSettings = Omit<Settings, "apiKeys">;
export type SettingsUpdate = Partial<
  Omit<Settings, "apiKeys" | "providerModels">
>;

export type LegacyStoredSettings = Omit<
  Partial<Settings>,
  "inputMode" | "ttsMode" | "webSearchMode"
> & {
  /** Drive Session was retired as a persisted mode in favor of session-only Hands free. */
  inputMode?: Settings["inputMode"] | "drive-session";
  webSearchEnabled?: boolean;
  /** Legacy "auto" mode is migrated to "on". */
  webSearchMode?: Settings["webSearchMode"] | "auto";
  ttsPlayback?: ReplyPlayback;
  ttsVoice?: string;
  ttsMode?: Settings["ttsMode"];
  localTtsVoices?: unknown;
  introDismissed?: boolean;
  introOpened?: boolean;
  introCompleted?: boolean;
  freeOnboardingLanguageInitialized?: boolean;
  freeOfflineSetupCompleted?: boolean;
  freeOfflineProfileOverrides?: unknown;
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

export const LEGACY_MODEL_FIELD_KEYS: Partial<
  Record<Provider, keyof LegacyStoredSettings>
> = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  gemini: "geminiModel",
  deepseek: "deepseekModel",
  mistral: "mistralModel",
  xai: "xaiModel",
};

export type SettingsLoadResult = {
  storedSettings: LegacyStoredSettings | undefined;
  apiKeys: ProviderApiKeys;
  publicSettingsCorrupt?: boolean;
};

export type StoredProviderModels = Partial<ProviderModelSelections>;
