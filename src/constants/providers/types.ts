export interface ModelInfo {
  id: string;
  name: string;
  releaseDate?: string;
}

export interface TtsVoiceOption {
  id: string;
  label: string;
}

export interface ProviderConfig {
  label: string;
  shortLabel: string;
  apiKeyPlaceholder: string;
  apiKeyHint: string;
  apiKeyUrl: string;
  sttSupport: "none" | "provider";
  ttsSupport: "none" | "provider";
  sttLanguageNote?: string;
  ttsLanguageNote?: string;
  models: ModelInfo[];
}
