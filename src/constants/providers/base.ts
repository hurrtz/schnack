import { AppLanguage, Provider } from "../../types";
import type { ModelInfo, ProviderConfig } from "./types";

export const NATIVE_STT_LANGUAGE_NOTE =
  "Language support depends on the device OS, installed speech packs, and recognizer availability. The exact language list varies by device.";

export const NATIVE_TTS_LANGUAGE_NOTE =
  "Language support depends on the system voices installed on the device. The exact language list, pronunciation quality, and offline availability vary by OS and device.";

const WHISPER_WELL_SUPPORTED_LANGUAGES =
  "Afrikaans, Arabic, Armenian, Azerbaijani, Belarusian, Bosnian, Bulgarian, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, Galician, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Kannada, Kazakh, Korean, Latvian, Lithuanian, Macedonian, Malay, Marathi, Maori, Nepali, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swahili, Swedish, Tagalog, Tamil, Thai, Turkish, Ukrainian, Urdu, Vietnamese, and Welsh.";

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
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
  { id: "gpt-5.4-pro", name: "GPT-5.4 Pro" },
  { id: "gpt-5.2", name: "GPT-5.2" },
  { id: "gpt-5.1", name: "GPT-5.1" },
  { id: "gpt-5", name: "GPT-5" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", releaseDate: "2025-08-07" },
  { id: "gpt-5-nano", name: "GPT-5 Nano" },
  { id: "o3", name: "o3", releaseDate: "2025-04-16" },
  { id: "o3-pro", name: "o3 Pro" },
  { id: "o4-mini", name: "o4 Mini", releaseDate: "2025-04-16" },
  { id: "o3-mini", name: "o3 Mini" },
  { id: "o1", name: "o1" },
  { id: "o1-mini", name: "o1 Mini (Deprecated)" },
  { id: "o1-preview", name: "o1 Preview (Deprecated)" },
  { id: "gpt-4.5-preview", name: "GPT-4.5 Preview (Deprecated)" },
  { id: "gpt-4.1", name: "GPT-4.1", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", releaseDate: "2025-04-14" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    releaseDate: "2025-10-01",
  },
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    releaseDate: "2025-11-01",
  },
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    releaseDate: "2025-09-29",
  },
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    releaseDate: "2025-08-05",
  },
  {
    id: "claude-opus-4-20250522",
    name: "Claude Opus 4",
    releaseDate: "2025-05-22",
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    releaseDate: "2025-05-14",
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    releaseDate: "2024-03-07",
  },
];

const GOOGLE_MODELS: ModelInfo[] = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite Preview",
  },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite" },
];

const XAI_MODELS: ModelInfo[] = [
  { id: "grok-4", name: "Grok 4" },
  { id: "grok-4-1-fast-reasoning", name: "Grok 4.1 Fast Reasoning" },
  {
    id: "grok-4-1-fast-non-reasoning",
    name: "Grok 4.1 Fast Non-Reasoning",
  },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1" },
  { id: "grok-3", name: "Grok 3" },
  { id: "grok-3-fast", name: "Grok 3 Fast" },
  { id: "grok-3-mini", name: "Grok 3 Mini" },
];

const GROQ_MODELS: ModelInfo[] = [
  { id: "groq/compound", name: "Compound" },
  { id: "groq/compound-mini", name: "Compound Mini" },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    name: "Llama 4 Maverick",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout",
  },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
  { id: "moonshotai/kimi-k2-instruct-0905", name: "Kimi K2 Instruct" },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B" },
];

