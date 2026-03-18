import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import {
  copyFile,
  exists as pathExists,
  readDir,
  unlink as unlinkPath,
} from "@dr.pogodin/react-native-fs";
import {
  downloadModelByCategory,
  getLocalModelPathByCategory,
  isModelDownloadedByCategory,
  ModelCategory,
  refreshModelsByCategory,
} from "react-native-sherpa-onnx/download";
import { LOCAL_TTS_SUPPORTED_LANGUAGES } from "../constants/localTts";
import type { TtsListenLanguage } from "../types";
import {
  createNativeLocalTtsEngine,
  isNativeLocalTtsAvailable,
  getNativeLocalTtsUnavailableReason,
} from "./nativeLocalTts";

const KOKORO_MULTILINGUAL_MODEL_ID = "kokoro-multi-lang-v1_0";
const LOCAL_TTS_IDLE_RELEASE_MS = 45000;

const GERMAN_PIPER_MODEL_IDS = {
  "thorsten-medium": "vits-piper-de_DE-thorsten-medium",
  "kerstin-low": "vits-piper-de_DE-kerstin-low",
  "vits-piper-de_DE-thorsten-medium": "vits-piper-de_DE-thorsten-medium",
  "vits-piper-de_DE-kerstin-low": "vits-piper-de_DE-kerstin-low",
} as const;

const KOKORO_CHINESE_VOICES = {
  zf_xiaobei: { sid: 24 },
  zf_xiaoni: { sid: 25 },
  zf_xiaoxiao: { sid: 26 },
  zf_xiaoyi: { sid: 27 },
  zm_yunjian: { sid: 28 },
  zm_yunxi: { sid: 29 },
  zm_yunxia: { sid: 30 },
  zm_yunyang: { sid: 31 },
} as const;

const KOKORO_ENGLISH_VOICES = {
  af_heart: { sid: 3 },
  af_bella: { sid: 2 },
  bf_emma: { sid: 21 },
  am_michael: { sid: 16 },
} as const;

const SHERPA_VITS_LANGUAGE_MODEL_IDS = {
  de: ["vits-piper-de_DE-thorsten-medium", "vits-piper-de_DE-kerstin-low"],
  es: ["vits-piper-es_ES-davefx-medium", "vits-piper-es_MX-claude-high"],
  pt: ["vits-piper-pt_BR-faber-medium", "vits-piper-pt_PT-tugao-medium"],
  hi: ["vits-piper-hi_IN-priyamvada-medium", "vits-piper-hi_IN-pratham-medium"],
  fr: ["vits-piper-fr_FR-siwis-medium", "vits-piper-fr_FR-tom-medium"],
  it: ["vits-piper-it_IT-paola-medium", "vits-piper-it_IT-dii-high"],
} as const;

type SherpaVitsLanguage = keyof typeof SHERPA_VITS_LANGUAGE_MODEL_IDS;
type RawLocalTtsInstallStatus = {
  supported: boolean;
  installed: boolean;
  [key: string]: unknown;
};

export type LocalTtsInstallStatus = {
  supported: boolean;
  downloaded: boolean;
  verified: boolean;
  installed: boolean;
  verificationError: string | null;
  [key: string]: unknown;
};

type SherpaSessionState = {
  engine: any;
  rootPath: string;
};

const sherpaSessionCache = new Map<
  string,
  Promise<SherpaSessionState> | SherpaSessionState
>();
const localTtsVerificationCache = new Map<
  string,
  { verified: boolean; error: string | null }
>();
let localTtsIdleReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

const LOCAL_TTS_VERIFY_SAMPLE_TEXT: Record<
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

function cancelLocalTtsIdleRelease() {
  if (localTtsIdleReleaseTimeout) {
    clearTimeout(localTtsIdleReleaseTimeout);
    localTtsIdleReleaseTimeout = null;
  }
}

function scheduleLocalTtsIdleRelease() {
  cancelLocalTtsIdleRelease();
  localTtsIdleReleaseTimeout = setTimeout(() => {
    void releaseLocalTtsResources();
  }, LOCAL_TTS_IDLE_RELEASE_MS);
}

