import { LOCAL_TTS_SUPPORTED_LANGUAGES } from "../constants/localTts";
import { AppLanguage, TtsListenLanguage } from "../types";

function detectScriptLanguage(text: string): TtsListenLanguage | null {
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja";
  }

  if (/[\u0900-\u097f]/.test(text)) {
    return "hi";
  }

  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh";
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

  if (language === "zh") {
    let score = /[\u4e00-\u9fff]/.test(text) ? 2 : 0;

    for (const token of ["的", "了", "是", "我", "你", "不"]) {
      if (text.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "ja") {
    let score = /[\u3040-\u30ff]/.test(text) ? 3 : 0;

    for (const token of ["です", "ます", "ない", "して", "この", "その"]) {
      if (text.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "hi") {
    let score = /[\u0900-\u097f]/.test(text) ? 2 : 0;

    for (const token of [" है ", " और ", " नहीं ", " मैं ", " क्या ", " यह "]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "es") {
    let score = /[áéíóúñ¡¿]/i.test(text) ? 2 : 0;

    for (const token of [" el ", " la ", " que ", " de ", " y ", " no "]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "pt") {
    let score = /[ãõçáéíóú]/i.test(text) ? 2 : 0;

    for (const token of [
      " não ",
      " nao ",
      " você ",
      " voce ",
      " que ",
      " de ",
      " uma ",
      " para ",
    ]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "fr") {
    let score = /[àâçéèêëîïôùûüÿœæ]/i.test(text) ? 2 : 0;

    for (const token of [" le ", " la ", " de ", " je ", " pas ", " est "]) {
      if (normalized.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  if (language === "it") {
    let score = /[àèéìíîòóù]/i.test(text) ? 1 : 0;

    for (const token of [" il ", " che ", " non ", " una ", " per ", " con "]) {
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
