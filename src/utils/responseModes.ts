import {
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
} from "../constants/models";
import {
  DEFAULT_RESPONSE_MODE_COUNT,
  createResponseModeId,
} from "../constants/providers/defaults";
import {
  Provider,
  ResponseMode,
  ResponseModeConfig,
  ResponseModeRoute,
  ResponseModeSelections,
  Settings,
} from "../types";
import { normalizeResponseModeRouteEffort } from "./modelEffort";
import { hasProviderCredentialForCapability } from "./providerCredentials";
import { isRuntimeCapabilityConfigurationDisabled } from "../services/runtimeCapabilityOverrides";

export const LEGACY_RESPONSE_MODE_ORDER = ["quick", "normal", "deep"] as const;

const PROVIDER_MODEL_ALIAS_MIGRATIONS: Partial<
  Record<Provider, Record<string, string>>
> = {
  openai: {
    "gpt-5.5": "gpt-5.5-2026-04-23",
    "gpt-5.4": "gpt-5.4-2026-03-05",
    "gpt-5.4-mini": "gpt-5.4-mini-2026-03-17",
    "gpt-5.4-nano": "gpt-5.4-nano-2026-03-17",
    "gpt-4.1": "gpt-4.1-2025-04-14",
    "gpt-4.1-mini": "gpt-4.1-mini-2025-04-14",
    "gpt-realtime-2.1": "gpt-5.6-sol",
    "gpt-realtime-2.1-mini": "gpt-5.4-mini-2026-03-17",
  },
  "alibaba-qwen-dashscope": {
    "qwen3.7-plus": "qwen3.7-plus-2026-05-26",
    "qwen3.7-max": "qwen3.7-max-2026-05-20",
    "qwen3.6-flash": "qwen3.6-flash-2026-04-16",
    "qwen3.6-plus": "qwen3.6-plus-2026-04-02",
    "qwen3.5-plus": "qwen3.5-plus-2026-02-15",
    "qwen3.5-flash": "qwen3.5-flash-2026-02-23",
    "qwen-plus": "qwen-plus-2025-12-01",
    "qwen-flash": "qwen-flash-2025-07-28",
  },
  gemini: {
    "gemini-3.1-flash-live-preview": "gemini-2.5-flash",
  },
};

export function migrateProviderModelAlias(provider: Provider, model: string) {
  return PROVIDER_MODEL_ALIAS_MIGRATIONS[provider]?.[model] ?? model;
}

export function getResponseModeIds(
  modes: ResponseModeSelections,
): ResponseMode[] {
  return modes.map((mode) => mode.id);
}

export function getNextResponseModeId(modes: ResponseModeSelections) {
  const existingIds = new Set(getResponseModeIds(modes));
  let index = 0;
  while (true) {
    const id = createResponseModeId(index);
    if (!existingIds.has(id)) {
      return id;
    }
    index += 1;
  }
}

function getResponseModeRouteIdentity(route: ResponseModeRoute) {
  return `${route.provider}\u0000${route.model}\u0000${route.effort ?? ""}`;
}

export function getSuggestedResponseModeRoute(
  settings: Pick<Settings, "apiKeys" | "providerModels" | "responseModes">,
): ResponseModeRoute | undefined {
  const configuredProviders = PROVIDER_ORDER.filter((provider) =>
    hasProviderCredentialForCapability(
      provider,
      settings.apiKeys[provider],
      "llm",
    ),
  );
  const primaryCandidates = configuredProviders.map((provider) => {
    const storedModel = settings.providerModels[provider];
    const model = isValidModelForProvider(provider, storedModel)
      ? storedModel
      : getDefaultModelForProvider(provider);

    return normalizeResponseModeRouteEffort({ provider, model });
  });
  const secondaryCandidates = configuredProviders.flatMap((provider) => {
    const primaryModel = primaryCandidates.find(
      (route) => route.provider === provider,
    )?.model;

    return getProviderLlmModelOptions(provider)
      .filter(({ id }) => id !== primaryModel)
      .map(({ id: model }) =>
        normalizeResponseModeRouteEffort({ provider, model }),
      );
  });
  const usedRoutes = new Set(
    settings.responseModes.map(({ route }) =>
      getResponseModeRouteIdentity(route),
    ),
  );

  return [...primaryCandidates, ...secondaryCandidates].find(
    (route) => !usedRoutes.has(getResponseModeRouteIdentity(route)),
  );
}

