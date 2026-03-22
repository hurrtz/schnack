import { Platform } from "react-native";
import {
  getLocalModelPathByCategory,
  ModelCategory,
} from "react-native-sherpa-onnx/download";
import { createNativeLocalTtsEngine, isNativeLocalTtsAvailable } from "../nativeLocalTts";
import { cancelLocalTtsIdleRelease } from "./runtime";
import {
  ensureKokoroMultilingualModelRootPath,
  resolveKokoroModelFiles,
  resolveSherpaVitsModelFiles,
} from "./modelFiles";

export type LocalTtsSessionState = {
  engine: any;
  rootPath: string;
};

const sessionCache = new Map<
  string,
  Promise<LocalTtsSessionState> | LocalTtsSessionState
>();

export async function getKokoroMultilingualSession(language: "en" | "zh") {
  cancelLocalTtsIdleRelease();
  const rootPath = await ensureKokoroMultilingualModelRootPath(language);
  const cacheKey = `${rootPath}::kokoro-${language}`;
  const cached = sessionCache.get(cacheKey);

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
        numThreads: 2,
        debug: false,
        provider: "cpu",
      });

      return {
        engine,
        rootPath: cacheKey,
      };
    }

    const { createTTS } = require("react-native-sherpa-onnx/tts") as typeof import("react-native-sherpa-onnx/tts");
    const { fileModelPath } = require("react-native-sherpa-onnx") as typeof import("react-native-sherpa-onnx");

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
      sessionCache.set(cacheKey, state);
      return state;
    })
    .catch((error) => {
      sessionCache.delete(cacheKey);
      throw error;
    });

  sessionCache.set(cacheKey, promise);
  return promise;
}

export async function getSherpaVitsSession(modelId: string) {
  cancelLocalTtsIdleRelease();
  const rootPath = await getLocalModelPathByCategory(
    ModelCategory.Tts,
    modelId,
  );

  if (!rootPath) {
    throw new Error("The local voice pack is not installed yet.");
  }

  const cached = sessionCache.get(rootPath);

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

    const { createTTS } = require("react-native-sherpa-onnx/tts") as typeof import("react-native-sherpa-onnx/tts");
    const { fileModelPath } = require("react-native-sherpa-onnx") as typeof import("react-native-sherpa-onnx");

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
      sessionCache.set(rootPath, state);
      return state;
    })
    .catch((error) => {
      sessionCache.delete(rootPath);
      throw error;
    });

  sessionCache.set(rootPath, promise);
  return promise;
}

export async function releaseLocalTtsSessions() {
  const states = Array.from(sessionCache.values());
  sessionCache.clear();

  await Promise.all(
    states.map(async (entry) => {
      try {
        const state = await entry;
        await state.engine.destroy?.();
      } catch {
        // Ignore teardown failures; battery wins matter more than perfect cleanup here.
      }
    }),
  );
}
