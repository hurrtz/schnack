import * as FileSystem from "expo-file-system/legacy";
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

const KOKORO_MULTILINGUAL_MODEL_ID = "kokoro-multi-lang-v1_0";
const LOCAL_TTS_IDLE_RELEASE_MS = 45000;

const PIPER_GERMAN_VOICES = {
  "thorsten-medium": {
    repoId: "csukuangfj/vits-piper-de_DE-thorsten-medium",
    modelFile: "de_DE-thorsten-medium.onnx",
    configFile: "de_DE-thorsten-medium.onnx.json",
  },
  "kerstin-low": {
    repoId: "csukuangfj/vits-piper-de_DE-kerstin-low",
    modelFile: "de_DE-kerstin-low.onnx",
    configFile: "de_DE-kerstin-low.onnx.json",
  },
} as const;

const PIPER_DATA_MARKERS = [
  "espeak-ng-data/phondata",
  "espeak-ng-data/phontab",
  "espeak-ng-data/de_dict",
  "espeak-ng-data/lang/gmw/de",
] as const;

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

type HuggingFaceModelResponse = {
  siblings?: Array<{
    rfilename?: string;
  }>;
};

const sherpaSessionCache = new Map<
  string,
  Promise<SherpaSessionState> | SherpaSessionState
>();
const huggingFaceRepoFilesCache = new Map<string, Promise<string[]>>();
const localTtsVerificationCache = new Map<
  string,
  { verified: boolean; error: string | null }
>();
let localTtsIdleReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

const LOCAL_TTS_VERIFY_SAMPLE_TEXT: Record<
  Exclude<TtsListenLanguage, "ja">,
  string
