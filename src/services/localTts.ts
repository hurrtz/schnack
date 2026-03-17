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
} from "react-native-sherpa-onnx/download";
import {
  LOCAL_TTS_KOKORO_MODEL_ID,
  LOCAL_TTS_SUPPORTED_LANGUAGES,
} from "../constants/localTts";
import { tokenizeKokoroEnglish } from "./localTts/kokoroTokenizer";
import type { TtsListenLanguage } from "../types";

const KOKORO_MODEL_URL = `https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/${LOCAL_TTS_KOKORO_MODEL_ID}`;
const KOKORO_VOICE_URL_BASE =
  "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";
const KOKORO_SAMPLE_RATE = 24000;
const KOKORO_STYLE_DIM = 256;
const KOKORO_MULTILINGUAL_MODEL_ID = "kokoro-multi-lang-v1_0";

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

type KokoroSessionState = {
  session: any;
  modelPath: string;
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

let kokoroSessionState: KokoroSessionState | null = null;
let kokoroSessionPromise: Promise<KokoroSessionState> | null = null;
const voiceCache = new Map<string, Float32Array>();
const sherpaSessionCache = new Map<
  string,
  Promise<SherpaSessionState> | SherpaSessionState
>();
const huggingFaceRepoFilesCache = new Map<string, Promise<string[]>>();

function getLocalTtsRootPath() {
  return `${FileSystem.documentDirectory}local-tts`;
}

function getKokoroRootPath() {
  return `${getLocalTtsRootPath()}/kokoro`;
}

function getKokoroModelPath() {
  return `${getKokoroRootPath()}/models/${LOCAL_TTS_KOKORO_MODEL_ID}`;
}

function getKokoroVoicePath(voice: string) {
  return `${getKokoroRootPath()}/voices/${voice}.bin`;
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
  return KOKORO_CHINESE_VOICES[
    voice as keyof typeof KOKORO_CHINESE_VOICES
  ] ?? null;
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
  depth = 0
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

async function getInstalledKokoroChineseModelRootPath() {
  const basePath = await getLocalModelPathByCategory(
    ModelCategory.Tts,
    KOKORO_MULTILINGUAL_MODEL_ID
  );

  if (!basePath) {
    return null;
  }

  return findNestedDirectory(
    basePath,
    (candidate) =>
      directoryContainsFiles(candidate, [
        "model.onnx",
        "voices.bin",
        "tokens.txt",
        "lexicon-zh.txt",
      ])
  );
}

async function ensureKokoroChineseModelRootPath() {
  const rootPath = await getInstalledKokoroChineseModelRootPath();

  if (!rootPath) {
    throw new Error("The Simplified Chinese local voice pack is not installed yet.");
  }

  const defaultLexiconPath = `${rootPath}/lexicon.txt`;

  if (await pathExists(defaultLexiconPath)) {
    await unlinkPath(defaultLexiconPath);
  }

  await copyFile(`${rootPath}/lexicon-zh.txt`, defaultLexiconPath);

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
        progress.totalBytesWritten / progress.totalBytesExpectedToWrite
      );
    }
  );

  const result = await download.downloadAsync();

  if (!result?.uri) {
    throw new Error(`Download failed for ${params.url}`);
  }

  params.onProgress?.(1);
  return result.uri;
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

function base64ToBytes(base64: string) {
  const BufferCtor = (globalThis as any).Buffer;

  if (BufferCtor) {
    return new Uint8Array(BufferCtor.from(base64, "base64"));
  }

  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  throw new Error("No base64 decoder available.");
}

function normalizeText(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/…/g, "...");
}

async function readBinaryFile(path: string) {
  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: "base64",
  });

  return base64ToBytes(base64).buffer;
}

async function getKokoroVoiceData(voice: string) {
  const cached = voiceCache.get(voice);

  if (cached) {
    return cached;
  }

  const buffer = await readBinaryFile(getKokoroVoicePath(voice));
  const value = new Float32Array(buffer);
  voiceCache.set(voice, value);
  return value;
}

