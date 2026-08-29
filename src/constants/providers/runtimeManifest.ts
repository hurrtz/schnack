import type { CatalogProviderId } from "../../catalog/types";
import { PROVIDER_DOCUMENTS } from "../../../data/providers";
import type { SpeechLanguage } from "../speechLanguages";

export type RuntimeAppProviderId =
  | "openai"
  | "openrouter"
  | "anthropic"
  | "alibaba-qwen-dashscope"
  | "gemini"
  | "deepseek"
  | "elevenlabs"
  | "mistral"
  | "xai";

export type RuntimeLlmTransport =
  | "none"
  | "openai-compatible"
  | "openai-realtime"
  | "gemini-generate-content"
  | "anthropic";
export type RuntimeSttTransport =
  | "none"
  | "multipart"
  | "google-speech"
  | "openai-audio-input"
  | "xai-stt-rest";
export type RuntimeTtsTransport = "none" | "binary" | "gemini" | "dashscope";
export type RuntimeTtsBinaryRequestFormat =
  "elevenlabs-speech" | "openai-speech" | "grok-speech" | "mistral-speech";
export type RuntimeTtsVoiceDirectory = "elevenlabs" | "mistral" | "xai";

export interface RuntimeModelSpec {
  id: string;
  fallbackName?: string;
  releaseDate?: string;
  effort?: RuntimeModelEffortConfig;
  supportsInstructions?: boolean;
  supportsImageInput?: boolean;
}

export type RuntimeModelEffortTransportParam =
  | "anthropic-output-effort"
  | "gemini-thinking-budget"
  | "gemini-thinking-level"
  | "deepseek-thinking-effort"
  | "qwen-enable-thinking"
  | "reasoning-effort";

export interface RuntimeModelEffortOption {
  id: string;
  label: string;
  localizedLabels?: Partial<Record<"de", string>>;
  transportValue?: string;
}

export interface RuntimeModelEffortConfig {
  options: RuntimeModelEffortOption[];
  defaultOptionId?: string;
  transportParam: RuntimeModelEffortTransportParam;
}

export interface RuntimeVoiceOption {
  id: string;
  label: string;
  localizedLabels?: Partial<Record<"de", string>>;
  modelIds?: string[];
}

interface RuntimeLlmProviderManifest {
  support: "provider";
  transport: Exclude<RuntimeLlmTransport, "none">;
  endpoint?: string;
  defaultModel: string;
  fallbackModelIds: string[];
  models: RuntimeModelSpec[];
  supportsImageInput?: boolean;
  realtimeModelIds?: string[];
  realtimeTransport?: Exclude<RuntimeLlmTransport, "none">;
}

interface RuntimeLlmDisabledManifest {
  support: "none";
  transport: "none";
  models: [];
  defaultModel?: string;
  fallbackModelIds?: [];
}

type RuntimeLlmManifest =
  RuntimeLlmProviderManifest | RuntimeLlmDisabledManifest;

interface RuntimeSttManifest {
  support: "none" | "provider";
  transport: RuntimeSttTransport;
  endpoint?: string;
  endpointBase?: string;
  defaultModel?: string;
  fallbackModelIds?: string[];
  models: RuntimeModelSpec[];
  languages?: readonly SpeechLanguage[];
  languageNote?: string;
}

interface RuntimeTtsManifest {
  support: "none" | "provider";
  transport: RuntimeTtsTransport;
  endpoint?: string;
  endpointBase?: string;
  requestFormat?: RuntimeTtsBinaryRequestFormat;
  defaultModel?: string;
  fallbackModelIds?: string[];
  models: RuntimeModelSpec[];
  languages?: readonly SpeechLanguage[];
  defaultVoice?: string;
  voiceFallback?: string;
  voiceOptions: RuntimeVoiceOption[];
  voiceDirectory?: RuntimeTtsVoiceDirectory;
  requiresVoice?: boolean;
  languageNote?: string;
}

export interface RuntimeProviderManifestEntry {
  appProvider: RuntimeAppProviderId;
  catalogProviderId: CatalogProviderId;
  label: string;
  shortLabel: string;
  apiKeyPlaceholder: string;
  apiKeyHint: string;
  apiKeyUrl: string;
  llm: RuntimeLlmManifest;
  stt: RuntimeSttManifest;
  tts: RuntimeTtsManifest;
}

const WHISPER_WELL_SUPPORTED_LANGUAGES =
  "Afrikaans, Arabic, Armenian, Azerbaijani, Belarusian, Bosnian, Bulgarian, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, Galician, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Kannada, Kazakh, Korean, Latvian, Lithuanian, Macedonian, Malay, Marathi, Maori, Nepali, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swahili, Swedish, Tagalog, Tamil, Thai, Turkish, Ukrainian, Urdu, Vietnamese, and Welsh.";

function model(id: string, releaseDate?: string): RuntimeModelSpec {
  return releaseDate ? { id, releaseDate } : { id };
}

function namedModel(
  id: string,
  fallbackName: string,
  releaseDate?: string,
): RuntimeModelSpec {
  return releaseDate ? { id, fallbackName, releaseDate } : { id, fallbackName };
}

function withEffort(
  modelSpec: RuntimeModelSpec,
  effort: RuntimeModelEffortConfig,
): RuntimeModelSpec {
  return {
    ...modelSpec,
    effort,
  };
}

function withInstructions(modelSpec: RuntimeModelSpec): RuntimeModelSpec {
  return {
    ...modelSpec,
    supportsInstructions: true,
  };
}

function voice(
  id: string,
  label: string,
  localizedLabels?: RuntimeVoiceOption["localizedLabels"],
): RuntimeVoiceOption {
  return localizedLabels ? { id, label, localizedLabels } : { id, label };
}

