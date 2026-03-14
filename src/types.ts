export type Provider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "cohere"
  | "deepseek"
  | "groq"
  | "mistral"
  | "nvidia"
  | "together"
  | "xai";
export type InputMode = "push-to-talk" | "toggle-to-talk";
export type TtsPlayback = "stream" | "wait";
export type ThemeMode = "light" | "dark" | "system";
export type ProviderApiKeys = Record<Provider, string>;
export type ProviderModelSelections = Record<Provider, string>;
export type VoiceVisualPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking";

export interface Settings {
  inputMode: InputMode;
  ttsPlayback: TtsPlayback;
  providerModels: ProviderModelSelections;
  ttsVoice: string;
  theme: ThemeMode;
  lastProvider: Provider;
  apiKeys: ProviderApiKeys;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  ttsPlayback: "stream",
  providerModels: {
    openai: "gpt-5.4",
    anthropic: "claude-sonnet-4-20250514",
    gemini: "gemini-2.5-flash",
    cohere: "command-a-03-2025",
    deepseek: "deepseek-chat",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-medium-latest",
    nvidia: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    together: "openai/gpt-oss-20b",
    xai: "grok-4",
  },
  ttsVoice: "alloy",
  theme: "system",
  lastProvider: "openai",
  apiKeys: {
    openai: "",
    anthropic: "",
    gemini: "",
    cohere: "",
    deepseek: "",
    groq: "",
    mistral: "",
    nvidia: "",
    together: "",
    xai: "",
  },
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  provider: Provider | null;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  lastModel: string | null;
}