async function getKokoroSession() {
  const modelPath = getKokoroModelPath();

  if (kokoroSessionState?.modelPath === modelPath) {
    return kokoroSessionState;
  }

  if (!kokoroSessionPromise) {
    kokoroSessionPromise = (async () => {
      const info = await FileSystem.getInfoAsync(modelPath);

      if (!info.exists) {
        throw new Error("The English local voice pack is not installed.");
      }

      const { InferenceSession } = await import("onnxruntime-react-native");
      const session = await InferenceSession.create(modelPath, {
        executionProviders: ["cpuexecutionprovider"],
      });

      kokoroSessionState = {
        session,
        modelPath,
      };

      return kokoroSessionState;
    })().finally(() => {
      kokoroSessionPromise = null;
    });
  }

  return kokoroSessionPromise;
}

function buildWavBytes(floatArray: Float32Array, sampleRate: number) {
  const pcm16 = new Int16Array(floatArray.length);

  for (let index = 0; index < floatArray.length; index += 1) {
    pcm16[index] = Math.max(
      -32768,
      Math.min(32767, Math.floor(floatArray[index] * 32767))
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
      .filter((value): value is string => typeof value === "string" && value.length > 0);
  })().catch((error) => {
    huggingFaceRepoFilesCache.delete(repoId);
    throw error;
  });

  huggingFaceRepoFilesCache.set(repoId, request);
  return request;
}

async function getPiperSession(voice: string) {
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

async function getKokoroChineseSession() {
  const rootPath = await ensureKokoroChineseModelRootPath();
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
      modelType: "kokoro",
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
    throw new Error("A local German voice pack is not configured for this voice.");
  }

  const repoFiles = await listHuggingFaceRepoFiles(config.repoId);
  const filesToDownload = repoFiles.filter(
    (file) =>
      file === config.modelFile ||
      file === config.configFile ||
      file.startsWith("espeak-ng-data/")
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
      "A local Simplified Chinese voice pack is not configured for this voice."
    );
  }

  await downloadModelByCategory(ModelCategory.Tts, KOKORO_MULTILINGUAL_MODEL_ID, {
    onProgress: (progress) => {
      params.onProgress?.(progress.percent / 100);
    },
  });

  await ensureKokoroChineseModelRootPath();
  params.onProgress?.(1);
}

async function synthesizePiperSpeech(params: {
  text: string;
  voice: string;
}) {
  const status = await getLocalTtsInstallStatus({
    language: "de",
    voice: params.voice,
  });

  if (!status.installed) {
    throw new Error("The German local voice pack is not installed yet.");
  }

  const sessionState = await getPiperSession(params.voice);
  const audio = await sessionState.engine.generateSpeech(normalizeText(params.text), {
    sid: 0,
    speed: 1,
  });

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
      "A local Simplified Chinese voice pack is not configured for this voice."
    );
  }

  const status = await getLocalTtsInstallStatus({
    language: "zh",
    voice: params.voice,
  });

  if (!status.installed) {
    throw new Error("The Simplified Chinese local voice pack is not installed yet.");
  }

  const sessionState = await getKokoroChineseSession();
  const audio = await sessionState.engine.generateSpeech(normalizeText(params.text), {
    sid: voiceConfig.sid,
    speed: 1,
  });

  if (!audio?.samples || !audio?.sampleRate) {
    throw new Error("The local Simplified Chinese voice model did not return audio.");
  }

  return writeWaveformFile(Float32Array.from(audio.samples), audio.sampleRate);
}