function voiceForModels(
  id: string,
  label: string,
  modelIds: string[],
): RuntimeVoiceOption {
  return { id, label, modelIds };
}

const GEMINI_THINKING_LEVEL_OPTIONS: RuntimeModelEffortOption[] = [
  {
    id: "minimal",
    label: "Minimal",
    localizedLabels: { de: "Minimal" },
    transportValue: "MINIMAL",
  },
  {
    id: "low",
    label: "Low",
    localizedLabels: { de: "Niedrig" },
    transportValue: "LOW",
  },
  {
    id: "medium",
    label: "Medium",
    localizedLabels: { de: "Mittel" },
    transportValue: "MEDIUM",
  },
  {
    id: "high",
    label: "High",
    localizedLabels: { de: "Hoch" },
    transportValue: "HIGH",
  },
];

const GEMINI_25_DYNAMIC_BUDGET_OPTION: RuntimeModelEffortOption = {
  id: "dynamic",
  label: "Dynamic",
  localizedLabels: { de: "Dynamisch" },
  transportValue: "-1",
};

const GEMINI_25_DISABLED_BUDGET_OPTION: RuntimeModelEffortOption = {
  id: "disabled",
  label: "Disabled",
  localizedLabels: { de: "Deaktiviert" },
  transportValue: "0",
};

function geminiThinkingBudgetEffort(params: {
  defaultOptionId: "dynamic" | "disabled";
  minimumBudget: number;
  maximumBudget: number;
  canDisable: boolean;
}): RuntimeModelEffortConfig {
  const activeOptions: RuntimeModelEffortOption[] = [
    {
      id: "low",
      label: "Low",
      localizedLabels: { de: "Niedrig" },
      transportValue: String(params.minimumBudget),
    },
    {
      id: "medium",
      label: "Medium",
      localizedLabels: { de: "Mittel" },
      transportValue: "8192",
    },
    {
      id: "high",
      label: "High",
      localizedLabels: { de: "Hoch" },
      transportValue: String(params.maximumBudget),
    },
  ];

  return {
    defaultOptionId: params.defaultOptionId,
    options: [
      ...(params.canDisable ? [GEMINI_25_DISABLED_BUDGET_OPTION] : []),
      GEMINI_25_DYNAMIC_BUDGET_OPTION,
      ...activeOptions,
    ],
    transportParam: "gemini-thinking-budget",
  };
}

const BASIC_REASONING_EFFORT_OPTIONS: RuntimeModelEffortOption[] = [
  {
    id: "none",
    label: "None",
    localizedLabels: { de: "Keine" },
  },
  {
    id: "minimal",
    label: "Minimal",
    localizedLabels: { de: "Minimal" },
  },
  {
    id: "low",
    label: "Low",
    localizedLabels: { de: "Niedrig" },
  },
  {
    id: "medium",
    label: "Medium",
    localizedLabels: { de: "Mittel" },
  },
  {
    id: "high",
    label: "High",
    localizedLabels: { de: "Hoch" },
  },
  {
    id: "xhigh",
    label: "Extra high",
    localizedLabels: { de: "Sehr hoch" },
  },
  {
    id: "max",
    label: "Max",
    localizedLabels: { de: "Maximal" },
  },
];

const THINKING_TOGGLE_OPTIONS: RuntimeModelEffortOption[] = [
  {
    id: "disabled",
    label: "Disabled",
    localizedLabels: { de: "Deaktiviert" },
  },
  {
    id: "enabled",
    label: "Enabled",
    localizedLabels: { de: "Aktiviert" },
  },
];

function effortConfig(
  transportParam: RuntimeModelEffortTransportParam,
  defaultOptionId: string,
  optionIds: string[],
  options = BASIC_REASONING_EFFORT_OPTIONS,
): RuntimeModelEffortConfig {
  const allowedOptionIds = new Set(optionIds);

  return {
    defaultOptionId,
    options: options.filter((option) => allowedOptionIds.has(option.id)),
    transportParam,
  };
}

function geminiThinkingEffort(
  defaultOptionId: string,
  optionIds: string[],
): RuntimeModelEffortConfig {
  const allowedOptionIds = new Set(optionIds);

  return {
    defaultOptionId,
    options: GEMINI_THINKING_LEVEL_OPTIONS.filter((option) =>
      allowedOptionIds.has(option.id),
    ),
    transportParam: "gemini-thinking-level",
  };
}

const OPENAI_GPT_55_EFFORT = effortConfig("reasoning-effort", "medium", [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const OPENAI_GPT_56_EFFORT = effortConfig("reasoning-effort", "medium", [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const OPENAI_GPT_54_EFFORT = effortConfig("reasoning-effort", "none", [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const ANTHROPIC_EXTENDED_OUTPUT_EFFORT = effortConfig(
  "anthropic-output-effort",
  "high",
  ["low", "medium", "high", "xhigh", "max"],
);
const ANTHROPIC_STANDARD_OUTPUT_EFFORT = effortConfig(
  "anthropic-output-effort",
  "high",
  ["low", "medium", "high", "max"],
);

const XAI_GROK_43_EFFORT = effortConfig("reasoning-effort", "low", [
  "none",
  "low",
  "medium",
  "high",
]);

const XAI_GROK_45_EFFORT = effortConfig("reasoning-effort", "high", [
  "low",
  "medium",
  "high",
]);

// Grok 4.6 keeps Grok 4.5's high default and adds a tier above it. Reasoning
// still cannot be disabled, so there is no `none` here.
const XAI_GROK_46_EFFORT = effortConfig("reasoning-effort", "high", [
  "low",
  "medium",
  "high",
  "xhigh",
]);

const DEEPSEEK_THINKING_EFFORT = effortConfig(
  "deepseek-thinking-effort",
  "high",
  ["disabled", "high", "max"],
  [THINKING_TOGGLE_OPTIONS[0], ...BASIC_REASONING_EFFORT_OPTIONS],
);

const MISTRAL_ADJUSTABLE_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "high",
  ["none", "high"],
);

const OPENROUTER_FULL_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "medium",
  ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
);
const OPENROUTER_HIGH_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "high",
  ["low", "medium", "high", "xhigh", "max"],
);
const OPENROUTER_GEMINI_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "medium",
  ["minimal", "low", "medium", "high"],
);
const OPENROUTER_GROK_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "high",
  ["low", "medium", "high"],
);
const OPENROUTER_DEEPSEEK_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "high",
  ["high", "xhigh"],
);
const OPENROUTER_MISTRAL_REASONING_EFFORT = effortConfig(
  "reasoning-effort",
  "high",
  ["none", "high"],
);