function getLocalTtsRuntimeUnavailableReason() {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (!isNativeLocalTtsAvailable()) {
    return null;
  }

  return getNativeLocalTtsUnavailableReason();
}

function getKokoroChineseVoiceConfig(voice: string) {
  return (
    KOKORO_CHINESE_VOICES[voice as keyof typeof KOKORO_CHINESE_VOICES] ?? null
  );
}

function getKokoroEnglishVoiceConfig(voice: string) {
  return (
    KOKORO_ENGLISH_VOICES[voice as keyof typeof KOKORO_ENGLISH_VOICES] ?? null
  );
}

function isSherpaVitsLanguage(
  language: TtsListenLanguage,
): language is SherpaVitsLanguage {
  return language in SHERPA_VITS_LANGUAGE_MODEL_IDS;
}

function getSherpaVitsModelId(language: SherpaVitsLanguage, voice: string) {
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

function getLocalPackLanguageLabel(language: TtsListenLanguage) {
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

function getLocalTtsVerificationCacheKey(
  language: TtsListenLanguage,
  voice: string,
) {
  return `${language}:${voice}`;
}

function setLocalTtsVerification(
  language: TtsListenLanguage,
  voice: string,
  verification: { verified: boolean; error: string | null },
) {
  localTtsVerificationCache.set(
    getLocalTtsVerificationCacheKey(language, voice),
    verification,
  );
}

function clearLocalTtsVerification(language: TtsListenLanguage, voice: string) {
  localTtsVerificationCache.delete(
    getLocalTtsVerificationCacheKey(language, voice),
  );
}

async function directoryContainsFiles(path: string, files: string[]) {
  if (!(await pathExists(path))) {
    return false;
  }

  const entries = await readDir(path);
  const names = new Set(entries.map((entry) => entry.name));
  return files.every((file) => names.has(file));
}

async function findNestedDirectory(
  path: string,
  predicate: (candidate: string) => Promise<boolean>,
  depth = 0,
): Promise<string | null> {
  if (await predicate(path)) {
    return path;
  }

  if (depth >= 3 || !(await pathExists(path))) {
    return null;
  }

  const entries = await readDir(path);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const nested = await findNestedDirectory(entry.path, predicate, depth + 1);

    if (nested) {
      return nested;
    }
  }

  return null;
}

async function findModelFile(candidate: string) {
  if (!(await pathExists(candidate))) {
    return null;
  }

  const entries = await readDir(candidate);
  const match = entries.find(
    (entry) =>
      !entry.isDirectory() &&
      entry.name.endsWith(".onnx") &&
      !entry.name.endsWith(".onnx.json"),
  );

  return match?.path ?? null;
}

async function resolveSherpaVitsModelFiles(modelRootPath: string) {
  const resolvedRoot = await findNestedDirectory(
    modelRootPath,
    (candidate) =>
      directoryContainsFiles(candidate, ["tokens.txt", "espeak-ng-data"]),
  );

  if (!resolvedRoot) {
    throw new Error("The local voice pack files could not be resolved.");
  }

  const modelPath = await findModelFile(resolvedRoot);
  if (!modelPath) {
    throw new Error("The local voice model file is missing.");
  }

  const tokensPath = `${resolvedRoot}/tokens.txt`;
  const dataDirPath = `${resolvedRoot}/espeak-ng-data`;
  const lexiconPath = (await pathExists(`${resolvedRoot}/lexicon.txt`))
    ? `${resolvedRoot}/lexicon.txt`
    : undefined;

  return {
    modelPath,
    tokensPath,
    dataDirPath,
    lexiconPath,
  };
}

async function resolveKokoroModelFiles(rootPath: string) {
  const modelPath = await findModelFile(rootPath);

  if (!modelPath) {
    throw new Error("The Kokoro local model file is missing.");
  }

  const tokensPath = `${rootPath}/tokens.txt`;
  const dataDirPath = `${rootPath}/espeak-ng-data`;
  const voicesPath = `${rootPath}/voices.bin`;
  const lexiconPaths = [
    `${rootPath}/lexicon-us-en.txt`,
    `${rootPath}/lexicon-zh.txt`,
    `${rootPath}/lexicon.txt`,
  ];

  return {
    modelPath,
    tokensPath,
    dataDirPath,
    voicesPath,
    lexiconPaths,
  };
}

async function getInstalledKokoroMultilingualModelRootPath() {
  const basePath = await getLocalModelPathByCategory(
    ModelCategory.Tts,
    KOKORO_MULTILINGUAL_MODEL_ID,
  );

  if (!basePath) {
    return null;
  }

  return findNestedDirectory(basePath, (candidate) =>
    directoryContainsFiles(candidate, [
      "model.onnx",
      "voices.bin",
      "tokens.txt",
    ]),
  );
}

async function ensureKokoroMultilingualModelRootPath(language: "en" | "zh") {
  const rootPath = await getInstalledKokoroMultilingualModelRootPath();

  if (!rootPath) {
    throw new Error(
      "The Kokoro multilingual local voice pack is not installed yet.",
    );
  }

  const defaultLexiconPath = `${rootPath}/lexicon.txt`;
  const backupLexiconPath = `${rootPath}/lexicon-default.txt`;
  const chineseLexiconPath = `${rootPath}/lexicon-zh.txt`;

  if (
    !(await pathExists(backupLexiconPath)) &&
    (await pathExists(defaultLexiconPath))
  ) {
    await copyFile(defaultLexiconPath, backupLexiconPath);
  }

  if (language === "zh") {
    if (!(await pathExists(chineseLexiconPath))) {
      throw new Error(
        "The Simplified Chinese local voice pack is missing its lexicon.",
      );
    }

    if (await pathExists(defaultLexiconPath)) {
      await unlinkPath(defaultLexiconPath);
    }

    await copyFile(chineseLexiconPath, defaultLexiconPath);
    return rootPath;
  }

  if (await pathExists(backupLexiconPath)) {
    if (await pathExists(defaultLexiconPath)) {
      await unlinkPath(defaultLexiconPath);
    }

    await copyFile(backupLexiconPath, defaultLexiconPath);
  }

  return rootPath;
}

function bytesToBase64(bytes: Uint8Array) {
  const BufferCtor = (globalThis as any).Buffer;

  if (BufferCtor) {
    return BufferCtor.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }

  throw new Error("No base64 encoder available.");
}

function normalizeText(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/…/g, "...");
}

