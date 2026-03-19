import { LOCAL_TTS_DEFAULT_VOICES } from "./constants/localTts";

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
export type ResponseMode = "quick" | "normal" | "deep";
export type TtsListenLanguage =
  | "en"
  | "de"
  | "zh"
  | "es"
  | "pt"
  | "hi"
  | "fr"
  | "it"
  | "ja";
export type SttBackendMode = "native" | "provider";
export type TtsBackendMode = "native" | "provider" | "local";
export type AssistantResponseLength = "brief" | "normal" | "thorough";
export type AssistantResponseTone =
  | "professional"
  | "casual"
  | "nerdy"
  | "concise"
  | "socratic"
  | "eli5";
export interface ResponseModeRoute {
  provider: Provider;
  model: string;
}
export type ProviderApiKeys = Record<Provider, string>;
export type ProviderModelSelections = Record<Provider, string>;
export type ProviderTtsVoiceSelections = Record<Provider, string>;
export type LocalTtsVoiceSelections = Record<TtsListenLanguage, string>;
export type ResponseModeSelections = Record<ResponseMode, ResponseModeRoute>;
export type UsageEstimateKind = "reply" | "summary";
export type VoicePreviewRequest =
  | {
      text: string;
      mode: "native";
      nativeVoice?: string;
    }
  | {
      text: string;
      mode: "provider";
      provider: Provider;
      voice: string;
    }
  | {
      text: string;
      mode: "local";
      localLanguage: TtsListenLanguage;
      voice: string;
    };
export type VoiceVisualPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking";

export interface Settings {
  inputMode: InputMode;
  replyPlayback: ReplyPlayback;
  activeResponseMode: ResponseMode;
  responseModes: ResponseModeSelections;
  providerModels: ProviderModelSelections;
  providerTtsVoices: ProviderTtsVoiceSelections;
  language: AppLanguage;
  theme: ThemeMode;
  setupGuideDismissed: boolean;
  lastProvider: Provider;
  sttMode: SttBackendMode;
  sttProvider: Provider | null;
  ttsMode: TtsBackendMode;
  ttsProvider: Provider | null;
  ttsListenLanguages: TtsListenLanguage[];
  localTtsVoices: LocalTtsVoiceSelections;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  showUsageStats: boolean;
  apiKeys: ProviderApiKeys;
}

export interface UsageEstimate {
  kind: UsageEstimateKind;
  source: "estimated";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
}

export const DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE: Record<
  AppLanguage,
  string
> = {
  en: "You are a voice assistant. The user is speaking to you and will hear your response read aloud. Respond naturally and conversationally as if talking. Never use markdown, bullet points, numbered lists, headers, or any formatting. Keep responses concise and spoken-friendly.",
  de: "Du bist ein Sprachassistent. Die Nutzerin oder der Nutzer spricht mit dir und wird deine Antwort vorgelesen bekommen. Antworte natuerlich und gespraechsnah, als waerest du in einem echten Gespraech. Verwende niemals Markdown, Aufzaehlungen, nummerierte Listen, Ueberschriften oder sonstige Formatierung. Halte Antworten knapp und gut vorlesbar.",
};

export const DEFAULT_ASSISTANT_INSTRUCTIONS =
  DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE.en;

export function getDefaultAssistantInstructions(language: AppLanguage) {
  return DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE[language];
}

export function isDefaultAssistantInstructions(value: string) {
  return Object.values(DEFAULT_ASSISTANT_INSTRUCTIONS_BY_LANGUAGE).includes(
    value,
  );
}

export function getDefaultTtsListenLanguages(
  language: AppLanguage,
): TtsListenLanguage[] {
  return [language];
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  replyPlayback: "stream",
  activeResponseMode: "normal",
  responseModes: {
    quick: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
    },
    normal: {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    },
    deep: {
      provider: "openai",
      model: "gpt-5.4",
    },
  },
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
  setupGuideDismissed: false,
  lastProvider: "openai",
  sttMode: "provider",
  sttProvider: "openai",
  ttsMode: "provider",
  ttsProvider: "openai",
  ttsListenLanguages: getDefaultTtsListenLanguages("en"),
  localTtsVoices: LOCAL_TTS_DEFAULT_VOICES,
  assistantInstructions: getDefaultAssistantInstructions("en"),
  responseLength: "normal",
  responseTone: "professional",
  showUsageStats: false,
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
  usage?: UsageEstimate;
  timestamp: string;
}

export interface ConversationUsageEvent {
  id: string;
  kind: "context-summary";
  model: string | null;
  provider: Provider | null;
  timestamp: string;
  usage: UsageEstimate;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  usageEvents?: ConversationUsageEvent[];
  contextSummary?: string;
  summarizedMessageCount?: number;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  lastModel: string | null;
  lastProvider: Provider | null;
  pinned: boolean;
}
