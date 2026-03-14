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
export type AssistantResponseLength = "brief" | "normal" | "thorough";
export type AssistantResponseTone =
  | "professional"
  | "casual"
  | "nerdy"
  | "concise"
  | "socratic"
  | "eli5";
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
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  apiKeys: ProviderApiKeys;
}

export const DEFAULT_ASSISTANT_INSTRUCTIONS =
  "You are a voice assistant. The user is speaking to you and will hear your response read aloud. Respond naturally and conversationally as if talking. Never use markdown, bullet points, numbered lists, headers, or any formatting. Keep responses concise and spoken-friendly.";

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
  assistantInstructions: DEFAULT_ASSISTANT_INSTRUCTIONS,
  responseLength: "normal",
  responseTone: "professional",
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
