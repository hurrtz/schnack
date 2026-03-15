const TOGETHER_TTS_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "hi",
  "ja",
  "ko",
  "zh",
] as const;

const MISTRAL_STT_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "pt",
  "hi",
  "de",
  "nl",
  "it",
] as const;

function getResolvedLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}

function getLocaleLanguageCode() {
  return getResolvedLocale().split("-")[0]?.toLowerCase() || "en";
}

function detectScriptLanguageCode(text: string) {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  if (/[\u0590-\u05ff]/.test(text)) return "he";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0900-\u097f]/.test(text)) return "hi";
  if (/[\u0980-\u09ff]/.test(text)) return "bn";
  if (/[\u0e00-\u0e7f]/.test(text)) return "th";
  return null;
}

function pickSupportedLanguageCode(
  text: string,
  supportedCodes: readonly string[],
  fallback = "en"
) {
  const scriptCode = detectScriptLanguageCode(text);

  if (scriptCode && supportedCodes.includes(scriptCode)) {
    return scriptCode;
  }

  const localeCode = getLocaleLanguageCode();
  if (supportedCodes.includes(localeCode)) {
    return localeCode;
  }

  return fallback;
}

export function getTogetherTtsLanguageCode(text: string) {
  return pickSupportedLanguageCode(text, TOGETHER_TTS_LANGUAGE_CODES);
}

export function getMistralSttLanguageCode() {
  return pickSupportedLanguageCode("", MISTRAL_STT_LANGUAGE_CODES);
}

export function getDeviceLocale() {
  return getResolvedLocale();
}

export function getFileAudioMimeType(fileUri: string) {
  const normalized = fileUri.toLowerCase();

  if (normalized.endsWith(".wav")) {
    return "audio/wav";
  }
  if (normalized.endsWith(".mp3")) {
    return "audio/mp3";
  }
  if (normalized.endsWith(".aac")) {
    return "audio/aac";
  }
  if (normalized.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (normalized.endsWith(".flac")) {
    return "audio/flac";
  }
  if (normalized.endsWith(".aiff") || normalized.endsWith(".aif")) {
    return "audio/aiff";
  }
  if (normalized.endsWith(".m4a")) {
    return "audio/m4a";
  }

  return "application/octet-stream";
}
