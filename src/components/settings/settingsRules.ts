import {
  getLocalTtsVoiceOptions,
} from "../../constants/localTts";
import {
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_DEFAULT_TTS_VOICES,
  getProviderSttModelOptions,
  getProviderTtsModelOptions,
  getProviderTtsVoiceOptions,
} from "../../constants/models";
import {
  Provider,
  ProviderSttModelSelections,
  ProviderTtsModelSelections,
  ProviderTtsVoiceSelections,
  ResponseModeSelections,
  Settings,
} from "../../types";
import {
  getDefaultModelForProvider,
  isValidModelForProvider,
  RESPONSE_MODE_ORDER,
} from "../../utils/responseModes";

export function getNormalizedSttProvider(
  settings: Settings,
  enabledSttProviders: Provider[],
) {
  if (settings.sttMode !== "provider") {
    return null;
  }

  const nextProvider =
    settings.sttProvider && enabledSttProviders.includes(settings.sttProvider)
      ? settings.sttProvider
      : (enabledSttProviders[0] ?? null);

  return nextProvider !== settings.sttProvider ? nextProvider : null;
}

export function getNormalizedResponseModes(
  settings: Settings,
  enabledProviders: Provider[],
): ResponseModeSelections | null {
  if (enabledProviders.length === 0) {
    return null;
  }

  let changed = false;
  const nextResponseModes = { ...settings.responseModes };

  for (const mode of RESPONSE_MODE_ORDER) {
    const currentRoute = settings.responseModes[mode];

    if (enabledProviders.includes(currentRoute.provider)) {
      continue;
    }

    const nextProvider = enabledProviders[0];
    const preferredModel = settings.providerModels[nextProvider];
    const nextModel = isValidModelForProvider(nextProvider, preferredModel)
      ? preferredModel
      : getDefaultModelForProvider(nextProvider);

    nextResponseModes[mode] = {
      provider: nextProvider,
      model: nextModel,
    };
    changed = true;
  }

  return changed ? nextResponseModes : null;
}

export function getNormalizedTtsProvider(
  settings: Settings,
  enabledTtsProviders: Provider[],
) {
  if (settings.ttsMode === "native") {
    return null;
  }

  const nextProvider =
    settings.ttsProvider && enabledTtsProviders.includes(settings.ttsProvider)
      ? settings.ttsProvider
      : (enabledTtsProviders[0] ?? null);

  return nextProvider !== settings.ttsProvider ? nextProvider : null;
}

export function getNormalizedProviderSttModels(
  settings: Settings,
  enabledSttProviders: Provider[],
): ProviderSttModelSelections | null {
  if (settings.sttMode !== "provider") {
    return null;
  }

  const nextProviderSttModels = { ...settings.providerSttModels };
  let changed = false;

  for (const provider of enabledSttProviders) {
    const supportedModels = getProviderSttModelOptions(provider);
    const defaultModel = supportedModels[0]?.id;

    if (!supportedModels.length || !defaultModel) {
      continue;
    }

    const currentModel = nextProviderSttModels[provider];
    const isValid = supportedModels.some((model) => model.id === currentModel);

    if (!isValid) {
      nextProviderSttModels[provider] = defaultModel;
      changed = true;
    }
  }

  return changed ? nextProviderSttModels : null;
}

export function getNormalizedProviderTtsModels(
  settings: Settings,
  enabledTtsProviders: Provider[],
): ProviderTtsModelSelections | null {
  const nextProviderTtsModels = { ...settings.providerTtsModels };
  let changed = false;

  for (const provider of enabledTtsProviders) {
    const supportedModels = getProviderTtsModelOptions(provider);
    const defaultModel =
      PROVIDER_DEFAULT_TTS_MODELS[provider] || supportedModels[0]?.id;

    if (!supportedModels.length || !defaultModel) {
      continue;
    }

    const currentModel = nextProviderTtsModels[provider];
    const isValid = supportedModels.some((model) => model.id === currentModel);

    if (!isValid) {
      nextProviderTtsModels[provider] = defaultModel;
      changed = true;
    }
  }

  return changed ? nextProviderTtsModels : null;
}

export function getNormalizedProviderTtsVoices(
  settings: Settings,
  enabledTtsProviders: Provider[],
  language: Settings["language"],
): ProviderTtsVoiceSelections | null {
  const nextProviderTtsVoices = { ...settings.providerTtsVoices };
  let changed = false;

  for (const provider of enabledTtsProviders) {
    const supportedVoices = getProviderTtsVoiceOptions(provider, language);
    const defaultVoice =
      PROVIDER_DEFAULT_TTS_VOICES[provider] || supportedVoices[0]?.id;

    if (!supportedVoices.length || !defaultVoice) {
      continue;
    }

    const currentVoice = nextProviderTtsVoices[provider];
    const isValid = supportedVoices.some((voice) => voice.id === currentVoice);

    if (!isValid) {
      nextProviderTtsVoices[provider] = defaultVoice;
      changed = true;
    }
  }

  return changed ? nextProviderTtsVoices : null;
}

export function getNormalizedLocalTtsVoices(settings: Settings) {
  const nextLocalTtsVoices = { ...settings.localTtsVoices };
  let changed = false;

  for (const selectedLanguage of settings.ttsListenLanguages) {
    const voiceOptions = getLocalTtsVoiceOptions(selectedLanguage);

    if (voiceOptions.length === 0) {
      continue;
    }

    const currentVoice = nextLocalTtsVoices[selectedLanguage];
    const isValid = voiceOptions.some((option) => option.value === currentVoice);

    if (!isValid) {
      nextLocalTtsVoices[selectedLanguage] = voiceOptions[0].value;
      changed = true;
    }
  }

  return changed ? nextLocalTtsVoices : null;
}
