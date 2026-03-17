import { LOCAL_TTS_SUPPORTED_LANGUAGES } from "../constants/localTts";
import { AppLanguage, TtsListenLanguage } from "../types";

function detectScriptLanguage(text: string): TtsListenLanguage | null {
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja";
  }

  return null;
}

function scoreLanguage(text: string, language: TtsListenLanguage) {
  const normalized = ` ${text.toLowerCase()} `;

  if (language === "de") {
    let score = 0;

    if (/[äöüß]/i.test(text)) {
      score += 3;
    }

    for (const token of [" der ", " die ", " das ", " und ", " ich ", " nicht "]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "en") {
    let score = 0;

    for (const token of [" the ", " and ", " you ", " is ", " are ", " this "]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  return 0;
}

export function resolveTtsListenLanguage(params: {
  text: string;
  preferredLanguages?: TtsListenLanguage[];
  appLanguage: AppLanguage;
}) {
  const preferredLanguages =
    params.preferredLanguages && params.preferredLanguages.length > 0
      ? params.preferredLanguages
      : [params.appLanguage];

  if (preferredLanguages.length === 1) {
    return preferredLanguages[0];
  }

  const scriptLanguage = detectScriptLanguage(params.text);
  if (scriptLanguage && preferredLanguages.includes(scriptLanguage)) {
    return scriptLanguage;
  }

  const scoredLanguage = preferredLanguages
    .map((language) => ({
      language,
      score: scoreLanguage(params.text, language),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (scoredLanguage && scoredLanguage.score > 0) {
    return scoredLanguage.language;
  }

  return preferredLanguages[0];
}

export function supportsLocalTtsLanguage(language: TtsListenLanguage) {
  return LOCAL_TTS_SUPPORTED_LANGUAGES.includes(language);
}
