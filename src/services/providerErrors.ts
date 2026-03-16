import { PROVIDER_LABELS } from "../constants/models";
import { translate } from "../i18n";
import { AppLanguage, Provider } from "../types";

type ProviderAction = "reply" | "transcription";

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractProviderErrorMessage(errorText: string) {
  const parsed = safeJsonParse(errorText);

  if (!parsed) {
    return errorText.replace(/\s+/g, " ").trim();
  }

  if (typeof parsed === "string") {
    return parsed.trim();
  }

  if (typeof parsed?.error?.message === "string") {
    return parsed.error.message.trim();
  }

  if (typeof parsed?.message === "string") {
    return parsed.message.trim();
  }

  if (Array.isArray(parsed?.errors)) {
    const firstMessage = parsed.errors.find(
      (entry: any) => typeof entry?.message === "string"
    )?.message;

    if (typeof firstMessage === "string") {
      return firstMessage.trim();
    }
  }

  return errorText.replace(/\s+/g, " ").trim();
}

function getActionLabel(language: AppLanguage, action: ProviderAction) {
  return action === "reply"
    ? translate(language, "replyGenerationAction")
    : translate(language, "speechTranscriptionAction");
}

function isNetworkFailure(error: Error) {
  const normalized = error.message.toLowerCase();

  return (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror")
  );
}

function isAuthenticationFailure(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    normalized.includes("invalid api key") ||
    normalized.includes("incorrect api key") ||
    normalized.includes("authentication") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  );
}

function isRateLimitFailure(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  return (
    status === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("quota")
  );
}

function isContextTooLongFailure(detail: string) {
  const normalized = detail.toLowerCase();

  return (
    normalized.includes("context length") ||
    normalized.includes("maximum context length") ||
    normalized.includes("too many tokens") ||
    normalized.includes("prompt is too long") ||
    normalized.includes("request too large")
  );
}

export function buildProviderHttpError(params: {
  provider: Provider;
  language: AppLanguage;
  status: number;
  errorText: string;
  action: ProviderAction;
}) {
  const providerLabel = PROVIDER_LABELS[params.provider];
  const actionLabel = getActionLabel(params.language, params.action);
  const detail = extractProviderErrorMessage(params.errorText);

  if (isAuthenticationFailure(params.status, detail)) {
    return new Error(
      translate(params.language, "providerAuthError", {
        provider: providerLabel,
        action: actionLabel,
      })
    );
  }

  if (isRateLimitFailure(params.status, detail)) {
    return new Error(
      translate(params.language, "providerRateLimitError", {
        provider: providerLabel,
        action: actionLabel,
      })
    );
  }

  if (params.action === "reply" && isContextTooLongFailure(detail)) {
    return new Error(
      translate(params.language, "providerContextTooLong", {
        provider: providerLabel,
      })
    );
  }

  if (params.status >= 500) {
    return new Error(
      translate(params.language, "providerTemporaryError", {
        provider: providerLabel,
        action: actionLabel,
      })
    );
  }

  return new Error(
    translate(params.language, "providerRequestRejected", {
      provider: providerLabel,
      action: actionLabel,
      detail,
    })
  );
}

export function normalizeProviderTransportError(params: {
  provider: Provider;
  language: AppLanguage;
  error: unknown;
  action: ProviderAction;
}) {
  if (params.error instanceof Error) {
    if (isNetworkFailure(params.error)) {
      return new Error(
        translate(params.language, "providerNetworkError", {
          provider: PROVIDER_LABELS[params.provider],
          action: getActionLabel(params.language, params.action),
        })
      );
    }

    return params.error;
  }

  return new Error(String(params.error));
}