const QWEN_THINKING_EFFORT = effortConfig(
  "qwen-enable-thinking",
  "enabled",
  ["disabled", "enabled"],
  THINKING_TOGGLE_OPTIONS,
);

function getCatalogProviderDocument(providerId: CatalogProviderId) {
  return PROVIDER_DOCUMENTS.find(
    (document) => document.provider.providerId === providerId,
  );
}

function getCatalogServiceModels(
  providerId: CatalogProviderId,
  service: "llm" | "stt" | "tts",
) {
  const document = getCatalogProviderDocument(providerId);

  if (!document) {
    return [];
  }

  if (service === "llm") {
    return document.llms;
  }

  if (service === "stt") {
    return document.stt;
  }

  return document.tts;
}

function catalogModelSpecs(
  providerId: CatalogProviderId,
  service: "llm" | "stt" | "tts",
  excludeModelIds: string[] = [],
): RuntimeModelSpec[] {
  const excluded = new Set(excludeModelIds);

  return getCatalogServiceModels(providerId, service)
    .filter((model) => !excluded.has(model.modelId))
    .map((model) => namedModel(model.modelId, model.publicName));
}

export const RUNTIME_PROVIDER_ORDER = [
  "openai",
  "openrouter",
  "anthropic",
  "alibaba-qwen-dashscope",
  "gemini",
  "xai",
  "deepseek",
  "mistral",
  "elevenlabs",
] as const satisfies readonly RuntimeAppProviderId[];

export const RUNTIME_PROVIDER_MANIFEST: Record<
  RuntimeAppProviderId,
  RuntimeProviderManifestEntry
