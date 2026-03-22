type DirectoryEntry = {
  name: string;
  path: string;
  isDirectory: () => boolean;
};

function createDirectoryEntry(path: string, isDirectory: boolean) {
  const segments = path.split("/");
  const name = segments[segments.length - 1] || path;

  return {
    name,
    path,
    isDirectory: () => isDirectory,
  } satisfies DirectoryEntry;
}

async function loadLocalTtsModule(options?: {
  platformOs?: "ios" | "android";
  nativeAvailable?: boolean;
  nativeUnavailableReason?: string | null;
  modelDownloadedById?: Record<string, boolean>;
}) {
  jest.resetModules();

  const platformOs = options?.platformOs ?? "android";
  const nativeAvailable = options?.nativeAvailable ?? false;
  const nativeUnavailableReason = options?.nativeUnavailableReason ?? null;
  const modelDownloadedById = {
    "kokoro-multi-lang-v1_0": true,
    "vits-piper-de_DE-thorsten-medium": true,
    ...(options?.modelDownloadedById ?? {}),
  };
  const existingPaths = new Set<string>([
    "/models/kokoro",
    "/models/kokoro/model_q8f16.onnx",
    "/models/kokoro/tokens.txt",
    "/models/kokoro/voices.bin",
    "/models/kokoro/espeak-ng-data",
    "/models/kokoro/lexicon.txt",
    "/models/kokoro/lexicon-us-en.txt",
    "/models/kokoro/lexicon-zh.txt",
    "/models/de",
    "/models/de/model.onnx",
    "/models/de/tokens.txt",
    "/models/de/espeak-ng-data",
    "/models/de/lexicon.txt",
  ]);
  const directoryEntries = new Map<string, DirectoryEntry[]>([
    [
      "/models/kokoro",
      [
        createDirectoryEntry("/models/kokoro/model_q8f16.onnx", false),
        createDirectoryEntry("/models/kokoro/tokens.txt", false),
        createDirectoryEntry("/models/kokoro/voices.bin", false),
        createDirectoryEntry("/models/kokoro/espeak-ng-data", true),
        createDirectoryEntry("/models/kokoro/lexicon.txt", false),
        createDirectoryEntry("/models/kokoro/lexicon-us-en.txt", false),
        createDirectoryEntry("/models/kokoro/lexicon-zh.txt", false),
      ],
    ],
    [
      "/models/de",
      [
        createDirectoryEntry("/models/de/model.onnx", false),
        createDirectoryEntry("/models/de/tokens.txt", false),
        createDirectoryEntry("/models/de/espeak-ng-data", true),
        createDirectoryEntry("/models/de/lexicon.txt", false),
      ],
    ],
  ]);

  const createTTS = jest.fn(async () => ({
    generateSpeech: jest.fn(async (text: string) => ({
      samples: text.includes("broken") ? null : [0.1, -0.2, 0.3],
      sampleRate: 16000,
    })),
    destroy: jest.fn(async () => undefined),
  }));
  const nativeEngine = {
    synthesizeToFile: jest.fn(async () => "/tmp/native-output.wav"),
    destroy: jest.fn(async () => undefined),
  };
  const createNativeLocalTtsEngine = jest.fn(async () => nativeEngine);
  const writeAsStringAsync = jest.fn(async (path: string) => {
    existingPaths.add(path);
  });
  const getInfoAsync = jest.fn(async (path: string) => ({
    exists: existingPaths.has(path),
  }));
  const deleteAsync = jest.fn(async (path: string) => {
    existingPaths.delete(path);
  });
  const downloadModelByCategory = jest.fn(
    async (
      _category: unknown,
      modelId: string,
      options?: { onProgress?: (progress: { percent: number }) => void },
    ) => {
      modelDownloadedById[modelId] = true;
      options?.onProgress?.({ percent: 100 });
    },
  );
  const getLocalModelPathByCategory = jest.fn(
    async (_category: unknown, modelId: string) => {
      if (!modelDownloadedById[modelId]) {
        return null;
      }

      if (modelId === "kokoro-multi-lang-v1_0") {
        return "/models/kokoro";
      }

      if (modelId === "vits-piper-de_DE-thorsten-medium") {
        return "/models/de";
      }

      return null;
    },
  );
  const isModelDownloadedByCategory = jest.fn(
    async (_category: unknown, modelId: string) => !!modelDownloadedById[modelId],
  );

  jest.doMock("react-native", () => ({
    Platform: {
      OS: platformOs,
    },
  }));
  jest.doMock("expo-file-system/legacy", () => ({
    cacheDirectory: "/tmp/",
    writeAsStringAsync,
    getInfoAsync,
    deleteAsync,
  }));
  jest.doMock("@dr.pogodin/react-native-fs", () => ({
    copyFile: jest.fn(async (_source: string, destination: string) => {
      existingPaths.add(destination);
    }),
    exists: jest.fn(async (path: string) => existingPaths.has(path)),
    readDir: jest.fn(async (path: string) => directoryEntries.get(path) ?? []),
    unlink: jest.fn(async (path: string) => {
      existingPaths.delete(path);
    }),
  }));
  jest.doMock("react-native-sherpa-onnx/download", () => ({
    downloadModelByCategory,
    getLocalModelPathByCategory,
    isModelDownloadedByCategory,
    ModelCategory: {
      Tts: "tts",
    },
    refreshModelsByCategory: jest.fn(async () => undefined),
  }));
  jest.doMock("react-native-sherpa-onnx/tts", () => ({
    createTTS,
  }));
  jest.doMock("react-native-sherpa-onnx", () => ({
    fileModelPath: jest.fn((path: string) => path),
  }));
  jest.doMock("../../src/services/nativeLocalTts", () => ({
    createNativeLocalTtsEngine,
    isNativeLocalTtsAvailable: () => nativeAvailable,
    getNativeLocalTtsUnavailableReason: () => nativeUnavailableReason,
  }));

  const localTts = require("../../src/services/localTts") as typeof import("../../src/services/localTts");

  return {
    localTts,
    mocks: {
      createNativeLocalTtsEngine,
      createTTS,
      deleteAsync,
      downloadModelByCategory,
      getInfoAsync,
      getLocalModelPathByCategory,
      isModelDownloadedByCategory,
      nativeEngine,
      writeAsStringAsync,
    },
  };
}