function buildWavBytes(floatArray: Float32Array, sampleRate: number) {
  const pcm16 = new Int16Array(floatArray.length);

  for (let index = 0; index < floatArray.length; index += 1) {
    pcm16[index] = Math.max(
      -32768,
      Math.min(32767, Math.floor(floatArray[index] * 32767)),
    );
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataLength = pcm16.length * 2;

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);

  const wavBytes = new Uint8Array(44 + dataLength);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(new Uint8Array(pcm16.buffer), 44);
  return wavBytes;
}

async function writeWaveformFile(floatArray: Float32Array, sampleRate: number) {
  const wavBytes = buildWavBytes(floatArray, sampleRate);
  const path = `${FileSystem.cacheDirectory}local-tts-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(wavBytes), {
    encoding: "base64",
  });
  return path;
}

async function getKokoroMultilingualSession(language: "en" | "zh") {
  cancelLocalTtsIdleRelease();
  const rootPath = await ensureKokoroMultilingualModelRootPath(language);
  const cacheKey = `${rootPath}::kokoro-${language}`;
  const cached = sherpaSessionCache.get(cacheKey);

  if (cached) {
    return cached instanceof Promise ? cached : cached;
  }

  const promise = (async () => {
    if (Platform.OS === "ios" && isNativeLocalTtsAvailable()) {
      const modelFiles = await resolveKokoroModelFiles(rootPath);
      const engine = await createNativeLocalTtsEngine({
        modelType: "kokoro",
        modelPath: modelFiles.modelPath,
        tokensPath: modelFiles.tokensPath,
        dataDirPath: modelFiles.dataDirPath,
        voicesPath: modelFiles.voicesPath,
        lexiconPaths: modelFiles.lexiconPaths,
        lang: language === "zh" ? "zh" : "us-en",
        numThreads: 2,
        debug: false,
        provider: "cpu",
      });

      return {
        engine,
        rootPath: cacheKey,
      };
    }

    const [{ createTTS }, { fileModelPath }] = await Promise.all([
      import("react-native-sherpa-onnx/tts"),
      import("react-native-sherpa-onnx"),
    ]);

    const engine = await createTTS({
      modelPath: fileModelPath(rootPath),
      modelType: "kokoro",
      numThreads: 2,
      debug: false,
    });

    return {
      engine,
      rootPath: cacheKey,
    };
  })()
    .then((state) => {
      sherpaSessionCache.set(cacheKey, state);
      return state;
    })
    .catch((error) => {
      sherpaSessionCache.delete(cacheKey);
      throw error;
    });

  sherpaSessionCache.set(cacheKey, promise);
  return promise;
}

async function getSherpaVitsSession(modelId: string) {
  cancelLocalTtsIdleRelease();
  const rootPath = await getLocalModelPathByCategory(
    ModelCategory.Tts,
    modelId,
  );

  if (!rootPath) {
    throw new Error("The local voice pack is not installed yet.");
  }

  const cached = sherpaSessionCache.get(rootPath);

  if (cached) {
    return cached instanceof Promise ? cached : cached;
  }

  const promise = (async () => {
    if (Platform.OS === "ios" && isNativeLocalTtsAvailable()) {
      const modelFiles = await resolveSherpaVitsModelFiles(rootPath);
      const engine = await createNativeLocalTtsEngine({
        modelType: "vits",
        modelPath: modelFiles.modelPath,
        tokensPath: modelFiles.tokensPath,
        dataDirPath: modelFiles.dataDirPath,
        lexiconPath: modelFiles.lexiconPath,
        numThreads: 2,
        debug: false,
        provider: "cpu",
      });

      return {
        engine,
        rootPath,
      };
    }

    const [{ createTTS }, { fileModelPath }] = await Promise.all([
      import("react-native-sherpa-onnx/tts"),
      import("react-native-sherpa-onnx"),
    ]);

    const engine = await createTTS({
      modelPath: fileModelPath(rootPath),
      modelType: "vits",
      numThreads: 2,
      debug: false,
    });

    return {
      engine,
      rootPath,
    };
  })()
    .then((state) => {
      sherpaSessionCache.set(rootPath, state);
      return state;
    })
    .catch((error) => {
      sherpaSessionCache.delete(rootPath);
      throw error;
    });

  sherpaSessionCache.set(rootPath, promise);
  return promise;
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

const LOCAL_TTS_STRATEGIES: Partial<
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
        text: normalizeText(params.text),
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

async function getRawLocalTtsInstallStatus(params: {
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
    text: normalizeText(params.text),
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
    text: normalizeText(params.text),
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

export async function verifyLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  force?: boolean;
}) {
  const cacheKey = getLocalTtsVerificationCacheKey(
    params.language,
    params.voice,
  );

  if (!params.force) {
    const cached = localTtsVerificationCache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const rawStatus = await getRawLocalTtsInstallStatus({
    language: params.language,
    voice: params.voice,
  });
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();

  if (unavailableReason) {
    const unsupportedOnDevice = {
      verified: false,
      error: unavailableReason,
    };
    setLocalTtsVerification(params.language, params.voice, unsupportedOnDevice);
    return unsupportedOnDevice;
  }

  if (!rawStatus.installed) {
    const missing = {
      verified: false,
      error: "The local voice pack is not installed yet.",
    };
    setLocalTtsVerification(params.language, params.voice, missing);
    return missing;
  }

  const strategy = LOCAL_TTS_STRATEGIES[params.language];

  if (!strategy || params.language === "ja") {
    const unsupported = {
      verified: false,
      error: "A local voice pack is not available for this language yet.",
    };
    setLocalTtsVerification(params.language, params.voice, unsupported);
    return unsupported;
  }

  const sampleText = LOCAL_TTS_VERIFY_SAMPLE_TEXT[params.language];

  try {
    const outputPath = await strategy.synthesize({
      text: sampleText,
      voice: params.voice,
    });
    const outputInfo = await FileSystem.getInfoAsync(outputPath);

    if (!outputInfo.exists) {
      throw new Error(
        "The local voice pack produced no audio during verification.",
      );
    }

    await FileSystem.deleteAsync(outputPath, {
      idempotent: true,
    }).catch(() => undefined);

    const success = {
      verified: true,
      error: null,
    };
    setLocalTtsVerification(params.language, params.voice, success);
    return success;
  } catch (error) {
    const failure = {
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : "The local voice pack could not be verified on this device.",
    };
    setLocalTtsVerification(params.language, params.voice, failure);
    return failure;
  }
}

export async function getLocalTtsInstallStatus(params: {
  language: TtsListenLanguage;
  voice: string;
}): Promise<LocalTtsInstallStatus> {
  const cacheKey = getLocalTtsVerificationCacheKey(
    params.language,
    params.voice,
  );
  const rawStatus = await getRawLocalTtsInstallStatus(params);
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();

  if (!rawStatus.supported) {
    return {
      ...rawStatus,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    };
  }

  if (unavailableReason) {
    return {
      ...rawStatus,
      downloaded: rawStatus.installed,
      verified: false,
      installed: false,
      verificationError: unavailableReason,
    };
  }

  if (!rawStatus.installed) {
    clearLocalTtsVerification(params.language, params.voice);
    return {
      ...rawStatus,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    };
  }

  const cachedVerification = localTtsVerificationCache.get(cacheKey);
  const verified = cachedVerification?.verified ?? false;
  const verificationError = cachedVerification?.error ?? null;

  return {
    ...rawStatus,
    downloaded: true,
    verified,
    installed: cachedVerification ? verified : true,
    verificationError,
  };
}

export async function installLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  const strategy = LOCAL_TTS_STRATEGIES[params.language];

  if (!strategy) {
    throw new Error(
      "A local voice pack is not available for this language yet.",
    );
  }

  await strategy.install({
    voice: params.voice,
    onProgress: params.onProgress,
  });

  clearLocalTtsVerification(params.language, params.voice);
}

export async function releaseLocalTtsResources() {
  cancelLocalTtsIdleRelease();

  const sherpaStates = Array.from(sherpaSessionCache.values());
  sherpaSessionCache.clear();

  const sherpaCleanup = sherpaStates.map(async (entry) => {
    try {
      const state = await entry;
      await state.engine.destroy?.();
    } catch {
      // Ignore teardown failures; battery wins matter more than perfect cleanup here.
    }
  });

  await Promise.all(sherpaCleanup);
}

export async function synthesizeLocalSpeech(params: {
  text: string;
  language: TtsListenLanguage;
  voice: string;
}) {
  try {
    const unavailableReason = getLocalTtsRuntimeUnavailableReason();
    if (unavailableReason) {
      throw new Error(unavailableReason);
    }

    const strategy = LOCAL_TTS_STRATEGIES[params.language];

    if (!strategy) {
      throw new Error(
        "A local voice pack is not available for this language yet.",
      );
    }

    const audioPath = await strategy.synthesize({
      text: params.text,
      voice: params.voice,
    });
    setLocalTtsVerification(params.language, params.voice, {
      verified: true,
      error: null,
    });
    return audioPath;
  } catch (error) {
    setLocalTtsVerification(params.language, params.voice, {
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : "The local voice pack failed during synthesis.",
    });
    throw error;
  } finally {
    scheduleLocalTtsIdleRelease();
  }
}