const DEEPSEEK_MODELS: ModelInfo[] = [
  { id: "deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
];

const MISTRAL_MODELS: ModelInfo[] = [
  { id: "mistral-large-latest", name: "Mistral Large 3" },
  { id: "mistral-medium-latest", name: "Mistral Medium 3" },
  { id: "magistral-medium-latest", name: "Magistral Medium" },
  { id: "magistral-small-latest", name: "Magistral Small" },
  { id: "mistral-small-latest", name: "Mistral Small 3.1" },
  { id: "ministral-8b-latest", name: "Ministral 8B" },
  { id: "open-mistral-nemo", name: "Mistral Nemo" },
  { id: "codestral-latest", name: "Codestral 2" },
];

const COHERE_MODELS: ModelInfo[] = [
  { id: "command-a-03-2025", name: "Command A" },
  { id: "command-a-reasoning-08-2025", name: "Command A Reasoning" },
  { id: "command-a-vision-07-2025", name: "Command A Vision" },
  { id: "command-r7b-12-2024", name: "Command R7B" },
  { id: "command-r-plus-08-2024", name: "Command R+" },
  { id: "command-r-08-2024", name: "Command R" },
];

const TOGETHER_MODELS: ModelInfo[] = [
  { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
  { id: "Qwen/Qwen3.5-397B-A17B", name: "Qwen3.5 397B A17B" },
  { id: "Qwen/Qwen3-235B-A22B-FP8", name: "Qwen3 235B" },
  { id: "Qwen/Qwen3.5-9B", name: "Qwen3.5 9B" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5" },
  { id: "deepseek-ai/DeepSeek-V3.1", name: "DeepSeek V3.1" },
  { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    name: "Llama 3.3 70B Turbo",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    name: "Llama 3.1 8B Turbo",
  },
  {
    id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    name: "Llama 4 Maverick",
  },
  {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen3 Next 80B",
  },
  {
    id: "Qwen/Qwen3-Coder-Next-FP8",
    name: "Qwen3 Coder Next",
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
    apiKeyHint: "Unlocks OpenAI models and OpenAI-hosted speech when you choose provider STT or TTS.",
    apiKeyUrl: "https://platform.openai.com/settings/organization/api-keys",
    sttSupport: "provider",
    ttsSupport: "provider",
    sttLanguageNote:
      `OpenAI currently exposes gpt-4o-transcribe, gpt-4o-mini-transcribe, and whisper-1 for speech-to-text. OpenAI's published well-supported language set is: ${WHISPER_WELL_SUPPORTED_LANGUAGES}`,
    ttsLanguageNote:
      "OpenAI currently exposes gpt-4o-mini-tts, tts-1, and tts-1-hd. OpenAI does not publish a compact well-supported language list for TTS in the same way it does for STT, and notes that the voices are optimized for English.",
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
    apiKeyHint: "Unlocks Gemini models plus Google-hosted speech features through the Gemini API.",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    sttSupport: "provider",
    ttsSupport: "provider",
    sttLanguageNote:
      "Gemini audio understanding is multilingual, but Google does not publish a compact supported-language table for this transcription path. It is a broad general-purpose transcription route rather than a dedicated telephony STT API.",
    ttsLanguageNote:
      "Gemini TTS currently supports Arabic, Bengali, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Mandarin Chinese, Polish, Portuguese, Romanian, Russian, Spanish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, and Vietnamese.",
    models: GOOGLE_MODELS,
  },
  xai: {
    label: "xAI",
    shortLabel: "XAI",
    apiKeyPlaceholder: "xai-...",
    apiKeyHint: "Unlocks Grok models from xAI.",
    apiKeyUrl: "https://console.x.ai/team/default/api-keys",
    sttSupport: "none",
    ttsSupport: "provider",
    ttsLanguageNote:
      "xAI TTS currently supports Arabic, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Thai, Turkish, Vietnamese, and Chinese.",
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
    sttLanguageNote:
      `The app uses whisper-large-v3-turbo here. Groq documents it as multilingual. For the Whisper family, a published well-supported language set is: ${WHISPER_WELL_SUPPORTED_LANGUAGES} If multilingual accuracy matters more than speed, Groq recommends whisper-large-v3 over the turbo variant.`,
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
    sttSupport: "provider",
    ttsSupport: "none",
    sttLanguageNote:
      "The current Voxtral transcription route is documented for English, Spanish, French, Portuguese, Hindi, German, Dutch, and Italian.",
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
    ttsSupport: "provider",
    sttLanguageNote:
      `The current integration uses openai/whisper-large-v3. It is multilingual and accepts ISO 639-1 language hints. A published well-supported language set for Whisper is: ${WHISPER_WELL_SUPPORTED_LANGUAGES}`,
    ttsLanguageNote:
      "The current Together TTS route is configured for English, Spanish, French, German, Italian, Portuguese, Hindi, Japanese, Korean, and Chinese. Voice availability is model-specific.",
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
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].label]),
) as Record<Provider, string>;

export const PROVIDER_SHORT_LABELS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].shortLabel]),
) as Record<Provider, string>;

export const PROVIDER_MODELS: Record<Provider, ModelInfo[]> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].models]),
) as Record<Provider, ModelInfo[]>;

export function getProviderModelName(provider: Provider, modelId: string) {
  const match = PROVIDER_MODELS[provider].find((model) => model.id === modelId);
  return match?.name ?? modelId;
}

const NATIVE_STT_LANGUAGE_NOTES_BY_LANGUAGE: Record<AppLanguage, string> = {
  en: NATIVE_STT_LANGUAGE_NOTE,
  de:
    "Die Sprachunterstuetzung haengt vom Betriebssystem des Geraets, installierten Sprachpaketen und der Verfuegbarkeit der Erkennung ab. Die genaue Liste variiert je nach Geraet.",
};

