import type { TtsListenLanguage } from "../../types";
import type { LocalTtsVerification } from "./constants";

const verificationCache = new Map<string, LocalTtsVerification>();

export function getLocalTtsVerificationCacheKey(
  language: TtsListenLanguage,
  voice: string,
) {
  return `${language}:${voice}`;
}

export function getLocalTtsVerification(
  language: TtsListenLanguage,
  voice: string,
) {
  return verificationCache.get(getLocalTtsVerificationCacheKey(language, voice));
}

export function setLocalTtsVerification(
  language: TtsListenLanguage,
  voice: string,
  verification: LocalTtsVerification,
) {
  verificationCache.set(
    getLocalTtsVerificationCacheKey(language, voice),
    verification,
  );
}

export function clearLocalTtsVerification(
  language: TtsListenLanguage,
  voice: string,
) {
  verificationCache.delete(
    getLocalTtsVerificationCacheKey(language, voice),
  );
}
