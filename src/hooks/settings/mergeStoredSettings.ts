import {
  PROVIDER_DEFAULT_STT_MODELS,
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_ORDER,
  getProviderSttModelOptions,
  getProviderTtsModelOptions,
} from "../../constants/models";
import {
  type LocalTtsVoiceSelections,
  type Provider,
  type ProviderApiKeys,
  type ProviderModelSelections,
  type ProviderSttModelSelections,
  type ProviderTtsModelSelections,
  type ProviderTtsVoiceSelections,
  type ResponseMode,
  type ResponseModeRoute,
  type ResponseModeSelections,
  type Settings,
  DEFAULT_SETTINGS,
  getDefaultAssistantInstructions,
  getDefaultTtsListenLanguages,
} from "../../types";
import {
  getDefaultModelForProvider,
  isValidModelForProvider,
  RESPONSE_MODE_ORDER,
} from "../../utils/responseModes";
import {
  LEGACY_MODEL_FIELD_KEYS,
  type LegacyStoredSettings,
  type StoredProviderModels,
} from "./types";

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDER_ORDER.includes(value as Provider);
}

function isResponseMode(value: unknown): value is ResponseMode {
  return typeof value === "string" && RESPONSE_MODE_ORDER.includes(value as ResponseMode);
}

function extractStoredProviderModels(
  storedSettings?: LegacyStoredSettings,
): StoredProviderModels {
  if (!storedSettings) {
    return {};
  }

  return PROVIDER_ORDER.reduce((accumulator, provider) => {
    const providerModels = storedSettings.providerModels?.[provider];
    const legacyValue = storedSettings[LEGACY_MODEL_FIELD_KEYS[provider]];
    const value =
      typeof providerModels === "string" && providerModels
        ? providerModels
        : typeof legacyValue === "string" && legacyValue
          ? legacyValue
          : undefined;

    if (value) {
      accumulator[provider] = value;
    }

    return accumulator;
  }, {} as StoredProviderModels);
}

function extractStoredProviderTtsVoices(
  storedSettings?: LegacyStoredSettings,
): Partial<ProviderTtsVoiceSelections> {
  if (!storedSettings) {
    return {};
  }

  const storedProviderVoices =
    (storedSettings.providerTtsVoices as Partial<ProviderTtsVoiceSelections> | undefined) ??
    {};
  const legacyTtsVoice =
    typeof storedSettings.ttsVoice === "string" && storedSettings.ttsVoice
      ? storedSettings.ttsVoice
      : undefined;

  return PROVIDER_ORDER.reduce((accumulator, provider) => {
    const providerVoice = storedProviderVoices[provider];
    const value =
      typeof providerVoice === "string" && providerVoice
        ? providerVoice
        : provider === "openai" && legacyTtsVoice
          ? legacyTtsVoice
          : undefined;

    if (value) {
      accumulator[provider] = value;
    }

    return accumulator;
  }, {} as Partial<ProviderTtsVoiceSelections>);
}

function extractStoredProviderTtsModels(
  storedSettings?: LegacyStoredSettings,
): Partial<ProviderTtsModelSelections> {
  if (!storedSettings?.providerTtsModels) {
    return {};
  }

  return Object.entries(storedSettings.providerTtsModels).reduce(
    (accumulator, [provider, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[provider as Provider] = value.trim();
      }

      return accumulator;
    },
    {} as Partial<ProviderTtsModelSelections>,
  );
}

function extractStoredProviderSttModels(
  storedSettings?: LegacyStoredSettings,
): Partial<ProviderSttModelSelections> {
  if (!storedSettings?.providerSttModels) {
    return {};
  }

  return Object.entries(storedSettings.providerSttModels).reduce(
    (accumulator, [provider, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[provider as Provider] = value.trim();
      }

      return accumulator;
    },
    {} as Partial<ProviderSttModelSelections>,
  );
}

function extractStoredLocalTtsVoices(
  storedSettings?: LegacyStoredSettings,
): Partial<LocalTtsVoiceSelections> {
  if (!storedSettings?.localTtsVoices) {
    return {};
  }

  return Object.entries(storedSettings.localTtsVoices).reduce(
    (accumulator, [language, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[language as keyof LocalTtsVoiceSelections] = value.trim();
      }

      return accumulator;
    },
    {} as Partial<LocalTtsVoiceSelections>,
  );
}

function getLegacyResponseModeRoute(
  storedSettings: LegacyStoredSettings | undefined,
  providerModels: ProviderModelSelections,
): ResponseModeRoute {
  const provider = isProvider(storedSettings?.lastProvider)
    ? storedSettings.lastProvider
    : DEFAULT_SETTINGS.lastProvider;
  const providerModel = providerModels[provider];

  return {
    provider,
    model: isValidModelForProvider(provider, providerModel)
      ? providerModel
      : getDefaultModelForProvider(provider),
  };
}