> = {
  openai: {
    appProvider: "openai",
    catalogProviderId: "openai",
    label: "OpenAI",
    shortLabel: "OPENAI",
    apiKeyPlaceholder: "sk-...",
    apiKeyHint:
      "Unlocks OpenAI models, OpenAI-hosted speech, and OpenAI web search.",
    apiKeyUrl: "https://platform.openai.com/settings/organization/api-keys",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "openai-compatible",
      endpoint: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-5.6-sol",
      fallbackModelIds: [
        "gpt-5.6-sol",
        "gpt-5.5-2026-04-23",
        "gpt-4.1-mini-2025-04-14",
      ],
      // Realtime IDs stay mapped to the existing WebSocket adapter for tests
      // and leftover stored routes, but they are not picker options until the
      // Realtime session protocol (OpenAI-Beta: realtime=v1 and session.update)
      // is implemented.
      realtimeModelIds: ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"],
      realtimeTransport: "openai-realtime",
      models: [
        withEffort(
          namedModel("gpt-5.6-sol", "GPT-5.6 Sol"),
          OPENAI_GPT_56_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.6-terra", "GPT-5.6 Terra"),
          OPENAI_GPT_56_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.6-luna", "GPT-5.6 Luna"),
          OPENAI_GPT_56_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.5-2026-04-23", "GPT-5.5"),
          OPENAI_GPT_55_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.4-2026-03-05", "GPT-5.4"),
          OPENAI_GPT_54_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.4-mini-2026-03-17", "GPT-5.4 mini"),
          OPENAI_GPT_54_EFFORT,
        ),
        withEffort(
          namedModel("gpt-5.4-nano-2026-03-17", "GPT-5.4 nano"),
          OPENAI_GPT_54_EFFORT,
        ),
        namedModel("gpt-4.1-2025-04-14", "GPT-4.1"),
        namedModel("gpt-4.1-mini-2025-04-14", "GPT-4.1 mini"),
      ],
    },
    stt: {
      support: "provider",
      transport: "multipart",
      endpoint: "https://api.openai.com/v1/audio/transcriptions",
      defaultModel: "gpt-4o-mini-transcribe",
      fallbackModelIds: [
        "gpt-4o-mini-transcribe",
        "gpt-4o-transcribe",
        "whisper-1",
      ],
      models: catalogModelSpecs("openai", "stt"),
      languages: [
        "en",
        "de",
        "uk",
        "hi",
        "es",
        "fr",
        "it",
        "pt",
        "pt-BR",
        "ru",
        "zh-CN",
        "ar",
        "ja",
        "hu",
        "cs",
        "pl",
        "tr",
        "sv",
        "ur",
      ],
      languageNote: `OpenAI currently exposes gpt-4o-transcribe, gpt-4o-mini-transcribe, and whisper-1 for speech-to-text. OpenAI's published well-supported language set is: ${WHISPER_WELL_SUPPORTED_LANGUAGES}`,
    },
    tts: {
      support: "provider",
      transport: "binary",
      endpoint: "https://api.openai.com/v1/audio/speech",
      requestFormat: "openai-speech",
      defaultModel: "gpt-4o-mini-tts",
      fallbackModelIds: ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
      defaultVoice: "alloy",
      voiceFallback: "alloy",
      models: [
        withInstructions(namedModel("gpt-4o-mini-tts", "GPT-4o Mini TTS")),
        namedModel("tts-1", "tts-1"),
        namedModel("tts-1-hd", "tts-1-hd"),
      ],
      languages: [
        "en",
        "de",
        "uk",
        "hi",
        "es",
        "fr",
        "it",
        "pt",
        "pt-BR",
        "ru",
        "zh-CN",
        "ar",
        "ja",
        "hu",
        "cs",
        "pl",
        "tr",
        "sv",
        "ur",
      ],
      voiceOptions: [
        voice("alloy", "Alloy"),
        voice("ash", "Ash"),
        voice("ballad", "Ballad"),
        voice("cedar", "Cedar"),
        voice("coral", "Coral"),
        voice("echo", "Echo"),
        voice("fable", "Fable"),
        voice("marin", "Marin"),
        voice("onyx", "Onyx"),
        voice("nova", "Nova"),
        voice("sage", "Sage"),
        voice("shimmer", "Shimmer"),
        voice("verse", "Verse"),
      ],
      languageNote:
        "OpenAI currently exposes gpt-4o-mini-tts, tts-1, and tts-1-hd. OpenAI does not publish a compact well-supported language list for TTS in the same way it does for STT, and notes that the voices are optimized for English.",
    },
  },
  openrouter: {
    appProvider: "openrouter",
    catalogProviderId: "openrouter",
    label: "OpenRouter",
    shortLabel: "OPENROUTER",
    apiKeyPlaceholder: "sk-or-v1-...",
    apiKeyHint:
      "One OpenRouter key unlocks a curated set of provider models. Requests pass through OpenRouter to the selected upstream provider; direct provider connections remain available separately.",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "openai-compatible",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      defaultModel: "openai/gpt-5.6-sol-20260709",
      fallbackModelIds: [
        "openai/gpt-5.6-sol-20260709",
        "google/gemini-3.6-flash-20260721",
        "anthropic/claude-sonnet-5-20260630",
      ],
      models: [
        withEffort(
          namedModel("openai/gpt-5.6-sol-20260709", "OpenAI · GPT-5.6 Sol"),
          OPENROUTER_FULL_REASONING_EFFORT,
        ),
        withEffort(
          namedModel(
            "anthropic/claude-sonnet-5-20260630",
            "Anthropic · Claude Sonnet 5",
          ),
          OPENROUTER_HIGH_REASONING_EFFORT,
        ),
        withEffort(
          namedModel(
            "anthropic/claude-5-fable-20260609",
            "Anthropic · Claude Fable 5",
          ),
          OPENROUTER_HIGH_REASONING_EFFORT,
        ),
        withEffort(
          namedModel(
            "google/gemini-3.6-flash-20260721",
            "Google · Gemini 3.6 Flash",
          ),
          OPENROUTER_GEMINI_REASONING_EFFORT,
        ),
        withEffort(
          namedModel(
            "google/gemini-3.5-flash-lite-20260721",
            "Google · Gemini 3.5 Flash Lite",
          ),
          OPENROUTER_GEMINI_REASONING_EFFORT,
        ),
        withEffort(
          namedModel("x-ai/grok-4.6", "xAI · Grok 4.6"),
          OPENROUTER_GROK_REASONING_EFFORT,
        ),
        withEffort(
          namedModel("x-ai/grok-4.5-20260708", "xAI · Grok 4.5"),
          OPENROUTER_GROK_REASONING_EFFORT,
        ),
        withEffort(
          {
            ...namedModel(
              "deepseek/deepseek-v4-pro-20260423",
              "DeepSeek · DeepSeek V4 Pro",
            ),
            supportsImageInput: false,
          },
          OPENROUTER_DEEPSEEK_REASONING_EFFORT,
        ),
        withEffort(
          namedModel("moonshotai/kimi-k3-20260715", "Moonshot · Kimi K3"),
          effortConfig("reasoning-effort", "high", ["low", "high", "max"]),
        ),
        withEffort(
          namedModel(
            "mistralai/mistral-medium-3.5-20260430",
            "Mistral · Mistral Medium 3.5",
          ),
          OPENROUTER_MISTRAL_REASONING_EFFORT,
        ),
        namedModel("qwen/qwen3.7-max-20260520", "Qwen · Qwen3.7 Max"),
      ],
    },
    stt: {
      support: "none",
      transport: "none",
      models: [],
    },
    tts: {
      support: "none",
      transport: "none",
      models: [],
      voiceOptions: [],
    },
  },
  anthropic: {
    appProvider: "anthropic",
    catalogProviderId: "anthropic",
    label: "Anthropic",
    shortLabel: "ANTHROPIC",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyHint: "Unlocks Anthropic models in the main stage.",
    apiKeyUrl: "https://platform.claude.com/settings/keys",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "anthropic",
      defaultModel: "claude-sonnet-5",
      fallbackModelIds: [
        "claude-sonnet-5",
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
      ],
      models: [
        withEffort(
          namedModel("claude-sonnet-5", "Claude Sonnet 5"),
          ANTHROPIC_EXTENDED_OUTPUT_EFFORT,
        ),
        withEffort(
          namedModel("claude-fable-5", "Claude Fable 5"),
          ANTHROPIC_EXTENDED_OUTPUT_EFFORT,
        ),
        withEffort(model("claude-opus-4-8"), ANTHROPIC_EXTENDED_OUTPUT_EFFORT),
        model("claude-haiku-4-5-20251001"),
        withEffort(
          model("claude-sonnet-4-6"),
          ANTHROPIC_STANDARD_OUTPUT_EFFORT,
        ),
        withEffort(model("claude-opus-4-7"), ANTHROPIC_EXTENDED_OUTPUT_EFFORT),
        withEffort(model("claude-opus-4-6"), ANTHROPIC_STANDARD_OUTPUT_EFFORT),
      ],
    },
    stt: {
      support: "none",
      transport: "none",
      models: [],
    },
    tts: {
      support: "none",
      transport: "none",
      models: [],
      voiceOptions: [],
    },
  },
  gemini: {
    appProvider: "gemini",
    catalogProviderId: "google-vertex-ai-studio",
    label: "Google",
    shortLabel: "GOOGLE",
    apiKeyPlaceholder: "Gemini API key",
    apiKeyHint:
      "Use an AI Studio Gemini API key for chat, speech transcription, web search, and TTS.",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "gemini-generate-content",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      defaultModel: "gemini-3.6-flash",
      fallbackModelIds: [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
      ],
      models: [
        withEffort(
          model("gemini-3.6-flash"),
          geminiThinkingEffort("medium", ["minimal", "low", "medium", "high"]),
        ),
        withEffort(
          model("gemini-3.5-flash"),
          geminiThinkingEffort("medium", ["minimal", "low", "medium", "high"]),
        ),
        withEffort(
          model("gemini-3.5-flash-lite"),
          geminiThinkingEffort("minimal", ["minimal", "low", "medium", "high"]),
        ),
        withEffort(
          namedModel("gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview"),
          geminiThinkingEffort("high", ["low", "medium", "high"]),
        ),
        withEffort(
          model("gemini-3.1-flash-lite"),
          geminiThinkingEffort("minimal", ["minimal", "low", "medium", "high"]),
        ),
        withEffort(
          model("gemini-2.5-pro"),
          geminiThinkingBudgetEffort({
            defaultOptionId: "dynamic",
            minimumBudget: 128,
            maximumBudget: 32768,
            canDisable: false,
          }),
        ),
        withEffort(
          model("gemini-2.5-flash"),
          geminiThinkingBudgetEffort({
            defaultOptionId: "dynamic",
            minimumBudget: 1024,
            maximumBudget: 24576,
            canDisable: true,
          }),
        ),
        withEffort(
          model("gemini-2.5-flash-lite"),
          geminiThinkingBudgetEffort({
            defaultOptionId: "disabled",
            minimumBudget: 512,
            maximumBudget: 24576,
            canDisable: true,
          }),
        ),
      ],
    },
    stt: {
      support: "provider",
      transport: "google-speech",
      endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
      defaultModel: "gemini-3.6-flash",
      fallbackModelIds: [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
      ],
      models: [
        namedModel("gemini-3.6-flash", "Gemini 3.6 Flash"),
        namedModel("gemini-3.5-flash", "Gemini 3.5 Flash"),
        namedModel("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite"),
      ],
      languages: ["en", "de", "uk", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja"],
      languageNote: "AI Studio keys transcribe recorded speech with Gemini.",
    },
    tts: {
      support: "provider",
      transport: "gemini",
      endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
      defaultModel: "gemini-3.1-flash-tts-preview",
      fallbackModelIds: [
        "gemini-3.1-flash-tts-preview",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
      ],
      defaultVoice: "Kore",
      voiceFallback: "Kore",
      models: [
        withInstructions(namedModel("gemini-3.1-flash-tts-preview", "Gemini 3.1 Flash TTS Preview")),
        withInstructions(namedModel("gemini-2.5-flash-preview-tts", "Gemini 2.5 Flash Preview TTS")),
        withInstructions(namedModel("gemini-2.5-pro-preview-tts", "Gemini 2.5 Pro Preview TTS")),
      ],
      languages: ["en", "de", "uk", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja", "hu", "cs", "pl", "tr", "sv", "ur"],
      voiceOptions: [
        voice("Zephyr", "Zephyr · Bright", { de: "Zephyr · Klar" }),
        voice("Puck", "Puck · Upbeat", { de: "Puck · Schwungvoll" }),
        voice("Charon", "Charon · Informative", { de: "Charon · Informativ" }),
        voice("Kore", "Kore · Firm", { de: "Kore · Bestimmt" }),
        voice("Fenrir", "Fenrir · Excitable", { de: "Fenrir · Temperamentvoll" }),
        voice("Leda", "Leda · Youthful", { de: "Leda · Jugendlich" }),
        voice("Orus", "Orus · Firm", { de: "Orus · Bestimmt" }),
        voice("Aoede", "Aoede · Breezy", { de: "Aoede · Leicht" }),
        voice("Callirrhoe", "Callirrhoe · Easy-going", { de: "Callirrhoe · Gelassen" }),
        voice("Autonoe", "Autonoe · Bright", { de: "Autonoe · Klar" }),
        voice("Enceladus", "Enceladus · Breathy", { de: "Enceladus · Hauchig" }),
        voice("Iapetus", "Iapetus · Clear", { de: "Iapetus · Klar" }),
        voice("Umbriel", "Umbriel · Easy-going", { de: "Umbriel · Gelassen" }),
        voice("Algieba", "Algieba · Smooth", { de: "Algieba · Sanft" }),
        voice("Despina", "Despina · Smooth", { de: "Despina · Sanft" }),
        voice("Erinome", "Erinome · Clear", { de: "Erinome · Klar" }),
        voice("Algenib", "Algenib · Gravelly", { de: "Algenib · Rau" }),
        voice("Rasalgethi", "Rasalgethi · Informative", { de: "Rasalgethi · Informativ" }),
        voice("Laomedeia", "Laomedeia · Upbeat", { de: "Laomedeia · Schwungvoll" }),
        voice("Achernar", "Achernar · Soft", { de: "Achernar · Weich" }),
        voice("Alnilam", "Alnilam · Firm", { de: "Alnilam · Bestimmt" }),
        voice("Schedar", "Schedar · Even", { de: "Schedar · Gleichmaessig" }),
        voice("Gacrux", "Gacrux · Mature", { de: "Gacrux · Reif" }),
        voice("Pulcherrima", "Pulcherrima · Forward", { de: "Pulcherrima · Direkt" }),
        voice("Achird", "Achird · Friendly", { de: "Achird · Freundlich" }),
        voice("Zubenelgenubi", "Zubenelgenubi · Casual", { de: "Zubenelgenubi · Locker" }),
        voice("Vindemiatrix", "Vindemiatrix · Gentle", { de: "Vindemiatrix · Sanft" }),
        voice("Sadachbia", "Sadachbia · Lively", { de: "Sadachbia · Lebhaft" }),
        voice("Sadaltager", "Sadaltager · Knowledgeable", { de: "Sadaltager · Kenntnisreich" }),
        voice("Sulafat", "Sulafat · Warm", { de: "Sulafat · Warm" }),
      ],
      languageNote:
        "Gemini TTS currently supports Arabic, Bengali, Czech, Dutch, English, French, German, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Mandarin Chinese, Polish, Portuguese, Romanian, Russian, Spanish, Swedish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, and Vietnamese.",
    },
  },
  xai: {
    appProvider: "xai",
    catalogProviderId: "xai",
    label: "xAI",
    shortLabel: "XAI",
    apiKeyPlaceholder: "xai-...",
    apiKeyHint: "Unlocks Grok models plus xAI voice APIs.",
    apiKeyUrl: "https://console.x.ai/team/default/api-keys",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "openai-compatible",
      endpoint: "https://api.x.ai/v1/chat/completions",
      defaultModel: "grok-4.6",
      fallbackModelIds: ["grok-4.6", "grok-4.5", "grok-4.3"],
      models: [
        withEffort(model("grok-4.6"), XAI_GROK_46_EFFORT),
        withEffort(model("grok-4.5"), XAI_GROK_45_EFFORT),
        withEffort(model("grok-4.3"), XAI_GROK_43_EFFORT),
      ],
    },
    stt: {
      support: "provider",
      transport: "xai-stt-rest",
      endpoint: "https://api.x.ai/v1/stt",
      defaultModel: "grok-stt",
      fallbackModelIds: ["grok-stt"],
      models: catalogModelSpecs("xai", "stt", ["voice-agent-api"]),
      languages: ["en", "de", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "ar", "ja"],
      languageNote: "xAI speech input uses the standalone Grok Speech-to-Text endpoint for recorded audio.",
    },
    tts: {
      support: "provider",
      transport: "binary",
      endpoint: "https://api.x.ai/v1/tts",
      requestFormat: "grok-speech",
      defaultModel: "text-to-speech",
      fallbackModelIds: ["text-to-speech"],
      defaultVoice: "ara",
      voiceFallback: "ara",
      models: catalogModelSpecs("xai", "tts", ["grok-tts"]),
      languages: ["en", "de", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja", "tr"],
      voiceOptions: [
        voice("ara", "Ara · Warm", { de: "Ara · Warm" }),
        voice("eve", "Eve · Energetic", { de: "Eve · Energetisch" }),
        voice("leo", "Leo · Authoritative", { de: "Leo · Autoritaer" }),
        voice("rex", "Rex · Bold", { de: "Rex · Kraeftig" }),
        voice("sal", "Sal · Smooth", { de: "Sal · Sanft" }),
      ],
      voiceDirectory: "xai",
      languageNote:
        "xAI TTS supports auto-detect plus 20 languages/locale variants including English, Arabic (EG/SA/AE), Bengali, Simplified Chinese, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Portuguese (BR/PT), Russian, Spanish (MX/ES), Turkish, and Vietnamese. Mr Broccoli loads built-in and account custom voices automatically. Inline expressive tags are supported: [laugh], [sigh], [pause], <whisper>.",
    },
  },
  deepseek: {
    appProvider: "deepseek",
    catalogProviderId: "deepseek",
    label: "DeepSeek",
    shortLabel: "DEEPSEEK",
    apiKeyPlaceholder: "sk-...",
    apiKeyHint: "Unlocks DeepSeek chat and reasoning models.",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    llm: {
      support: "provider",
      supportsImageInput: false,
      transport: "openai-compatible",
      endpoint: "https://api.deepseek.com/chat/completions",
      defaultModel: "deepseek-v4-flash",
      fallbackModelIds: ["deepseek-v4-flash", "deepseek-v4-pro"],
      models: [
        withEffort(namedModel("deepseek-v4-flash", "DeepSeek V4 Flash"), DEEPSEEK_THINKING_EFFORT),
        withEffort(namedModel("deepseek-v4-pro", "DeepSeek V4 Pro"), DEEPSEEK_THINKING_EFFORT),
      ],
    },
    stt: { support: "none", transport: "none", models: [] },
    tts: { support: "none", transport: "none", models: [], voiceOptions: [] },
  },
  mistral: {
    appProvider: "mistral",
    catalogProviderId: "mistral-ai",
    label: "Mistral",
    shortLabel: "MISTRAL",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks Mistral hosted models.",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "openai-compatible",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      defaultModel: "mistral-medium-3-5",
      fallbackModelIds: ["mistral-medium-3-5", "mistral-small-2603", "mistral-large-2512"],
      models: [
        withEffort(namedModel("mistral-medium-3-5", "Mistral Medium 3.5"), MISTRAL_ADJUSTABLE_REASONING_EFFORT),
        withEffort(model("mistral-small-2603"), MISTRAL_ADJUSTABLE_REASONING_EFFORT),
        model("mistral-large-2512"),
        model("ministral-14b-2512"),
        model("ministral-8b-2512"),
        model("ministral-3b-2512"),
      ],
    },
    stt: {
      support: "provider",
      transport: "multipart",
      endpoint: "https://api.mistral.ai/v1/audio/transcriptions",
      defaultModel: "voxtral-mini-2602",
      fallbackModelIds: ["voxtral-mini-2602"],
      models: [namedModel("voxtral-mini-2602", "Voxtral Mini Transcribe 2")],
      languages: ["en", "de", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja"],
      languageNote: "The current Voxtral Mini Transcribe 2 route supports English, Chinese, Hindi, Spanish, Arabic, French, Portuguese, Russian, German, Japanese, Korean, Italian, and Dutch.",
    },
    tts: {
      support: "provider",
      transport: "binary",
      endpoint: "https://api.mistral.ai/v1/audio/speech",
      requestFormat: "mistral-speech",
      defaultModel: "voxtral-mini-tts-2603",
      fallbackModelIds: ["voxtral-mini-tts-2603"],
      models: [namedModel("voxtral-mini-tts-2603", "Voxtral Mini TTS 26.03")],
      languages: ["en", "de", "hi", "es", "fr", "it", "pt", "pt-BR", "ar"],
      voiceOptions: [],
      voiceDirectory: "mistral",
      requiresVoice: true,
      languageNote: "Voxtral TTS supports English, French, Spanish, Portuguese, Italian, Dutch, German, Hindi, and Arabic. Mr Broccoli loads preset and custom voices from Mistral automatically.",
    },
  },
  elevenlabs: {
    appProvider: "elevenlabs",
    catalogProviderId: "elevenlabs",
    label: "ElevenLabs",
    shortLabel: "ELEVENLABS",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks ElevenLabs text-to-speech and Scribe speech-to-text. Voice read access is optional and only needed to load the account voice library.",
    apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
    llm: { support: "none", transport: "none", models: [] },
    stt: {
      support: "provider",
      transport: "multipart",
      endpoint: "https://api.elevenlabs.io/v1/speech-to-text",
      defaultModel: "scribe_v2",
      fallbackModelIds: ["scribe_v2"],
      models: [namedModel("scribe_v2", "Scribe v2")],
      languages: ["en", "de", "uk", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja", "hu", "cs", "pl", "tr", "sv", "ur"],
      languageNote: "Scribe v2 automatically detects and transcribes more than 90 languages.",
    },
    tts: {
      support: "provider",
      transport: "binary",
      endpoint: "https://api.elevenlabs.io/v1/text-to-speech",
      requestFormat: "elevenlabs-speech",
      defaultModel: "eleven_flash_v2_5",
      fallbackModelIds: ["eleven_flash_v2_5", "eleven_multilingual_v2", "eleven_v3"],
      defaultVoice: "21m00Tcm4TlvDq8ikWAM",
      voiceFallback: "21m00Tcm4TlvDq8ikWAM",
      models: [
        namedModel("eleven_flash_v2_5", "Eleven Flash v2.5"),
        namedModel("eleven_multilingual_v2", "Eleven Multilingual v2"),
        namedModel("eleven_v3", "Eleven v3"),
      ],
      languages: ["en", "de", "uk", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja", "cs", "pl", "tr", "sv"],
      voiceOptions: [
        voice("21m00Tcm4TlvDq8ikWAM", "Rachel (built-in)", { de: "Rachel (integriert)" }),
      ],
      voiceDirectory: "elevenlabs",
      requiresVoice: true,
      languageNote: "ElevenLabs Flash v2.5 supports 32 languages, Multilingual v2 supports 29, and Eleven v3 supports more than 70. Mr Broccoli uses a built-in premade voice when the configured key cannot read the account voice library.",
    },
  },
  "alibaba-qwen-dashscope": {
    appProvider: "alibaba-qwen-dashscope",
    catalogProviderId: "alibaba-qwen-dashscope",
    label: "Alibaba / Qwen",
    shortLabel: "QWEN",
    apiKeyPlaceholder: "Enter API key",
    apiKeyHint: "Unlocks Qwen models through DashScope. Select the same region in which the API key was created; regional keys are not interchangeable.",
    apiKeyUrl: "https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope",
    llm: {
      support: "provider",
      supportsImageInput: true,
      transport: "openai-compatible",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      defaultModel: "qwen3.6-flash-2026-04-16",
      fallbackModelIds: ["qwen3.6-flash-2026-04-16", "qwen3.7-plus-2026-05-26", "qwen3.5-flash-2026-02-23"],
      models: [
        withEffort(namedModel("qwen3.7-plus-2026-05-26", "Qwen3.7-Plus"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen3.7-max-2026-05-20", "Qwen3.7-Max"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen3.6-flash-2026-04-16", "Qwen3.6-Flash"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen3.6-plus-2026-04-02", "Qwen3.6-Plus"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen3.5-plus-2026-02-15", "Qwen3.5-Plus"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen3.5-flash-2026-02-23", "Qwen3.5-Flash"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen-plus-2025-12-01", "Qwen-Plus"), QWEN_THINKING_EFFORT),
        withEffort(namedModel("qwen-flash-2025-07-28", "Qwen-Flash"), QWEN_THINKING_EFFORT),
      ],
    },
    stt: {
      support: "provider",
      transport: "openai-audio-input",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      defaultModel: "qwen3-asr-flash",
      fallbackModelIds: ["qwen3-asr-flash"],
      models: [model("qwen3-asr-flash")],
      languages: ["en", "de", "uk", "hi", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ar", "ja"],
      languageNote: "DashScope STT is limited to the simple Qwen3-ASR-Flash short-file transcription route. Long-file async transcription and realtime WebSocket ASR stay catalog-only to keep the app on straightforward BYOK flows.",
    },
    tts: {
      support: "provider",
      transport: "dashscope",
      endpoint: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      defaultModel: "qwen3-tts-flash",
      fallbackModelIds: ["qwen3-tts-flash", "qwen3-tts-instruct-flash"],
      defaultVoice: "Cherry",
      voiceFallback: "Cherry",
      models: [
        namedModel("qwen3-tts-flash", "Qwen3-TTS-Flash"),
        withInstructions(namedModel("qwen3-tts-instruct-flash", "Qwen3-TTS-Instruct-Flash")),
      ],
      languages: ["en", "de", "es", "fr", "it", "pt", "pt-BR", "ru", "zh-CN", "ja"],
      voiceOptions: [
        voice("Cherry", "Cherry · Bright and friendly"),
        voice("Serena", "Serena · Gentle"),
        voice("Ethan", "Ethan · Warm and energetic"),
        voice("Chelsie", "Chelsie · Animated"),
        voice("Momo", "Momo · Playful"),
        voice("Vivian", "Vivian · Confident"),
        voice("Moon", "Moon · Bold"),
        voice("Maia", "Maia · Gentle and thoughtful"),
        voice("Kai", "Kai · Soothing"),
        voice("Nofish", "Nofish · Casual"),
        voice("Bella", "Bella · Bubbly"),
        voice("Eldric Sage", "Eldric Sage · Wise and calm"),
        voice("Mia", "Mia · Soft"),
        voice("Mochi", "Mochi · Clever and youthful"),
        voice("Bellona", "Bellona · Powerful and clear"),
        voice("Vincent", "Vincent · Raspy and smoky"),
        voice("Bunny", "Bunny · Childlike"),
        voice("Neil", "Neil · Professional"),
        voice("Elias", "Elias · Educational"),
        voice("Arthur", "Arthur · Earthy storyteller"),
        voice("Nini", "Nini · Sweet"),
        voice("Seren", "Seren · Soothing"),
        voice("Pip", "Pip · Mischievous"),
        voice("Stella", "Stella · Dramatic"),
        voiceForModels("Jennifer", "Jennifer · Cinematic American", ["qwen3-tts-flash"]),
        voiceForModels("Ryan", "Ryan · Dramatic", ["qwen3-tts-flash"]),
        voiceForModels("Katerina", "Katerina · Mature", ["qwen3-tts-flash"]),
        voiceForModels("Aiden", "Aiden · American", ["qwen3-tts-flash"]),
        voiceForModels("Bodega", "Bodega · Passionate Spanish", ["qwen3-tts-flash"]),
        voiceForModels("Sonrisa", "Sonrisa · Cheerful Latin American", ["qwen3-tts-flash"]),
        voiceForModels("Alek", "Alek · Warm Russian", ["qwen3-tts-flash"]),
        voiceForModels("Dolce", "Dolce · Laid-back Italian", ["qwen3-tts-flash"]),
        voiceForModels("Sohee", "Sohee · Expressive Korean", ["qwen3-tts-flash"]),
        voiceForModels("Ono Anna", "Ono Anna · Spirited Japanese", ["qwen3-tts-flash"]),
        voiceForModels("Lenn", "Lenn · Rebellious German", ["qwen3-tts-flash"]),
        voiceForModels("Emilien", "Emilien · Romantic French", ["qwen3-tts-flash"]),
        voiceForModels("Andre", "Andre · Natural and steady", ["qwen3-tts-flash"]),
        voiceForModels("Radio Gol", "Radio Gol · Sports commentator", ["qwen3-tts-flash"]),
        voiceForModels("Jada", "Jada · Shanghainese", ["qwen3-tts-flash"]),
        voiceForModels("Dylan", "Dylan · Beijing", ["qwen3-tts-flash"]),
        voiceForModels("Li", "Li · Nanjing", ["qwen3-tts-flash"]),
        voiceForModels("Marcus", "Marcus · Shaanxi", ["qwen3-tts-flash"]),
        voiceForModels("Roy", "Roy · Southern Min", ["qwen3-tts-flash"]),
        voiceForModels("Peter", "Peter · Tianjin", ["qwen3-tts-flash"]),
        voiceForModels("Sunny", "Sunny · Sichuan", ["qwen3-tts-flash"]),
        voiceForModels("Eric", "Eric · Sichuan", ["qwen3-tts-flash"]),
        voiceForModels("Rocky", "Rocky · Cantonese", ["qwen3-tts-flash"]),
        voiceForModels("Kiki", "Kiki · Cantonese", ["qwen3-tts-flash"]),
      ],
      languageNote: "DashScope TTS is limited to the standard non-realtime Qwen3-TTS-Flash families. Mr Broccoli filters the official system voice library to the selected model; realtime and custom-voice rows stay catalog-only to keep the app on straightforward BYOK flows.",
    },
  },
};

export type RuntimeProviderManifest = typeof RUNTIME_PROVIDER_MANIFEST;