> = {
  en: "Hello. This is a quick voice check.",
  de: "Hallo. Dies ist ein kurzer Sprachtest.",
  zh: "你好。这是一个简短的语音测试。",
  es: "Hola. Esta es una prueba corta de voz.",
  pt: "Ola. Este e um teste curto de voz.",
  hi: "नमस्ते। यह एक छोटा आवाज परीक्षण है।",
  fr: "Bonjour. Ceci est un court test vocal.",
  it: "Ciao. Questo e un breve test vocale.",
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

function getLocalTtsRootPath() {
  return `${FileSystem.documentDirectory}local-tts`;
}

function getPiperVoiceConfig(voice: string) {
  return PIPER_GERMAN_VOICES[voice as keyof typeof PIPER_GERMAN_VOICES] ?? null;
}

function getPiperVoiceRootPath(voice: string) {
  return `${getLocalTtsRootPath()}/piper/de/${voice}`;
}

function getPiperModelPath(voice: string) {
  const config = getPiperVoiceConfig(voice);
  return config ? `${getPiperVoiceRootPath(voice)}/${config.modelFile}` : "";
}

function getPiperConfigPath(voice: string) {
  const config = getPiperVoiceConfig(voice);
  return config ? `${getPiperVoiceRootPath(voice)}/${config.configFile}` : "";
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

async function ensureDirectory(path: string) {
  const info = await FileSystem.getInfoAsync(path);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function ensureFileDownloaded(params: {
  url: string;
  path: string;
  onProgress?: (progress: number) => void;
}) {
  const info = await FileSystem.getInfoAsync(params.path);

  if (info.exists) {
    params.onProgress?.(1);
    return params.path;
  }

  const parent = params.path.split("/").slice(0, -1).join("/");
  await ensureDirectory(parent);

  const download = FileSystem.createDownloadResumable(
    params.url,
    params.path,
    {},
    (progress) => {
      if (!params.onProgress || progress.totalBytesExpectedToWrite <= 0) {
        return;
      }

      params.onProgress(
        progress.totalBytesWritten / progress.totalBytesExpectedToWrite,
      );
    },
  );

  const result = await download.downloadAsync();

  if (!result?.uri) {
    throw new Error(`Download failed for ${params.url}`);
  }

  const persistedInfo = await FileSystem.getInfoAsync(params.path);

  if (!persistedInfo.exists && result.uri !== params.path) {
    const downloadedInfo = await FileSystem.getInfoAsync(result.uri);

    if (downloadedInfo.exists) {
      await FileSystem.copyAsync({
        from: result.uri,
        to: params.path,
      });
    }
  }

  const finalInfo = await FileSystem.getInfoAsync(params.path);

  if (!finalInfo.exists) {
    throw new Error(`Downloaded file is missing at ${params.path}`);
  }

  params.onProgress?.(1);
  return params.path;
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

function buildHuggingFaceResolveUrl(repoId: string, relativePath: string) {
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://huggingface.co/${repoId}/resolve/main/${encodedPath}`;
}

async function listHuggingFaceRepoFiles(repoId: string) {
  const cached = huggingFaceRepoFilesCache.get(repoId);

  if (cached) {
    return cached;
  }

  const request = (async () => {
    const response = await fetch(`https://huggingface.co/api/models/${repoId}`);

    if (!response.ok) {
      throw new Error(`Couldn't list local voice pack files for ${repoId}.`);
    }

    const data = (await response.json()) as HuggingFaceModelResponse;
    return (data.siblings ?? [])
      .map((entry) => entry.rfilename)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      );
  })().catch((error) => {
    huggingFaceRepoFilesCache.delete(repoId);
    throw error;
  });

  huggingFaceRepoFilesCache.set(repoId, request);
  return request;
}

async function getPiperSession(voice: string) {
  cancelLocalTtsIdleRelease();
  const rootPath = getPiperVoiceRootPath(voice);
  const cached = sherpaSessionCache.get(rootPath);

  if (cached) {
    return cached instanceof Promise ? cached : cached;
  }

  const promise = (async () => {
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

async function getKokoroMultilingualSession(language: "en" | "zh") {
  cancelLocalTtsIdleRelease();
  const rootPath = await ensureKokoroMultilingualModelRootPath(language);
  const cacheKey = `${rootPath}::kokoro-${language}`;
  const cached = sherpaSessionCache.get(cacheKey);

  if (cached) {
    return cached instanceof Promise ? cached : cached;
  }

  const promise = (async () => {
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

async function installPiperVoicePack(params: {
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  const config = getPiperVoiceConfig(params.voice);

  if (!config) {
    throw new Error(
      "A local German voice pack is not configured for this voice.",
    );
  }

  const repoFiles = await listHuggingFaceRepoFiles(config.repoId);
  const filesToDownload = repoFiles.filter(
    (file) =>
      file === config.modelFile ||
      file === config.configFile ||
      file.startsWith("espeak-ng-data/"),
  );

  if (filesToDownload.length === 0) {
    throw new Error("The local German voice pack files could not be resolved.");
  }

  for (const [index, file] of filesToDownload.entries()) {
    const progressOffset = index / filesToDownload.length;
    const progressWeight = 1 / filesToDownload.length;

    await ensureFileDownloaded({
      url: buildHuggingFaceResolveUrl(config.repoId, file),
      path: `${getPiperVoiceRootPath(params.voice)}/${file}`,
      onProgress: (progress) => {
        params.onProgress?.(progressOffset + progress * progressWeight);
      },
    });
  }

  params.onProgress?.(1);
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
      const audio = await sessionState.engine.generateSpeech(
        normalizeText(params.text),
        {
          sid: voiceConfig.sid,
          speed: 1,
        },
      );

      if (!audio?.samples || !audio?.sampleRate) {
        throw new Error("The local English voice model did not return audio.");
      }

      return writeWaveformFile(
        Float32Array.from(audio.samples),
        audio.sampleRate,
      );
    },
  },
  de: {
    getInstallStatus: async (voice) => {
      const config = getPiperVoiceConfig(voice);

      if (!config) {
        return {
          supported: true,
          installed: false,
          modelInstalled: false,
          configInstalled: false,
          dataInstalled: false,
        };
      }

      const [modelInfo, configInfo, ...dataInfos] = await Promise.all([
        FileSystem.getInfoAsync(getPiperModelPath(voice)),
        FileSystem.getInfoAsync(getPiperConfigPath(voice)),
        ...PIPER_DATA_MARKERS.map((file) =>
          FileSystem.getInfoAsync(`${getPiperVoiceRootPath(voice)}/${file}`),
        ),
      ]);
      const dataInstalled = dataInfos.every((info) => info.exists);

      return {
        supported: true,
        installed: modelInfo.exists && configInfo.exists && dataInstalled,
        modelInstalled: modelInfo.exists,
        configInstalled: configInfo.exists,
        dataInstalled,
      };
    },
    install: async (params) => {
      await installPiperVoicePack({
        voice: params.voice,
        onProgress: params.onProgress,
      });
    },
    synthesize: async (params) => {
      return synthesizePiperSpeech({
        text: params.text,
        voice: params.voice,
      });
    },
  },
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

async function synthesizePiperSpeech(params: { text: string; voice: string }) {
  const status = await getRawLocalTtsInstallStatus({
    language: "de",
    voice: params.voice,
  });

  if (!status.installed) {
    throw new Error("The German local voice pack is not installed yet.");
  }

  const sessionState = await getPiperSession(params.voice);
  const audio = await sessionState.engine.generateSpeech(
    normalizeText(params.text),
    {
      sid: 0,
      speed: 1,
    },
  );

  if (!audio?.samples || !audio?.sampleRate) {
    throw new Error("The local German voice model did not return audio.");
  }

  return writeWaveformFile(Float32Array.from(audio.samples), audio.sampleRate);
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
  const audio = await sessionState.engine.generateSpeech(
    normalizeText(params.text),
    {
      sid: voiceConfig.sid,
      speed: 1,
    },
  );

  if (!audio?.samples || !audio?.sampleRate) {
    throw new Error(
      "The local Simplified Chinese voice model did not return audio.",
    );
  }

  return writeWaveformFile(Float32Array.from(audio.samples), audio.sampleRate);
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
  const audio = await sessionState.engine.generateSpeech(
    normalizeText(params.text),
    {
      sid: 0,
      speed: 1,
    },
  );

  if (!audio?.samples || !audio?.sampleRate) {
    throw new Error(
      `The local ${languageLabel} voice model did not return audio.`,
    );
  }

  return writeWaveformFile(Float32Array.from(audio.samples), audio.sampleRate);
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
  const rawStatus = await getRawLocalTtsInstallStatus(params);

  if (!rawStatus.supported) {
    return {
      ...rawStatus,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
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

  const verification = await verifyLocalTtsPack(params);

  return {
    ...rawStatus,
    downloaded: true,
    verified: verification.verified,
    installed: verification.verified,
    verificationError: verification.error,
  };
}

export async function installLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  onProgress?: (progress: number) => void;
}) {
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