function extractStoredResponseModes(
  storedSettings: LegacyStoredSettings | undefined,
  providerModels: ProviderModelSelections,
): Partial<ResponseModeSelections> {
  const storedResponseModes = storedSettings?.responseModes;

  if (!storedResponseModes || typeof storedResponseModes !== "object") {
    return {};
  }

  return RESPONSE_MODE_ORDER.reduce((accumulator, mode) => {
    const entry = storedResponseModes[mode];

    if (!entry || typeof entry !== "object") {
      return accumulator;
    }

    const provider = isProvider(entry.provider) ? entry.provider : undefined;

    if (!provider) {
      return accumulator;
    }

    const fallbackModel = providerModels[provider] || getDefaultModelForProvider(provider);
    const model =
      typeof entry.model === "string" && isValidModelForProvider(provider, entry.model)
        ? entry.model
        : isValidModelForProvider(provider, fallbackModel)
          ? fallbackModel
          : getDefaultModelForProvider(provider);

    accumulator[mode] = {
      provider,
      model,
    };

    return accumulator;
  }, {} as Partial<ResponseModeSelections>);
}

export function mergeSettings(
  storedSettings?: LegacyStoredSettings,
  storedApiKeys?: Partial<ProviderApiKeys>,
): Settings {
  const replyPlayback =
    storedSettings?.replyPlayback ??
    storedSettings?.ttsPlayback ??
    DEFAULT_SETTINGS.replyPlayback;
  const language = storedSettings?.language ?? DEFAULT_SETTINGS.language;
  const storedTtsListenLanguages = Array.isArray(storedSettings?.ttsListenLanguages)
    ? storedSettings.ttsListenLanguages.filter(
        (value): value is Settings["ttsListenLanguages"][number] =>
          typeof value === "string" && value.length > 0,
      )
    : [];
  const assistantInstructions =
    typeof storedSettings?.assistantInstructions === "string" &&
    storedSettings.assistantInstructions.trim()
      ? storedSettings.assistantInstructions
      : getDefaultAssistantInstructions(language);
  const mergedApiKeys = {
    ...DEFAULT_SETTINGS.apiKeys,
    ...(storedSettings?.apiKeys ?? {}),
    ...storedApiKeys,
  };
  const mergedProviderModels = {
    ...DEFAULT_SETTINGS.providerModels,
    ...extractStoredProviderModels(storedSettings),
  };
  const mergedProviderSttModels = {
    ...DEFAULT_SETTINGS.providerSttModels,
    ...extractStoredProviderSttModels(storedSettings),
  };
  const mergedProviderTtsModels = {
    ...DEFAULT_SETTINGS.providerTtsModels,
    ...extractStoredProviderTtsModels(storedSettings),
  };

  for (const provider of PROVIDER_ORDER) {
    const supportedSttModels = getProviderSttModelOptions(provider);

    if (supportedSttModels.length > 0) {
      const fallbackSttModel =
        PROVIDER_DEFAULT_STT_MODELS[provider] ?? supportedSttModels[0]?.id ?? "";

      if (
        mergedProviderSttModels[provider] &&
        !supportedSttModels.some((model) => model.id === mergedProviderSttModels[provider])
      ) {
        mergedProviderSttModels[provider] = fallbackSttModel;
      }
    }

    const supportedTtsModels = getProviderTtsModelOptions(provider);

    if (supportedTtsModels.length > 0) {
      const fallbackTtsModel =
        PROVIDER_DEFAULT_TTS_MODELS[provider] ?? supportedTtsModels[0]?.id ?? "";

      if (
        mergedProviderTtsModels[provider] &&
        !supportedTtsModels.some((model) => model.id === mergedProviderTtsModels[provider])
      ) {
        mergedProviderTtsModels[provider] = fallbackTtsModel;
      }
    }
  }

  const legacyResponseModeRoute = getLegacyResponseModeRoute(
    storedSettings,
    mergedProviderModels,
  );
  const extractedResponseModes = extractStoredResponseModes(
    storedSettings,
    mergedProviderModels,
  );
  const hasStoredResponseModes = RESPONSE_MODE_ORDER.some(
    (mode) => !!extractedResponseModes[mode],
  );
  const hasConfiguredKeys = Object.values(mergedApiKeys).some(
    (apiKey) => apiKey.trim().length > 0,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    language,
    replyPlayback,
    ttsListenLanguages:
      storedTtsListenLanguages.length > 0
        ? storedTtsListenLanguages
        : getDefaultTtsListenLanguages(language),
    setupGuideDismissed:
      typeof storedSettings?.setupGuideDismissed === "boolean"
        ? storedSettings.setupGuideDismissed
        : hasConfiguredKeys,
    assistantInstructions,
    activeResponseMode: isResponseMode(storedSettings?.activeResponseMode)
      ? storedSettings.activeResponseMode
      : DEFAULT_SETTINGS.activeResponseMode,
    responseModes:
      !storedSettings
        ? DEFAULT_SETTINGS.responseModes
        : hasStoredResponseModes
          ? {
              ...DEFAULT_SETTINGS.responseModes,
              ...extractedResponseModes,
            }
          : {
              quick: legacyResponseModeRoute,
              normal: legacyResponseModeRoute,
              deep: legacyResponseModeRoute,
            },
    providerModels: mergedProviderModels,
    providerSttModels: mergedProviderSttModels,
    providerTtsModels: mergedProviderTtsModels,
    providerTtsVoices: {
      ...DEFAULT_SETTINGS.providerTtsVoices,
      ...extractStoredProviderTtsVoices(storedSettings),
    },
    localTtsVoices: {
      ...DEFAULT_SETTINGS.localTtsVoices,
      ...extractStoredLocalTtsVoices(storedSettings),
    },
    apiKeys: mergedApiKeys,
  };
}