/**
 * Derives a full set of response-mode routes ({@link ResponseModeSelections})
 * from a single provider's curated runtime LLM models.
 *
 * Modes map to distinct runtime model ids in picker order, up to `count`.
 * Providers with fewer curated models expose fewer modes instead of repeating
 * a route that looks like a separate choice. If the provider has no runtime
 * LLM models, the manifest default model id is used as a single fallback.
 *
 * Pure: no side effects, depends only on its argument and static runtime data.
 */
export function deriveResponseModesForProvider(
  provider: Provider,
  count = DEFAULT_RESPONSE_MODE_COUNT,
): ResponseModeSelections {
  const runtimeModelIds = Array.from(
    new Set(
      getProviderLlmModelOptions(provider)
        .map((model) => model.id)
        .filter((model) => model.trim().length > 0),
    ),
  );

  const fallbackModel = PROVIDER_DEFAULT_MODELS[provider] ?? "";
  const availableModelIds =
    runtimeModelIds.length > 0 ? runtimeModelIds : [fallbackModel];

  return availableModelIds.slice(0, Math.max(0, count)).map((model, index) => ({
    id: createResponseModeId(index),
    route: normalizeResponseModeRouteEffort({
      provider,
      model,
    }),
  }));
}

function getResponseModeEntry(
  modes: ResponseModeSelections,
  mode: ResponseMode,
): ResponseModeConfig | undefined {
  return modes.find((entry) => entry.id === mode);
}

export function getResponseModeRoute(
  settings: Pick<Settings, "activeResponseMode" | "responseModes">,
  mode: ResponseMode = settings.activeResponseMode,
): ResponseModeRoute {
  return (
    getResponseModeEntry(settings.responseModes, mode)?.route ??
    settings.responseModes[0]?.route
  );
}

export function isResponseModeReady(
  settings: Settings,
  mode: ResponseMode,
): boolean {
  const route = getResponseModeRoute(settings, mode);

  if (!route) {
    return false;
  }

  return (
    route.model.trim().length > 0 &&
    hasProviderCredentialForCapability(
      route.provider,
      settings.apiKeys[route.provider],
      "llm",
    )
  );
}

export function getAvailableResponseModes(settings: Settings): ResponseMode[] {
  return settings.responseModes
    .filter((entry) => isResponseModeReady(settings, entry.id))
    .map((entry) => entry.id);
}

export function isValidModelForProvider(
  provider: Provider,
  model: string,
): boolean {
  return getProviderLlmModelOptions(provider).some(
    (entry) => entry.id === model,
  );
}

export function getProviderLlmModelOptions(provider: Provider) {
  return PROVIDER_MODELS[provider].filter(
    (model) =>
      !isRuntimeCapabilityConfigurationDisabled({
        capability: "llm",
        model: model.id,
        provider,
      }),
  );
}

export function getDefaultModelForProvider(provider: Provider): string {
  const curatedDefault = PROVIDER_DEFAULT_MODELS[provider];
  const availableModels = getProviderLlmModelOptions(provider);

  if (isValidModelForProvider(provider, curatedDefault)) {
    return curatedDefault;
  }

  return availableModels[0]?.id ?? "";
}

export function getProviderValidationModel(
  settings: Settings,
  provider: Provider,
): string {
  // Gemini's older models can remain user-selectable for accounts that still
  // have access, but they must not make a newly entered key look invalid.
  // Validate the provider connection against the current curated default.
  if (provider === "gemini") {
    return getDefaultModelForProvider(provider);
  }

  const activeRoute = getResponseModeRoute(settings);

  if (activeRoute?.provider === provider && activeRoute.model.trim()) {
    return activeRoute.model;
  }

  for (const { route } of settings.responseModes) {
    if (route.provider === provider && route.model.trim()) {
      return route.model;
    }
  }

  return settings.providerModels[provider];
}
