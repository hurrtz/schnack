export type Provider = "openai" | "anthropic";
export type InputMode = "push-to-talk" | "toggle-to-talk";
export type TtsPlayback = "stream" | "wait";
export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  inputMode: InputMode;
  ttsPlayback: TtsPlayback;
  openaiModel: string;
  anthropicModel: string;
  ttsVoice: string;
  theme: ThemeMode;
  lastProvider: Provider;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  ttsPlayback: "stream",
  openaiModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",
  ttsVoice: "alloy",
  theme: "system",
  lastProvider: "openai",
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
