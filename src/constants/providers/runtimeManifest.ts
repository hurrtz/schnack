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