const NATIVE_TTS_LANGUAGE_NOTES_BY_LANGUAGE: Record<AppLanguage, string> = {
  en: NATIVE_TTS_LANGUAGE_NOTE,
  de:
    "Die Sprachunterstuetzung haengt von den auf dem Geraet installierten Systemstimmen ab. Die genaue Liste, Aussprachequalitaet und Offline-Verfuegbarkeit variieren je nach Betriebssystem und Geraet.",
};

const PROVIDER_API_KEY_HINTS_BY_LANGUAGE: Record<AppLanguage, Record<Provider, string>> = {
  en: Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].apiKeyHint]),
  ) as Record<Provider, string>,
  de: {
    openai:
      "Schaltet OpenAI-Modelle und von OpenAI gehostete Sprachfunktionen frei, wenn du STT oder TTS ueber einen Anbieter nutzt.",
    anthropic: "Schaltet Anthropic-Modelle auf der Hauptbuehne frei.",
    gemini:
      "Schaltet Gemini-Modelle plus von Google gehostete Sprachfunktionen ueber die Gemini-API frei.",
    xai: "Schaltet Grok-Modelle von xAI frei.",
    groq:
      "Groq bietet einen kostenlosen Tarif und schaltet schnelle gehostete Inferenzmodelle frei.",
    deepseek: "Schaltet DeepSeek-Chat- und Reasoning-Modelle frei.",
    mistral: "Schaltet gehostete Mistral-Modelle frei.",
    cohere: "Schaltet Command-Modelle von Cohere frei.",
    together: "Schaltet bei Together gehostete Open-Modelle frei.",
    nvidia: "Schaltet gehostete Foundation-Modelle von NVIDIA frei.",
  },
};

const PROVIDER_API_KEY_PLACEHOLDERS_BY_LANGUAGE: Record<
  AppLanguage,
  Record<Provider, string>
> = {
  en: Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [
      provider,
      PROVIDER_CONFIGS[provider].apiKeyPlaceholder,
    ]),
  ) as Record<Provider, string>,
  de: {
    openai: "sk-...",
    anthropic: "sk-ant-...",
    gemini: "AIza...",
    xai: "xai-...",
    groq: "gsk_...",
    deepseek: "sk-...",
    mistral: "API-Schluessel eingeben",
    cohere: "API-Schluessel eingeben",
    together: "API-Schluessel eingeben",
    nvidia: "nvapi-...",
  },
};

const PROVIDER_STT_LANGUAGE_NOTES_BY_LANGUAGE: Partial<
  Record<AppLanguage, Partial<Record<Provider, string>>>
> = {
  en: Object.fromEntries(
    PROVIDER_ORDER.flatMap((provider) =>
      PROVIDER_CONFIGS[provider].sttLanguageNote
        ? [[provider, PROVIDER_CONFIGS[provider].sttLanguageNote]]
        : [],
    ),
  ) as Partial<Record<Provider, string>>,
  de: {
    openai:
      `OpenAI bietet aktuell gpt-4o-transcribe, gpt-4o-mini-transcribe und whisper-1 fuer Speech-to-Text an. Der von OpenAI veroeffentlichte Satz gut unterstuetzter Sprachen lautet: ${WHISPER_WELL_SUPPORTED_LANGUAGES}`,
    gemini:
      "Gemini Audio Understanding ist mehrsprachig, aber Google veroeffentlicht fuer diesen Transkriptionspfad keine kompakte Tabelle unterstuetzter Sprachen. Es handelt sich eher um eine breite allgemeine Transkriptionsroute als um eine dedizierte Telephony-STT-API.",
    groq:
      `Die App nutzt hier whisper-large-v3-turbo. Groq dokumentiert das Modell als mehrsprachig. Fuer die Whisper-Familie ist dieser Satz gut unterstuetzter Sprachen veroeffentlicht: ${WHISPER_WELL_SUPPORTED_LANGUAGES} Wenn dir mehrsprachige Genauigkeit wichtiger ist als Geschwindigkeit, empfiehlt Groq whisper-large-v3 statt der Turbo-Variante.`,
    mistral:
      "Die aktuelle Voxtral-Transkriptionsroute ist fuer Englisch, Spanisch, Franzoesisch, Portugiesisch, Hindi, Deutsch, Niederlaendisch und Italienisch dokumentiert.",
    together:
      `Die aktuelle Integration nutzt openai/whisper-large-v3. Das Modell ist mehrsprachig und akzeptiert ISO-639-1-Sprachhinweise. Ein veroeffentlichter Satz gut unterstuetzter Whisper-Sprachen lautet: ${WHISPER_WELL_SUPPORTED_LANGUAGES}`,
  },
};

const PROVIDER_TTS_LANGUAGE_NOTES_BY_LANGUAGE: Partial<
  Record<AppLanguage, Partial<Record<Provider, string>>>
