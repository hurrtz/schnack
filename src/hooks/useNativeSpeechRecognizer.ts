import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import { useLocalization } from "../i18n";
import {
  EMPTY_OSCILLOSCOPE_SAMPLES,
  EMPTY_VISUAL_LEVELS,
  appendMeterHistory,
  averageSampleMagnitude,
  blendWaveformSamples,
  enhanceInputWaveformSamples,
  INPUT_WAVEFORM_REFERENCE_FLOOR,
  levelToMetering,
} from "../utils/audioVisualization";
import { WaveformVisualizationVariant } from "../types";
import {
  cancelNativeWaveformRecording,
  isNativeWaveformAvailable,
  startNativeWaveformRecording,
  stopNativeWaveformRecording,
  subscribeToNativeWaveform,
} from "../services/nativeWaveform";

const MIN_RECOGNITION_DURATION_MS = 300;
const RECOGNITION_METER_INTERVAL_MS = 150;

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
  const usingNativeRecorder =
    Platform.OS === "ios" && isNativeWaveformAvailable();
  const emptyWaveform = usingNativeRecorder
    ? EMPTY_OSCILLOSCOPE_SAMPLES
    : EMPTY_VISUAL_LEVELS;
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(emptyWaveform);
  const isRecordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const latestTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const stopResolverRef = useRef<((value: string | null) => void) | null>(null);
  const stopRejectRef = useRef<((error: Error) => void) | null>(null);
  const stopRequestedRef = useRef(false);
  const abortRequestedRef = useRef(false);
  const nativeSessionIdRef = useRef<string | null>(null);
  const inputReferenceLevelRef = useRef(INPUT_WAVEFORM_REFERENCE_FLOOR);

  const resetVisualState = useCallback(() => {
    inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
    setMeteringData(-160);
    setWaveformData(emptyWaveform);
  }, [emptyWaveform]);

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
    if (!usingNativeRecorder) {
      return;
    }

    return subscribeToNativeWaveform((event) => {
      if (
        event.type === "error" &&
        nativeSessionIdRef.current &&
        event.sessionId === nativeSessionIdRef.current
      ) {
        const sessionId = nativeSessionIdRef.current;
        nativeSessionIdRef.current = null;
        void cancelNativeWaveformRecording(sessionId).catch(() => {
          // The native module may have already cleaned up after the failure.
        });
        rejectPendingStop(new Error(event.message));
        return;
      }

      if (
        event.type !== "levels" ||
        !nativeSessionIdRef.current ||
        event.sessionId !== nativeSessionIdRef.current
      ) {
        return;
      }

      const { samples, referenceLevel } = enhanceInputWaveformSamples(
        event.samples?.length ? event.samples : EMPTY_OSCILLOSCOPE_SAMPLES,
        inputReferenceLevelRef.current
      );
      inputReferenceLevelRef.current = referenceLevel;

      setWaveformData((previous) => blendWaveformSamples(previous, samples, 0.08));
      setMeteringData(
        levelToMetering(averageSampleMagnitude(samples))
      );
    });
  }, [rejectPendingStop, usingNativeRecorder]);

  useEffect(() => {
    if (usingNativeRecorder) {
      return;
    }

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
  }, [
    handleError,
    handleResult,
    resetVisualState,
    resolvePendingStop,
    usingNativeRecorder,
  ]);

  useEffect(() => {
    if (!usingNativeRecorder) {
      return;
    }

    return () => {
      if (nativeSessionIdRef.current) {
        void cancelNativeWaveformRecording(nativeSessionIdRef.current);
        nativeSessionIdRef.current = null;
      }
    };
  }, [usingNativeRecorder]);

  const transcribeRecordedFile = useCallback(
    async (fileUri: string) =>
      new Promise<string | null>((resolve, reject) => {
        latestTranscriptRef.current = "";
        finalTranscriptRef.current = "";

        const cleanup = () => {
          resultSubscription.remove();
          errorSubscription.remove();
          endSubscription.remove();
        };

        const finish = (value: string | null) => {
          cleanup();
          resolve(value);
        };

        const fail = (error: Error) => {
          cleanup();
          reject(error);
        };

        const resultSubscription = ExpoSpeechRecognitionModule.addListener(
          "result",
          (event) => {
            const transcript = event.results[0]?.transcript?.trim() ?? "";
            if (!transcript) {
              return;
            }

            latestTranscriptRef.current = transcript;
            if (event.isFinal) {
              finalTranscriptRef.current = transcript;
            }
          }
        );

        const errorSubscription = ExpoSpeechRecognitionModule.addListener(
          "error",
          (event) => {
            if (event.error === "aborted" || event.error === "no-speech") {
              finish(null);
              return;
            }

            fail(new Error(buildErrorMessage(event, t)));
          }
        );

        const endSubscription = ExpoSpeechRecognitionModule.addListener("end", () => {
          const transcript =
            finalTranscriptRef.current.trim() || latestTranscriptRef.current.trim() || null;
          finish(transcript);
        });

        try {
          ExpoSpeechRecognitionModule.start({
            lang: getRecognitionLocale(),
            interimResults: true,
            continuous: false,
            addsPunctuation: true,
            requiresOnDeviceRecognition: false,
            audioSource: {
              uri: fileUri,
            },
          });
        } catch (error) {
          fail(
            error instanceof Error
              ? error
              : new Error(t("nativeSpeechRecognitionFailed"))
          );
        }
      }),
    [t]
  );

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

    if (usingNativeRecorder) {
      const sessionId = `native-stt-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      nativeSessionIdRef.current = sessionId;

      try {
        await startNativeWaveformRecording({ sessionId });
      } catch (error) {
        nativeSessionIdRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        resetVisualState();
        throw error instanceof Error
          ? error
          : new Error(t("couldntStartNativeSpeechRecognition"));
      }
      return;
    }

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
          intervalMillis: RECOGNITION_METER_INTERVAL_MS,
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
  }, [clearPendingResolution, resetVisualState, t, usingNativeRecorder]);

  const abortRecognition = useCallback(async () => {
    if (!isRecordingRef.current) {
      clearPendingResolution();
      resetVisualState();
      return;
    }

    if (usingNativeRecorder) {
      const sessionId = nativeSessionIdRef.current;
      nativeSessionIdRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();
      clearPendingResolution();

      if (sessionId) {
        await cancelNativeWaveformRecording(sessionId);
      }
      return;
    }

    abortRequestedRef.current = true;
    stopRequestedRef.current = false;

    await new Promise<void>((resolve) => {
      stopResolverRef.current = () => resolve();
      stopRejectRef.current = () => resolve();
      ExpoSpeechRecognitionModule.abort();
    });
  }, [clearPendingResolution, resetVisualState, usingNativeRecorder]);

  const stopRecognition = useCallback(async (): Promise<string | null> => {
    if (!isRecordingRef.current) {
      return null;
    }

    if (Date.now() - startedAtRef.current < MIN_RECOGNITION_DURATION_MS) {
      await abortRecognition();
      return null;
    }

    if (usingNativeRecorder) {
      const sessionId = nativeSessionIdRef.current;
      if (!sessionId) {
        isRecordingRef.current = false;
        setIsRecording(false);
        resetVisualState();
        return null;
      }

      nativeSessionIdRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      resetVisualState();

      const recording = await stopNativeWaveformRecording(sessionId);
      const fileUri = recording.uri ?? null;

      if (!fileUri) {
        return null;
      }

      return transcribeRecordedFile(fileUri);
    }

    stopRequestedRef.current = true;
    abortRequestedRef.current = false;

    return new Promise<string | null>((resolve, reject) => {
      stopResolverRef.current = resolve;
      stopRejectRef.current = reject;
      ExpoSpeechRecognitionModule.stop();
    });
  }, [
    abortRecognition,
    resetVisualState,
    transcribeRecordedFile,
    usingNativeRecorder,
  ]);

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    isAvailable: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
    isRecording,
    lastError,
    meteringData,
    waveformData,
    waveformVariant: (usingNativeRecorder ? "oscilloscope" : "bars") as WaveformVisualizationVariant,
    startRecognition,
    stopRecognition,
    abortRecognition,
    clearLastError,
  };
}
