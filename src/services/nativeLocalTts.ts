import * as FileSystem from "expo-file-system/legacy";
import { NativeModules, Platform } from "react-native";

type NativeLocalTtsConfig =
  | {
      modelType: "vits";
      modelPath: string;
      tokensPath: string;
      dataDirPath: string;
      lexiconPath?: string;
      numThreads?: number;
      debug?: boolean;
      provider?: string;
      noiseScale?: number;
      noiseScaleW?: number;
      lengthScale?: number;
      ruleFsts?: string;
      ruleFars?: string;
      maxNumSentences?: number;
      silenceScale?: number;
    }
  | {
      modelType: "kokoro";
      modelPath: string;
      tokensPath: string;
      dataDirPath: string;
      voicesPath: string;
      lexiconPaths?: string[];
      lang?: string;
      numThreads?: number;
      debug?: boolean;
      provider?: string;
      lengthScale?: number;
      ruleFsts?: string;
      ruleFars?: string;
      maxNumSentences?: number;
      silenceScale?: number;
    };

type NativeLocalTtsModule = {
  initialize(instanceId: string, config: NativeLocalTtsConfig): Promise<boolean>;
  generateToFile(
    instanceId: string,
    text: string,
    speakerId: number,
    speed: number,
    outputPath?: string | null,
  ): Promise<string>;
  release(instanceId: string): Promise<boolean>;
};

const nativeModule = NativeModules.SchnackNativeLocalTts as
  | NativeLocalTtsModule
  | undefined;

let nativeLocalTtsInstanceCounter = 0;

export function isNativeLocalTtsAvailable() {
  return Platform.OS === "ios" && !!nativeModule;
}

export async function createNativeLocalTtsEngine(config: NativeLocalTtsConfig) {
  if (!nativeModule || Platform.OS !== "ios") {
    throw new Error("The native local TTS bridge is not available.");
  }

  const instanceId = `native-local-tts-${++nativeLocalTtsInstanceCounter}`;
  await nativeModule.initialize(instanceId, config);

  return {
    async synthesizeToFile(params: {
      text: string;
      sid: number;
      speed: number;
      outputPath?: string;
    }) {
      const outputPath =
        params.outputPath ??
        `${FileSystem.cacheDirectory}native-local-tts-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.wav`;

      return nativeModule.generateToFile(
        instanceId,
        params.text,
        params.sid,
        params.speed,
        outputPath,
      );
    },

    async destroy() {
      await nativeModule.release(instanceId);
    },
  };
}

export type { NativeLocalTtsConfig };
