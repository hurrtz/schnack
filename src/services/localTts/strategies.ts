import { exists as pathExists } from "@dr.pogodin/react-native-fs";
import {
  downloadModelByCategory,
  isModelDownloadedByCategory,
  ModelCategory,
  refreshModelsByCategory,
} from "react-native-sherpa-onnx/download";
import { LOCAL_TTS_SUPPORTED_LANGUAGES } from "../../constants/localTts";
import type { TtsListenLanguage } from "../../types";
import { writeWaveformFile, normalizeLocalTtsText } from "./audioFile";
import {
  ensureKokoroMultilingualModelRootPath,
  getInstalledKokoroMultilingualModelRootPath,
} from "./modelFiles";
import {
  getKokoroChineseVoiceConfig,
  getKokoroEnglishVoiceConfig,
  getLocalPackLanguageLabel,
  getSherpaVitsModelId,
  KOKORO_MULTILINGUAL_MODEL_ID,
  type RawLocalTtsInstallStatus,
  type SherpaVitsLanguage,
} from "./constants";
import {
  getKokoroMultilingualSession,
  getSherpaVitsSession,
} from "./sessions";

export interface LocalTtsStrategy {
  getInstallStatus: (
    voice: string,
  ) => Promise<{ supported: boolean; installed: boolean }>;
  install: (params: {
    voice: string;
    onProgress?: (progress: number) => void;
  }) => Promise<void>;
  synthesize: (params: { text: string; voice: string }) => Promise<string>;
}

