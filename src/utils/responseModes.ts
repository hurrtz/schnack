import { PROVIDER_MODELS } from "../constants/models";
import {
  Provider,
  ResponseMode,
  ResponseModeRoute,
  Settings,
} from "../types";

export const RESPONSE_MODE_ORDER: ResponseMode[] = ["quick", "normal", "deep"];

export function getResponseModeRoute(
  settings: Settings,
  mode: ResponseMode = settings.activeResponseMode,
): ResponseModeRoute {
  return settings.responseModes[mode];
}

export function isResponseModeReady(
  settings: Settings,
  mode: ResponseMode,
): boolean {
  const route = getResponseModeRoute(settings, mode);
  return settings.apiKeys[route.provider].trim().length > 0;
}

export function getAvailableResponseModes(settings: Settings): ResponseMode[] {
  return RESPONSE_MODE_ORDER.filter((mode) => isResponseModeReady(settings, mode));
}

export function isValidModelForProvider(
  provider: Provider,
  model: string,
): boolean {
  return PROVIDER_MODELS[provider].some((entry) => entry.id === model);
}

export function getDefaultModelForProvider(provider: Provider): string {
  return PROVIDER_MODELS[provider][0]?.id ?? "";
}

export function getProviderValidationModel(
  settings: Settings,
  provider: Provider,
): string {
  const activeRoute = getResponseModeRoute(settings);

  if (activeRoute.provider === provider && activeRoute.model.trim()) {
    return activeRoute.model;
  }

  for (const mode of RESPONSE_MODE_ORDER) {
    const route = settings.responseModes[mode];

    if (route.provider === provider && route.model.trim()) {
      return route.model;
    }
  }

  return settings.providerModels[provider];
}
