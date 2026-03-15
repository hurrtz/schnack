import {
  PROVIDER_ORDER,
  PROVIDER_STT_SUPPORT,
  PROVIDER_TTS_SUPPORT,
} from "../constants/models";
import { Provider, Settings } from "../types";

function hasApiKey(settings: Settings, provider: Provider) {
  return !!settings.apiKeys[provider].trim();
}

export function getEnabledProviders(settings: Settings) {
  return PROVIDER_ORDER.filter((provider) => hasApiKey(settings, provider));
}

export function getEnabledSttProviders(settings: Settings) {
  return PROVIDER_ORDER.filter(
    (provider) =>
      PROVIDER_STT_SUPPORT[provider] === "provider" &&
      hasApiKey(settings, provider)
  );
}

export function getEnabledTtsProviders(settings: Settings) {
  return PROVIDER_ORDER.filter(
    (provider) =>
      PROVIDER_TTS_SUPPORT[provider] === "provider" &&
      hasApiKey(settings, provider)
  );
}
