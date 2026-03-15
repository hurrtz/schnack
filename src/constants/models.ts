import { Provider } from "../types";

export interface ModelInfo {
  id: string;
  name: string;
  releaseDate?: string;
}

export interface ProviderConfig {
  label: string;
  shortLabel: string;
  apiKeyPlaceholder: string;
  apiKeyHint: string;
  apiKeyUrl: string;
  sttSupport: "none" | "provider";
  ttsSupport: "none" | "provider";
  models: ModelInfo[];
}

export const PROVIDER_ORDER: Provider[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "groq",
  "deepseek",
  "mistral",
  "cohere",
  "together",
  "nvidia",
];

const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-5.4", name: "GPT-5.4", releaseDate: "2026-03-01" },
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini", releaseDate: "2025-08-07" },
  { id: "o3", name: "o3", releaseDate: "2025-04-16" },
  { id: "o4-mini", name: "o4 Mini", releaseDate: "2025-04-16" },
  { id: "gpt-4.1", name: "GPT-4.1", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", releaseDate: "2025-04-14" },
];

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    releaseDate: "2025-08-05",
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    releaseDate: "2025-05-14",
  },
  {
    id: "claude-3-5-haiku-latest",
    name: "Claude 3.5 Haiku",
  },
];

const GOOGLE_MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
];

const XAI_MODELS: ModelInfo[] = [
  { id: "grok-4", name: "Grok 4" },
  { id: "grok-4-latest", name: "Grok 4 Latest" },
  {
    id: "grok-4.20-beta-latest-non-reasoning",
    name: "Grok 4.20 Beta Non-Reasoning",
  },
];

const GROQ_MODELS: ModelInfo[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
  {
    id: "moonshotai/kimi-k2-instruct-0905",
    name: "Kimi K2 Instruct",
  },
];

const DEEPSEEK_MODELS: ModelInfo[] = [
  { id: "deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
];

const MISTRAL_MODELS: ModelInfo[] = [
  { id: "mistral-large-latest", name: "Mistral Large Latest" },
  { id: "mistral-medium-latest", name: "Mistral Medium Latest" },
  { id: "mistral-small-latest", name: "Mistral Small Latest" },
];

const COHERE_MODELS: ModelInfo[] = [
  { id: "command-a-03-2025", name: "Command A" },
  { id: "command-r-plus-08-2024", name: "Command R+" },
  { id: "command-r-08-2024", name: "Command R" },
];

const TOGETHER_MODELS: ModelInfo[] = [
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5" },
  {
    id: "Qwen/Qwen3.5-397B-A17B",
    name: "Qwen 3.5 397B A17B",
  },
];

const NVIDIA_MODELS: ModelInfo[] = [
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Llama 3.3 Nemotron Super 49B",
  },
  {
    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    name: "Llama 3.1 Nemotron Ultra 253B",
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    name: "Llama 3.1 Nemotron Nano 8B",
  },
];

export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    label: "OpenAI",
    shortLabel: "OPENAI",
    apiKeyPlaceholder: "sk-...",
    apiKeyHint: "Required for voice transcription, voice previews, and spoken replies.",
    apiKeyUrl: "https://platform.openai.com/settings/organization/api-keys",
    sttSupport: "provider",
    ttsSupport: "provider",
    models: OPENAI_MODELS,
  },
  anthropic: {
    label: "Anthropic",
    shortLabel: "ANTHROPIC",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyHint: "Unlocks Anthropic models in the main stage.",
    apiKeyUrl: "https://platform.claude.com/settings/keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: ANTHROPIC_MODELS,
  },
  gemini: {
    label: "Google",
    shortLabel: "GOOGLE",
    apiKeyPlaceholder: "AIza...",
    apiKeyHint: "Unlocks Gemini models through the Google API.",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    sttSupport: "none",
    ttsSupport: "none",
    models: GOOGLE_MODELS,
  },
  xai: {
    label: "xAI",
    shortLabel: "XAI",
    apiKeyPlaceholder: "xai-...",
    apiKeyHint: "Unlocks Grok models from xAI.",
    apiKeyUrl: "https://console.x.ai/team/default/api-keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: XAI_MODELS,
  },
  groq: {
    label: "Groq",
    shortLabel: "GROQ",
    apiKeyPlaceholder: "gsk_...",
    apiKeyHint: "Groq offers a free tier and unlocks fast hosted inference models.",
    apiKeyUrl: "https://console.groq.com/keys",
    sttSupport: "provider",
    ttsSupport: "none",
    models: GROQ_MODELS,
  },
  deepseek: {
    label: "DeepSeek",
    shortLabel: "DEEPSEEK",
    apiKeyPlaceholder: "sk-...",
    apiKeyHint: "Unlocks DeepSeek chat and reasoning models.",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: DEEPSEEK_MODELS,
  },
  mistral: {
    label: "Mistral",
    shortLabel: "MISTRAL",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks Mistral hosted models.",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: MISTRAL_MODELS,
  },
  cohere: {
    label: "Cohere",
    shortLabel: "COHERE",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks Cohere command models.",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: COHERE_MODELS,
  },
  together: {
    label: "Together",
    shortLabel: "TOGETHER",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks Together-hosted open models.",
    apiKeyUrl: "https://api.together.ai/settings/api-keys",
    sttSupport: "provider",
    ttsSupport: "none",
    models: TOGETHER_MODELS,
  },
  nvidia: {
    label: "NVIDIA",
    shortLabel: "NVIDIA",
    apiKeyPlaceholder: "nvapi-...",
    apiKeyHint: "Unlocks NVIDIA hosted foundation models.",
    apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    sttSupport: "none",
    ttsSupport: "none",
    models: NVIDIA_MODELS,
  },
};

export const PROVIDER_LABELS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].label])
) as Record<Provider, string>;

export const PROVIDER_SHORT_LABELS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].shortLabel])
) as Record<Provider, string>;

export const PROVIDER_MODELS: Record<Provider, ModelInfo[]> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].models])
) as Record<Provider, ModelInfo[]>;

export const PROVIDER_API_KEY_HINTS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].apiKeyHint])
) as Record<Provider, string>;

export const PROVIDER_API_KEY_PLACEHOLDERS: Record<Provider, string> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [
      provider,
      PROVIDER_CONFIGS[provider].apiKeyPlaceholder,
    ])
  ) as Record<Provider, string>;

export const PROVIDER_API_KEY_URLS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].apiKeyUrl])
) as Record<Provider, string>;

export const PROVIDER_STT_SUPPORT: Record<Provider, "none" | "provider"> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].sttSupport])
  ) as Record<Provider, "none" | "provider">;

export const PROVIDER_TTS_SUPPORT: Record<Provider, "none" | "provider"> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].ttsSupport])
  ) as Record<Provider, "none" | "provider">;

export const TTS_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "onyx", "nova", "sage", "shimmer", "verse",
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];
