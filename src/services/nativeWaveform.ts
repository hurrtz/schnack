import { NativeEventEmitter, NativeModules, Platform } from "react-native";

type NativeWaveformEvent =
  | {
      type: "started" | "stopped" | "cancelled";
      sessionId: string;
      uri?: string;
    }
  | {
      type: "levels";
      sessionId: string;
      samples: number[];
      averageMagnitude: number;
    }
  | {
      type: "error";
      sessionId: string;
      message: string;
    };

type NativeWaveformAnalysis = {
  samples: number[];
  durationMs: number;
};

type NativeWaveformModule = {
  startRecording(
    sessionId: string,
    outputUri?: string | null,
  ): Promise<{ uri: string }>;
  stopRecording(sessionId: string): Promise<{ uri: string }>;
  cancelRecording(sessionId: string): Promise<boolean>;
  analyzeAudioFile(
    uri: string,
    sampleCount?: number | null,
  ): Promise<NativeWaveformAnalysis>;
};

const nativeModule = NativeModules.SchnackNativeWaveform as
  | NativeWaveformModule
  | undefined;

const nativeEmitter =
  Platform.OS === "ios" && nativeModule
    ? new NativeEventEmitter(nativeModule as any)
    : null;

export function isNativeWaveformAvailable() {
  return Platform.OS === "ios" && !!nativeModule;
}

export function subscribeToNativeWaveform(
  listener: (event: NativeWaveformEvent) => void,
) {
  if (!nativeEmitter) {
    return () => {};
  }

  const subscription = nativeEmitter.addListener(
    "SchnackNativeWaveformEvent",
    listener,
  );

  return () => {
    subscription.remove();
  };
}

export async function startNativeWaveformRecording(params: {
  sessionId: string;
  outputUri?: string | null;
}) {
  if (!nativeModule) {
    throw new Error("The native waveform recorder is not available.");
  }

  return nativeModule.startRecording(params.sessionId, params.outputUri ?? null);
}

export async function stopNativeWaveformRecording(sessionId: string) {
  if (!nativeModule) {
    throw new Error("The native waveform recorder is not available.");
  }

  return nativeModule.stopRecording(sessionId);
}

export async function cancelNativeWaveformRecording(sessionId: string) {
  if (!nativeModule) {
    throw new Error("The native waveform recorder is not available.");
  }

  return nativeModule.cancelRecording(sessionId);
}

export async function analyzeNativeAudioFile(params: {
  uri: string;
  sampleCount?: number;
}) {
  if (!nativeModule) {
    return null;
  }

  const analysis = await nativeModule.analyzeAudioFile(
    params.uri,
    params.sampleCount ?? null,
  );

  if (!analysis || !Array.isArray(analysis.samples)) {
    return null;
  }

  return analysis;
}

export type { NativeWaveformAnalysis, NativeWaveformEvent };
