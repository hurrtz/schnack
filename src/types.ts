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
export type ReplyPlayback = "stream" | "wait";
export type TtsPlayback = ReplyPlayback;
export type ThemeMode = "light" | "dark" | "system";
export type AppLanguage = "en" | "de";
export type VoiceBackendMode = "native" | "provider";
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
export type ProviderTtsVoiceSelections = Record<Provider, string>;
export type VoiceVisualPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking";

export interface Settings {
  inputMode: InputMode;
  replyPlayback: ReplyPlayback;
  providerModels: ProviderModelSelections;
  providerTtsVoices: ProviderTtsVoiceSelections;
  language: AppLanguage;
  theme: ThemeMode;
  lastProvider: Provider;
  sttMode: VoiceBackendMode;
  sttProvider: Provider | null;
  ttsMode: VoiceBackendMode;
  ttsProvider: Provider | null;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  apiKeys: ProviderApiKeys;
}

export const DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE: Record<AppLanguage, string> = {
  en:
    "You are a voice assistant. The user is speaking to you and will hear your response read aloud. Respond naturally and conversationally as if talking. Never use markdown, bullet points, numbered lists, headers, or any formatting. Keep responses concise and spoken-friendly.",
  de:
    "Du bist ein Sprachassistent. Die Nutzerin oder der Nutzer spricht mit dir und wird deine Antwort vorgelesen bekommen. Antworte natuerlich und gespraechsnah, als waerest du in einem echten Gespraech. Verwende niemals Markdown, Aufzaehlungen, nummerierte Listen, Ueberschriften oder sonstige Formatierung. Halte Antworten knapp und gut vorlesbar.",
};

export const DEFAULT_ASSISTANT_INSTRUCTIONS =
  DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE.en;

export function getDefaultAssistantInstructions(language: AppLanguage) {
  return DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE[language];
}

export function isDefaultAssistantInstructions(value: string) {
  return Object.values(DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE).includes(value);
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  replyPlayback: "stream",
  providerModels: {
    openai: "gpt-5.4",
    anthropic: "claude-sonnet-4-6",
    gemini: "gemini-2.5-flash",
    cohere: "command-a-03-2025",
    deepseek: "deepseek-chat",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-medium-2508",
    nvidia: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    together: "openai/gpt-oss-20b",
    xai: "grok-4",
  },
  providerTtsVoices: {
    openai: "alloy",
    anthropic: "",
    gemini: "Kore",
    cohere: "",
    deepseek: "",
    groq: "",
    mistral: "",
    nvidia: "",
    together: "af_alloy",
    xai: "ara",
  },
  language: "en",
  theme: "system",
  lastProvider: "openai",
  sttMode: "provider",
  sttProvider: "openai",
  ttsMode: "provider",
  ttsProvider: "openai",
  assistantInstructions: getDefaultAssistantInstructions("en"),
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
  contextSummary?: string;
  summarizedMessageCount?: number;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  lastModel: string | null;
  lastProvider: Provider | null;
}
