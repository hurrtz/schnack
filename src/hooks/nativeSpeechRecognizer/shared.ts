import type { ExpoSpeechRecognitionErrorEvent } from "expo-speech-recognition";
import type { useLocalization } from "../../i18n";

export const MIN_RECOGNITION_DURATION_MS = 300;
export const RECOGNITION_METER_INTERVAL_MS = 150;

export function getRecognitionLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}

export function volumeToMetering(value: number) {
  if (value < 0) {
    return -160;
  }

  const clamped = Math.max(0, Math.min(10, value));
  return -56 + (clamped / 10) * 56;
}

export function buildErrorMessage(
  event: ExpoSpeechRecognitionErrorEvent,
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (event.error) {
    case "not-allowed":
      return t("speechRecognitionPermissionNotGranted");
    case "service-not-allowed":
      return t("speechRecognitionUnavailableOnDevice");
    case "language-not-supported":
      return t("speechRecognitionUnavailableForDeviceLanguage");
    case "network":
      return t("nativeSpeechRecognitionNeedsNetwork");
    case "no-speech":
      return t("noSpeechDetected");
    default:
      return event.message || t("nativeSpeechRecognitionFailed");
  }
}