async function installKokoroChineseVoicePack(params: {
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  if (!getKokoroChineseVoiceConfig(params.voice)) {
    throw new Error(
      "A local Simplified Chinese voice pack is not configured for this voice.",
    );
  }

  await refreshModelsByCategory(ModelCategory.Tts);
  await downloadModelByCategory(
    ModelCategory.Tts,
    KOKORO_MULTILINGUAL_MODEL_ID,
    {
      onProgress: (progress) => {
        params.onProgress?.(progress.percent / 100);
      },
    },
  );

  await ensureKokoroMultilingualModelRootPath("zh");
  params.onProgress?.(1);
}

async function installSherpaVitsVoicePack(params: {
  language: SherpaVitsLanguage;
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  const modelId = getSherpaVitsModelId(params.language, params.voice);

  if (!modelId) {
    throw new Error(
      `A local ${getLocalPackLanguageLabel(params.language)} voice pack is not configured for this voice.`,
    );
  }

  await refreshModelsByCategory(ModelCategory.Tts);
  await downloadModelByCategory(ModelCategory.Tts, modelId, {
    onProgress: (progress) => {
      params.onProgress?.(progress.percent / 100);
    },
  });

  params.onProgress?.(1);
}

async function synthesizeEngineSpeechToFile(params: {
  engine: any;
  text: string;
  sid: number;
  speed: number;
}) {
  if (typeof params.engine?.synthesizeToFile === "function") {
    return params.engine.synthesizeToFile({
      text: params.text,
      sid: params.sid,
      speed: params.speed,
    });
  }

  const audio = await params.engine.generateSpeech(params.text, {
    sid: params.sid,
    speed: params.speed,
  });

  if (!audio?.samples || !audio?.sampleRate) {
    throw new Error("The local voice model did not return audio.");
  }

  return writeWaveformFile(Float32Array.from(audio.samples), audio.sampleRate);
}

function buildSherpaVitsStrategy(
  language: SherpaVitsLanguage,
): LocalTtsStrategy {
  return {
    getInstallStatus: async (voice) => {
      const modelId = getSherpaVitsModelId(language, voice);
      const modelInstalled = modelId
        ? await isModelDownloadedByCategory(ModelCategory.Tts, modelId)
        : false;

      return {
        supported: true,
        installed: modelInstalled,
        modelInstalled,
      };
    },
    install: async (params) => {
      await installSherpaVitsVoicePack({
        language,
        voice: params.voice,
        onProgress: params.onProgress,
      });
    },
    synthesize: async (params) => {
      return synthesizeSherpaVitsSpeech({
        language,
        text: params.text,
        voice: params.voice,
      });
    },
  };
}

async function synthesizeKokoroChineseSpeech(params: {
  text: string;
  voice: string;
}) {
  const voiceConfig = getKokoroChineseVoiceConfig(params.voice);

  if (!voiceConfig) {
    throw new Error(
      "A local Simplified Chinese voice pack is not configured for this voice.",
    );
  }

  const status = await getRawLocalTtsInstallStatus({
    language: "zh",
    voice: params.voice,
  });

  if (!status.installed) {
    throw new Error(
      "The Simplified Chinese local voice pack is not installed yet.",
    );
  }

  const sessionState = await getKokoroMultilingualSession("zh");
  return synthesizeEngineSpeechToFile({
    engine: sessionState.engine,
    text: normalizeLocalTtsText(params.text),
    sid: voiceConfig.sid,
    speed: 1,
  });
}

async function synthesizeSherpaVitsSpeech(params: {
  language: SherpaVitsLanguage;
  text: string;
  voice: string;
}) {
  const modelId = getSherpaVitsModelId(params.language, params.voice);
  const languageLabel = getLocalPackLanguageLabel(params.language);

  if (!modelId) {
    throw new Error(
      `A local ${languageLabel} voice pack is not configured for this voice.`,
    );
  }

  const status = await getRawLocalTtsInstallStatus({
    language: params.language,
    voice: params.voice,
  });

  if (!status.installed) {
    throw new Error(
      `The ${languageLabel} local voice pack is not installed yet.`,
    );
  }

  const sessionState = await getSherpaVitsSession(modelId);
  return synthesizeEngineSpeechToFile({
    engine: sessionState.engine,
    text: normalizeLocalTtsText(params.text),
    sid: 0,
    speed: 1,
  }).catch((error) => {
    throw new Error(
      error instanceof Error && error.message
        ? error.message
        : `The local ${languageLabel} voice model did not return audio.`,
    );
  });
}

export const LOCAL_TTS_STRATEGIES: Partial<
  Record<TtsListenLanguage, LocalTtsStrategy>
> = {
  en: {
    getInstallStatus: async (voice) => {
      const voiceConfig = getKokoroEnglishVoiceConfig(voice);
      const modelInstalled = await isModelDownloadedByCategory(
        ModelCategory.Tts,
        KOKORO_MULTILINGUAL_MODEL_ID,
      );
      const modelRootPath = modelInstalled
        ? await getInstalledKokoroMultilingualModelRootPath()
        : null;
      const defaultLexiconInstalled = modelRootPath
        ? await pathExists(`${modelRootPath}/lexicon.txt`)
        : false;

      return {
        supported: true,
        installed:
          !!voiceConfig &&
          modelInstalled &&
          !!modelRootPath &&
          defaultLexiconInstalled,
        modelInstalled,
        defaultLexiconInstalled,
      };
    },
    install: async (params) => {
      if (!getKokoroEnglishVoiceConfig(params.voice)) {
        throw new Error(
          "A local English voice pack is not configured for this voice.",
        );
      }

      await refreshModelsByCategory(ModelCategory.Tts);
      await downloadModelByCategory(
        ModelCategory.Tts,
        KOKORO_MULTILINGUAL_MODEL_ID,
        {
          onProgress: (progress) => params.onProgress?.(progress.percent / 100),
        },
      );

      await ensureKokoroMultilingualModelRootPath("en");
      params.onProgress?.(1);
    },
    synthesize: async (params) => {
      const voiceConfig = getKokoroEnglishVoiceConfig(params.voice);

      if (!voiceConfig) {
        throw new Error(
          "A local English voice pack is not configured for this voice.",
        );
      }

      const status = await getRawLocalTtsInstallStatus({
        language: "en",
        voice: params.voice,
      });

      if (!status.installed) {
        throw new Error("The local voice pack is not installed yet.");
      }

      const sessionState = await getKokoroMultilingualSession("en");
      return synthesizeEngineSpeechToFile({
        engine: sessionState.engine,
        text: normalizeLocalTtsText(params.text),
        sid: voiceConfig.sid,
        speed: 1,
      });
    },
  },
  de: buildSherpaVitsStrategy("de"),
  zh: {
    getInstallStatus: async (voice) => {
      const voiceConfig = getKokoroChineseVoiceConfig(voice);

      if (!voiceConfig) {
        return {
          supported: true,
          installed: false,
          modelInstalled: false,
        };
      }

      const modelInstalled = await isModelDownloadedByCategory(
        ModelCategory.Tts,
        KOKORO_MULTILINGUAL_MODEL_ID,
      );
      const modelRootPath = modelInstalled
        ? await getInstalledKokoroMultilingualModelRootPath()
        : null;
      const lexiconInstalled = modelRootPath
        ? await pathExists(`${modelRootPath}/lexicon-zh.txt`)
        : false;

      return {
        supported: true,
        installed: modelInstalled && !!modelRootPath && lexiconInstalled,
        modelInstalled,
        lexiconInstalled,
      };
    },
    install: async (params) => {
      await installKokoroChineseVoicePack({
        voice: params.voice,
        onProgress: params.onProgress,
      });
    },
    synthesize: async (params) => {
      return synthesizeKokoroChineseSpeech({
        text: params.text,
        voice: params.voice,
      });
    },
  },
  es: buildSherpaVitsStrategy("es"),
  pt: buildSherpaVitsStrategy("pt"),
  hi: buildSherpaVitsStrategy("hi"),
  fr: buildSherpaVitsStrategy("fr"),
  it: buildSherpaVitsStrategy("it"),
};

export async function getRawLocalTtsInstallStatus(params: {
  language: TtsListenLanguage;
  voice: string;
}): Promise<RawLocalTtsInstallStatus> {
  if (!LOCAL_TTS_SUPPORTED_LANGUAGES.includes(params.language)) {
    return {
      supported: false,
      installed: false,
    };
  }

  const strategy = LOCAL_TTS_STRATEGIES[params.language];

  if (!strategy) {
    return {
      supported: false,
      installed: false,
    };
  }

  return strategy.getInstallStatus(
    params.voice,
  ) as Promise<RawLocalTtsInstallStatus>;
}

export function getLocalTtsStrategy(language: TtsListenLanguage) {
  return LOCAL_TTS_STRATEGIES[language];
}
