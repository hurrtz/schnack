import type { AppLanguage, TtsListenLanguage } from "../types";

export const TTS_LISTEN_LANGUAGE_OPTIONS: TtsListenLanguage[] = [
  "en",
  "de",
  "es",
  "fr",
  "it",
  "pt",
  "ja",
];

export const LOCAL_TTS_SUPPORTED_LANGUAGES: TtsListenLanguage[] = ["en", "de"];
export const LOCAL_TTS_KOKORO_MODEL_ID = "model_q8f16.onnx";
export const LOCAL_TTS_DEFAULT_VOICES: Record<TtsListenLanguage, string> = {
  en: "af_heart",
  de: "thorsten-medium",
  es: "",
  fr: "",
  it: "",
  pt: "",
  ja: "",
};

export const LOCAL_TTS_VOICE_OPTIONS: Record<
  TtsListenLanguage,
  Array<{ value: string; label: string }>
> = {
  en: [
    { value: "af_heart", label: "Kokoro Heart" },
    { value: "af_bella", label: "Kokoro Bella" },
    { value: "bf_emma", label: "Kokoro Emma" },
    { value: "am_michael", label: "Kokoro Michael" },
  ],
  de: [
    { value: "thorsten-medium", label: "Piper Thorsten Medium" },
    { value: "kerstin-low", label: "Piper Kerstin Low" },
  ],
  es: [],
  fr: [],
  it: [],
  pt: [],
  ja: [],
};

const LANGUAGE_LABELS: Record<
  TtsListenLanguage,
  { en: string; de: string }
> = {
  en: { en: "English", de: "Englisch" },
  de: { en: "German", de: "Deutsch" },
  es: { en: "Spanish", de: "Spanisch" },
  fr: { en: "French", de: "Franzoesisch" },
  it: { en: "Italian", de: "Italienisch" },
  pt: { en: "Portuguese", de: "Portugiesisch" },
  ja: { en: "Japanese", de: "Japanisch" },
};

export function getTtsListenLanguageLabel(
  code: TtsListenLanguage,
  language: AppLanguage
) {
  return LANGUAGE_LABELS[code][language];
}

export function getLocalTtsVoiceOptions(language: TtsListenLanguage) {
  return LOCAL_TTS_VOICE_OPTIONS[language];
}