describe("localTts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("verifies an installed pack and reuses the cached result", async () => {
    const { localTts, mocks } = await loadLocalTtsModule();

    const first = await localTts.verifyLocalTtsPack({
      language: "en",
      voice: "af_heart",
    });
    const second = await localTts.verifyLocalTtsPack({
      language: "en",
      voice: "af_heart",
    });

    expect(first).toEqual({ verified: true, error: null });
    expect(second).toEqual({ verified: true, error: null });
    expect(mocks.createTTS).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAsync).toHaveBeenCalledTimes(1);

    const status = await localTts.getLocalTtsInstallStatus({
      language: "en",
      voice: "af_heart",
    });

    expect(status).toMatchObject({
      supported: true,
      downloaded: true,
      verified: true,
      installed: true,
      verificationError: null,
    });
  });

  it("returns a missing status when the selected pack is not installed", async () => {
    const { localTts } = await loadLocalTtsModule({
      modelDownloadedById: {
        "kokoro-multi-lang-v1_0": false,
      },
    });

    await expect(
      localTts.verifyLocalTtsPack({
        language: "en",
        voice: "af_heart",
      }),
    ).resolves.toEqual({
      verified: false,
      error: "The local voice pack is not installed yet.",
    });

    await expect(
      localTts.getLocalTtsInstallStatus({
        language: "en",
        voice: "af_heart",
      }),
    ).resolves.toMatchObject({
      supported: true,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    });
  });

  it("installs a configured pack and forwards progress", async () => {
    const { localTts, mocks } = await loadLocalTtsModule({
      modelDownloadedById: {
        "vits-piper-de_DE-thorsten-medium": false,
      },
    });
    const progressValues: number[] = [];

    await localTts.installLocalTtsPack({
      language: "de",
      voice: "thorsten-medium",
      onProgress: (progress) => {
        progressValues.push(progress);
      },
    });

    expect(mocks.downloadModelByCategory).toHaveBeenCalledWith(
      "tts",
      "vits-piper-de_DE-thorsten-medium",
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );
    expect(progressValues).toEqual([1, 1]);
  });

  it("synthesizes speech and releases cached sessions after the idle timeout", async () => {
    const { localTts, mocks } = await loadLocalTtsModule();

    const audioPath = await localTts.synthesizeLocalSpeech({
      text: "Hello there",
      language: "en",
      voice: "af_heart",
    });

    expect(audioPath).toMatch(/^\/tmp\/local-tts-/);
    expect(mocks.createTTS).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(45000);

    expect(mocks.createTTS).toHaveBeenCalledTimes(1);
    const createdEngine = await mocks.createTTS.mock.results[0]?.value;
    expect(createdEngine.destroy).toHaveBeenCalledTimes(1);
  });

  it("surfaces native runtime availability errors before synthesis starts", async () => {
    const { localTts, mocks } = await loadLocalTtsModule({
      platformOs: "ios",
      nativeAvailable: true,
      nativeUnavailableReason: "The native local TTS bridge is not available.",
    });

    await expect(
      localTts.synthesizeLocalSpeech({
        text: "Hello there",
        language: "en",
        voice: "af_heart",
      }),
    ).rejects.toThrow("The native local TTS bridge is not available.");

    expect(mocks.createNativeLocalTtsEngine).not.toHaveBeenCalled();
  });
});
