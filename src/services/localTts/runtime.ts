import { Platform } from "react-native";
import {
  getNativeLocalTtsUnavailableReason,
  isNativeLocalTtsAvailable,
} from "../nativeLocalTts";
import { LOCAL_TTS_IDLE_RELEASE_MS } from "./constants";

let localTtsIdleReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

export function cancelLocalTtsIdleRelease() {
  if (localTtsIdleReleaseTimeout) {
    clearTimeout(localTtsIdleReleaseTimeout);
    localTtsIdleReleaseTimeout = null;
  }
}

export function scheduleLocalTtsIdleRelease(
  releaseResources: () => Promise<void>,
) {
  cancelLocalTtsIdleRelease();
  localTtsIdleReleaseTimeout = setTimeout(() => {
    void releaseResources();
  }, LOCAL_TTS_IDLE_RELEASE_MS);
}

export function getLocalTtsRuntimeUnavailableReason() {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (!isNativeLocalTtsAvailable()) {
    return null;
  }

  return getNativeLocalTtsUnavailableReason();
}
