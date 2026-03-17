import type { AppLanguage, TtsListenLanguage } from "../types";

export const TTS_LISTEN_LANGUAGE_OPTIONS: TtsListenLanguage[] = [
  "en",
  "de",
  "zh",
  "es",
  "pt",
  "hi",
  "fr",
  "it",
  "ja",
];

export const LOCAL_TTS_SUPPORTED_LANGUAGES: TtsListenLanguage[] = [
  "en",
  "de",
  "zh",
];
export const LOCAL_TTS_KOKORO_MODEL_ID = "model_q8f16.onnx";
export const LOCAL_TTS_DEFAULT_VOICES: Record<TtsListenLanguage, string> = {
  en: "af_heart",
  de: "thorsten-medium",
  zh: "zf_xiaoxiao",
  es: "",
  pt: "",
  hi: "",
  fr: "",
  it: "",
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
  zh: [
    { value: "zf_xiaobei", label: "Kokoro Xiaobei" },
    { value: "zf_xiaoni", label: "Kokoro Xiaoni" },
    { value: "zf_xiaoxiao", label: "Kokoro Xiaoxiao" },
    { value: "zf_xiaoyi", label: "Kokoro Xiaoyi" },
    { value: "zm_yunjian", label: "Kokoro Yunjian" },
    { value: "zm_yunxi", label: "Kokoro Yunxi" },
    { value: "zm_yunxia", label: "Kokoro Yunxia" },
    { value: "zm_yunyang", label: "Kokoro Yunyang" },
  ],
  es: [],
  pt: [],
  hi: [],
  fr: [],
  it: [],
  ja: [],
};

const LANGUAGE_LABELS: Record<
  TtsListenLanguage,
  { en: string; de: string }
> = {
  en: { en: "English", de: "Englisch" },
  de: { en: "German", de: "Deutsch" },
  zh: { en: "Simplified Chinese", de: "Vereinfachtes Chinesisch" },
  es: { en: "Spanish", de: "Spanisch" },
  pt: { en: "Portuguese", de: "Portugiesisch" },
  hi: { en: "Hindi", de: "Hindi" },
  fr: { en: "French", de: "Franzoesisch" },
  it: { en: "Italian", de: "Italienisch" },
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