> = {
  en: Object.fromEntries(
    PROVIDER_ORDER.flatMap((provider) =>
      PROVIDER_CONFIGS[provider].ttsLanguageNote
        ? [[provider, PROVIDER_CONFIGS[provider].ttsLanguageNote]]
        : [],
    ),
  ) as Partial<Record<Provider, string>>,
  de: {
    openai:
      "OpenAI bietet aktuell gpt-4o-mini-tts, tts-1 und tts-1-hd fuer Text-to-Speech an. OpenAI veroeffentlicht fuer TTS keine so kompakte Liste gut unterstuetzter Sprachen wie fuer STT und weist darauf hin, dass die Stimmen fuer Englisch optimiert sind.",
    gemini:
      "Gemini TTS unterstuetzt aktuell Arabisch, Bengalisch, Niederlaendisch, Englisch, Franzoesisch, Deutsch, Hindi, Indonesisch, Italienisch, Japanisch, Koreanisch, Mandarin, Polnisch, Portugiesisch, Rumaenisch, Russisch, Spanisch, Tamil, Telugu, Thai, Tuerkisch, Ukrainisch, Urdu und Vietnamesisch.",
    xai:
      "xAI TTS unterstuetzt aktuell Arabisch, Niederlaendisch, Englisch, Franzoesisch, Deutsch, Hindi, Indonesisch, Italienisch, Japanisch, Koreanisch, Polnisch, Portugiesisch, Russisch, Spanisch, Thai, Tuerkisch, Vietnamesisch und Chinesisch.",
    together:
      "Die aktuelle Together-TTS-Route ist fuer Englisch, Spanisch, Franzoesisch, Deutsch, Italienisch, Portugiesisch, Hindi, Japanisch, Koreanisch und Chinesisch konfiguriert. Die Verfuegbarkeit einzelner Stimmen haengt vom Modell ab.",
  },
};

export const PROVIDER_API_KEY_HINTS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].apiKeyHint]),
) as Record<Provider, string>;

export const PROVIDER_API_KEY_PLACEHOLDERS: Record<Provider, string> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [
      provider,
      PROVIDER_CONFIGS[provider].apiKeyPlaceholder,
    ]),
  ) as Record<Provider, string>;

export const PROVIDER_API_KEY_URLS: Record<Provider, string> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].apiKeyUrl]),
) as Record<Provider, string>;

export const PROVIDER_STT_SUPPORT: Record<Provider, "none" | "provider"> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].sttSupport]),
  ) as Record<Provider, "none" | "provider">;

export const PROVIDER_TTS_SUPPORT: Record<Provider, "none" | "provider"> =
  Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, PROVIDER_CONFIGS[provider].ttsSupport]),
  ) as Record<Provider, "none" | "provider">;

export const PROVIDER_STT_LANGUAGE_NOTES: Partial<Record<Provider, string>> =
  Object.fromEntries(
    PROVIDER_ORDER.flatMap((provider) =>
      PROVIDER_CONFIGS[provider].sttLanguageNote
        ? [[provider, PROVIDER_CONFIGS[provider].sttLanguageNote]]
        : [],
    ),
  ) as Partial<Record<Provider, string>>;

export const PROVIDER_TTS_LANGUAGE_NOTES: Partial<Record<Provider, string>> =
  Object.fromEntries(
    PROVIDER_ORDER.flatMap((provider) =>
      PROVIDER_CONFIGS[provider].ttsLanguageNote
        ? [[provider, PROVIDER_CONFIGS[provider].ttsLanguageNote]]
        : [],
    ),
  ) as Partial<Record<Provider, string>>;

export function getNativeSttLanguageNote(language: AppLanguage) {
  return NATIVE_STT_LANGUAGE_NOTES_BY_LANGUAGE[language];
}

export function getNativeTtsLanguageNote(language: AppLanguage) {
  return NATIVE_TTS_LANGUAGE_NOTES_BY_LANGUAGE[language];
}

export function getProviderApiKeyHint(provider: Provider, language: AppLanguage) {
  return PROVIDER_API_KEY_HINTS_BY_LANGUAGE[language][provider];
}

export function getProviderApiKeyPlaceholder(
  provider: Provider,
  language: AppLanguage,
) {
  return PROVIDER_API_KEY_PLACEHOLDERS_BY_LANGUAGE[language][provider];
}

export function getProviderSttLanguageNote(
  provider: Provider,
  language: AppLanguage,
) {
  return PROVIDER_STT_LANGUAGE_NOTES_BY_LANGUAGE[language]?.[provider] ?? null;
}

export function getProviderTtsLanguageNote(
  provider: Provider,
  language: AppLanguage,
) {
  return PROVIDER_TTS_LANGUAGE_NOTES_BY_LANGUAGE[language]?.[provider] ?? null;
}