export async function getLocalTtsInstallStatus(params: {
  language: TtsListenLanguage;
  voice: string;
}) {
  if (!LOCAL_TTS_SUPPORTED_LANGUAGES.includes(params.language)) {
    return {
      supported: false,
      installed: false,
    };
  }

  if (params.language === "en") {
    const [modelInfo, voiceInfo] = await Promise.all([
      FileSystem.getInfoAsync(getKokoroModelPath()),
      FileSystem.getInfoAsync(getKokoroVoicePath(params.voice)),
    ]);

    return {
      supported: true,
      installed: modelInfo.exists && voiceInfo.exists,
      modelInstalled: modelInfo.exists,
      voiceInstalled: voiceInfo.exists,
    };
  }

  if (params.language === "de") {
    const config = getPiperVoiceConfig(params.voice);

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
      FileSystem.getInfoAsync(getPiperModelPath(params.voice)),
      FileSystem.getInfoAsync(getPiperConfigPath(params.voice)),
      ...PIPER_DATA_MARKERS.map((file) =>
        FileSystem.getInfoAsync(`${getPiperVoiceRootPath(params.voice)}/${file}`)
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
  }

  if (params.language === "zh") {
    const voiceConfig = getKokoroChineseVoiceConfig(params.voice);

    if (!voiceConfig) {
      return {
        supported: true,
        installed: false,
        modelInstalled: false,
      };
    }

    const modelInstalled = await isModelDownloadedByCategory(
      ModelCategory.Tts,
      KOKORO_MULTILINGUAL_MODEL_ID
    );
    const modelRootPath = modelInstalled
      ? await getInstalledKokoroChineseModelRootPath()
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
  }

  return {
    supported: false,
    installed: false,
  };
}

export async function installLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  if (params.language === "en") {
    await ensureFileDownloaded({
      url: KOKORO_MODEL_URL,
      path: getKokoroModelPath(),
      onProgress: (progress) => params.onProgress?.(progress * 0.8),
    });

    await ensureFileDownloaded({
      url: `${KOKORO_VOICE_URL_BASE}/${params.voice}.bin`,
      path: getKokoroVoicePath(params.voice),
      onProgress: (progress) => params.onProgress?.(0.8 + progress * 0.2),
    });

    params.onProgress?.(1);
    return;
  }

  if (params.language === "de") {
    await installPiperVoicePack({
      voice: params.voice,
      onProgress: params.onProgress,
    });
    return;
  }

  if (params.language === "zh") {
    await installKokoroChineseVoicePack({
      voice: params.voice,
      onProgress: params.onProgress,
    });
    return;
  }

  throw new Error("A local voice pack is not available for this language yet.");
}

export async function synthesizeLocalSpeech(params: {
  text: string;
  language: TtsListenLanguage;
  voice: string;
}) {
  if (params.language === "en") {
    const status = await getLocalTtsInstallStatus({
      language: params.language,
      voice: params.voice,
    });

    if (!status.installed) {
      throw new Error("The local voice pack is not installed yet.");
    }

    const tokens = tokenizeKokoroEnglish(params.text);
    const numTokens = Math.min(Math.max(tokens.length - 2, 0), 509);
    const voiceData = await getKokoroVoiceData(params.voice);
    const offset = numTokens * KOKORO_STYLE_DIM;
    const styleData = voiceData.slice(offset, offset + KOKORO_STYLE_DIM);
    const sessionState = await getKokoroSession();
    const { Tensor } = await import("onnxruntime-react-native");

    let inputIds: any;

    try {
      inputIds = new Tensor("int64", new Int32Array(tokens), [1, tokens.length]);
    } catch {
      inputIds = new Tensor("int64", tokens, [1, tokens.length]);
    }

    const outputs = await sessionState.session.run({
      input_ids: inputIds,
      style: new Tensor("float32", new Float32Array(styleData), [1, KOKORO_STYLE_DIM]),
      speed: new Tensor("float32", new Float32Array([1]), [1]),
    });

    const waveform = outputs?.waveform?.data;

    if (!waveform) {
      throw new Error("The local voice model did not return audio.");
    }

    return writeWaveformFile(new Float32Array(waveform), KOKORO_SAMPLE_RATE);
  }

  if (params.language === "de") {
    return synthesizePiperSpeech({
      text: params.text,
      voice: params.voice,
    });
  }

  if (params.language === "zh") {
    return synthesizeKokoroChineseSpeech({
      text: params.text,
      voice: params.voice,
    });
  }

  throw new Error("A local voice pack is not available for this language yet.");
}
