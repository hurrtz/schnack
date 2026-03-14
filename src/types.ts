export type Provider = "openai" | "anthropic" | "gemini" | "nvidia";
export type InputMode = "push-to-talk" | "toggle-to-talk";
export type TtsPlayback = "stream" | "wait";
export type ThemeMode = "light" | "dark" | "system";
export type ProviderApiKeys = Record<Provider, string>;
export type VoiceVisualPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking";

export interface Settings {
  inputMode: InputMode;
  ttsPlayback: TtsPlayback;
  openaiModel: string;
  anthropicModel: string;
  geminiModel: string;
  nvidiaModel: string;
  ttsVoice: string;
  theme: ThemeMode;
  lastProvider: Provider;
  apiKeys: ProviderApiKeys;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  ttsPlayback: "stream",
  openaiModel: "gpt-5.4",
  anthropicModel: "claude-sonnet-4-6",
  geminiModel: "gemini-2.5-flash",
  nvidiaModel: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  ttsVoice: "alloy",
  theme: "system",
  lastProvider: "openai",
  apiKeys: {
    openai: "",
    anthropic: "",
    gemini: "",
    nvidia: "",
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
