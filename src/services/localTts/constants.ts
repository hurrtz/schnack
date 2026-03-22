import type { TtsListenLanguage } from "../../types";

export const KOKORO_MULTILINGUAL_MODEL_ID = "kokoro-multi-lang-v1_0";
export const LOCAL_TTS_IDLE_RELEASE_MS = 45000;

export const GERMAN_PIPER_MODEL_IDS = {
  "thorsten-medium": "vits-piper-de_DE-thorsten-medium",
  "kerstin-low": "vits-piper-de_DE-kerstin-low",
  "vits-piper-de_DE-thorsten-medium": "vits-piper-de_DE-thorsten-medium",
  "vits-piper-de_DE-kerstin-low": "vits-piper-de_DE-kerstin-low",
} as const;

export const KOKORO_CHINESE_VOICES = {
  zf_xiaobei: { sid: 24 },
  zf_xiaoni: { sid: 25 },
  zf_xiaoxiao: { sid: 26 },
  zf_xiaoyi: { sid: 27 },
  zm_yunjian: { sid: 28 },
  zm_yunxi: { sid: 29 },
  zm_yunxia: { sid: 30 },
  zm_yunyang: { sid: 31 },
} as const;

export const KOKORO_ENGLISH_VOICES = {
  af_heart: { sid: 3 },
  af_bella: { sid: 2 },
  bf_emma: { sid: 21 },
  am_michael: { sid: 16 },
} as const;

export const SHERPA_VITS_LANGUAGE_MODEL_IDS = {
  de: ["vits-piper-de_DE-thorsten-medium", "vits-piper-de_DE-kerstin-low"],
  es: ["vits-piper-es_ES-davefx-medium", "vits-piper-es_MX-claude-high"],
  pt: ["vits-piper-pt_BR-faber-medium", "vits-piper-pt_PT-tugao-medium"],
  hi: ["vits-piper-hi_IN-priyamvada-medium", "vits-piper-hi_IN-pratham-medium"],
  fr: ["vits-piper-fr_FR-siwis-medium", "vits-piper-fr_FR-tom-medium"],
  it: ["vits-piper-it_IT-paola-medium", "vits-piper-it_IT-dii-high"],
} as const;

export type SherpaVitsLanguage = keyof typeof SHERPA_VITS_LANGUAGE_MODEL_IDS;

export type RawLocalTtsInstallStatus = {
  supported: boolean;
  installed: boolean;
  [key: string]: unknown;
};

export type LocalTtsVerification = {
  verified: boolean;
  error: string | null;
};

export const LOCAL_TTS_VERIFY_SAMPLE_TEXT: Record<
  Exclude<TtsListenLanguage, "ja">,
  string
> = {
  en: "Hello",
  de: "Hallo",
  zh: "你好",
  es: "Hola",
  pt: "Ola",
  hi: "नमस्ते",
  fr: "Bonjour",
  it: "Ciao",
};

export function getKokoroChineseVoiceConfig(voice: string) {
  return (
    KOKORO_CHINESE_VOICES[voice as keyof typeof KOKORO_CHINESE_VOICES] ?? null
  );
}

export function getKokoroEnglishVoiceConfig(voice: string) {
  return (
    KOKORO_ENGLISH_VOICES[voice as keyof typeof KOKORO_ENGLISH_VOICES] ?? null
  );
}

export function isSherpaVitsLanguage(
  language: TtsListenLanguage,
): language is SherpaVitsLanguage {
  return language in SHERPA_VITS_LANGUAGE_MODEL_IDS;
}

export function getSherpaVitsModelId(
  language: SherpaVitsLanguage,
  voice: string,
) {
  if (language === "de") {
    return (
      GERMAN_PIPER_MODEL_IDS[
        voice as keyof typeof GERMAN_PIPER_MODEL_IDS
      ] ?? null
    );
  }

  return SHERPA_VITS_LANGUAGE_MODEL_IDS[language].some(
    (modelId) => modelId === voice,
  )
    ? voice
    : null;
}

export function getLocalPackLanguageLabel(language: TtsListenLanguage) {
  switch (language) {
    case "de":
      return "German";
    case "zh":
      return "Simplified Chinese";
    case "es":
      return "Spanish";
    case "pt":
      return "Portuguese";
    case "hi":
      return "Hindi";
    case "fr":
      return "French";
    case "it":
      return "Italian";
    case "ja":
      return "Japanese";
    default:
      return "English";
  }
}
