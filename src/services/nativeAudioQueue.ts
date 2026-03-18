import { NativeEventEmitter, NativeModules, Platform } from "react-native";

type NativeAudioQueueEvent = {
  type: "started" | "finished" | "failed" | "stopped" | "drained";
  itemId?: string;
  uri?: string;
  requestId?: string | null;
  source?: string | null;
  message?: string;
};

type NativeAudioQueueModule = {
  prepare(): Promise<boolean>;
  enqueue(
    uri: string,
    itemId: string,
    requestId?: string | null,
    source?: string | null,
  ): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
};

const nativeModule = NativeModules.SchnackNativeAudioQueue as
  | NativeAudioQueueModule
  | undefined;

const nativeEmitter =
  Platform.OS === "ios" && nativeModule
    ? new NativeEventEmitter(nativeModule as any)
    : null;

export function isNativeAudioQueueAvailable() {
  return Platform.OS === "ios" && !!nativeModule;
}

export function subscribeToNativeAudioQueue(
  listener: (event: NativeAudioQueueEvent) => void,
) {
  if (!nativeEmitter) {
    return () => {};
  }

  const subscription = nativeEmitter.addListener(
    "SchnackNativeAudioQueueEvent",
    listener,
  );

  return () => {
    subscription.remove();
  };
}

export async function prepareNativeAudioQueue() {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.prepare();
}

export async function enqueueNativeAudioQueueItem(params: {
  uri: string;
  itemId: string;
  requestId?: string | null;
  source?: string | null;
}) {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.enqueue(
    params.uri,
    params.itemId,
    params.requestId ?? null,
    params.source ?? null,
  );
}

export async function startNativeAudioQueue() {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.start();
}

export async function stopNativeAudioQueue() {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.stop();
}

export type { NativeAudioQueueEvent };
