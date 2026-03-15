import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import { useLocalization } from "../i18n";
import { EMPTY_VISUAL_LEVELS, appendMeterHistory } from "../utils/audioVisualization";

const MIN_RECOGNITION_DURATION_MS = 300;

function getRecognitionLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}

function volumeToMetering(value: number) {
  if (value < 0) {
    return -160;
  }

  const clamped = Math.max(0, Math.min(10, value));
  return -56 + (clamped / 10) * 56;
}

function buildErrorMessage(
  event: ExpoSpeechRecognitionErrorEvent,
  t: ReturnType<typeof useLocalization>["t"]
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

export function useNativeSpeechRecognizer() {
  const { t } = useLocalization();
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const isRecordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const latestTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const stopResolverRef = useRef<((value: string | null) => void) | null>(null);
  const stopRejectRef = useRef<((error: Error) => void) | null>(null);
  const stopRequestedRef = useRef(false);
  const abortRequestedRef = useRef(false);

  const resetVisualState = useCallback(() => {
    setMeteringData(-160);
    setWaveformData(EMPTY_VISUAL_LEVELS);
  }, []);

  const clearPendingResolution = useCallback(() => {
    stopResolverRef.current = null;
    stopRejectRef.current = null;
    stopRequestedRef.current = false;
    abortRequestedRef.current = false;
  }, []);

  const resolvePendingStop = useCallback(
    (value: string | null) => {
      const resolve = stopResolverRef.current;
      clearPendingResolution();
      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();
      resolve?.(value);
    },
    [clearPendingResolution, resetVisualState]
  );

  const rejectPendingStop = useCallback(
    (error: Error) => {
      const reject = stopRejectRef.current;
      clearPendingResolution();
      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();
      if (reject) {
        reject(error);
        return;
      }

      setLastError(error.message);
    },
    [clearPendingResolution, resetVisualState]
  );

  const handleResult = useCallback((event: ExpoSpeechRecognitionResultEvent) => {
    const transcript = event.results[0]?.transcript?.trim() ?? "";

    if (!transcript) {
      return;
    }

    latestTranscriptRef.current = transcript;

    if (event.isFinal) {
      finalTranscriptRef.current = transcript;
    }
  }, []);

  const handleError = useCallback(
    (event: ExpoSpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" && abortRequestedRef.current) {
        resolvePendingStop(null);
        return;
      }

      if (event.error === "no-speech" && stopRequestedRef.current) {
        resolvePendingStop(null);
        return;
      }

      rejectPendingStop(new Error(buildErrorMessage(event, t)));
    },
    [rejectPendingStop, resolvePendingStop, t]
  );

  useEffect(() => {
    const startSubscription = ExpoSpeechRecognitionModule.addListener("start", () => {
      isRecordingRef.current = true;
      setIsRecording(true);
    });

    const resultSubscription = ExpoSpeechRecognitionModule.addListener(
      "result",
      handleResult
    );

    const volumeSubscription = ExpoSpeechRecognitionModule.addListener(
      "volumechange",
      (event) => {
        const metering = volumeToMetering(event.value);
        setMeteringData(metering);
        setWaveformData((previous) => appendMeterHistory(previous, metering));
      }
    );

    const errorSubscription = ExpoSpeechRecognitionModule.addListener(
      "error",
      handleError
    );

    const endSubscription = ExpoSpeechRecognitionModule.addListener("end", () => {
      if (abortRequestedRef.current) {
        resolvePendingStop(null);
        return;
      }

      if (stopResolverRef.current || stopRequestedRef.current) {
        const transcript =
          finalTranscriptRef.current.trim() || latestTranscriptRef.current.trim() || null;
        resolvePendingStop(transcript);
        return;
      }

      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();
    });

    return () => {
      startSubscription.remove();
      resultSubscription.remove();
      volumeSubscription.remove();
      errorSubscription.remove();
      endSubscription.remove();

      if (isRecordingRef.current) {
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, [handleError, handleResult, resetVisualState, resolvePendingStop]);

  const startRecognition = useCallback(async () => {
    if (isRecordingRef.current) {
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      throw new Error(t("speechRecognitionUnavailableOnDevice"));
    }

    const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

    if (!permissions.granted) {
      throw new Error(t("speechRecognitionPermissionNotGranted"));
    }

    setLastError(null);
    latestTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    clearPendingResolution();
    resetVisualState();
    startedAtRef.current = Date.now();
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      ExpoSpeechRecognitionModule.start({
        lang: getRecognitionLocale(),
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
        iosTaskHint: "dictation",
        iosVoiceProcessingEnabled: true,
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 80,
        },
      });
    } catch (error) {
      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();
      throw error instanceof Error
        ? error
        : new Error(t("couldntStartNativeSpeechRecognition"));
    }
  }, [clearPendingResolution, resetVisualState, t]);

  const abortRecognition = useCallback(async () => {
    if (!isRecordingRef.current) {
      clearPendingResolution();
      resetVisualState();
      return;
    }

    abortRequestedRef.current = true;
    stopRequestedRef.current = false;

    await new Promise<void>((resolve) => {
      stopResolverRef.current = () => resolve();
      stopRejectRef.current = () => resolve();
      ExpoSpeechRecognitionModule.abort();
    });
  }, [clearPendingResolution, resetVisualState]);

  const stopRecognition = useCallback(async (): Promise<string | null> => {
    if (!isRecordingRef.current) {
      return null;
    }

    if (Date.now() - startedAtRef.current < MIN_RECOGNITION_DURATION_MS) {
      await abortRecognition();
      return null;
    }

    stopRequestedRef.current = true;
    abortRequestedRef.current = false;

    return new Promise<string | null>((resolve, reject) => {
      stopResolverRef.current = resolve;
      stopRejectRef.current = reject;
      ExpoSpeechRecognitionModule.stop();
    });
  }, [abortRecognition]);

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    isAvailable: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
    isRecording,
    lastError,
    meteringData,
    waveformData,
    startRecognition,
    stopRecognition,
    abortRecognition,
    clearLastError,
  };
}
