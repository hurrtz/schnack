import { useEffect } from "react";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import {
  appendMeterHistory,
  averageSampleMagnitude,
  blendWaveformSamples,
  EMPTY_OSCILLOSCOPE_SAMPLES,
  enhanceInputWaveformSamples,
  levelToMetering,
} from "../../utils/audioVisualization";
import {
  cancelNativeWaveformRecording,
  subscribeToNativeWaveform,
} from "../../services/nativeWaveform";
import { volumeToMetering } from "./shared";
import type { RecognitionSession } from "./useRecognitionSession";

interface UseRecognitionSubscriptionsParams {
  session: RecognitionSession;
  usingNativeRecorder: boolean;
}

export function useRecognitionSubscriptions({
  session,
  usingNativeRecorder,
}: UseRecognitionSubscriptionsParams) {
  const {
    abortRequestedRef,
    finalTranscriptRef,
    handleError,
    handleResult,
    inputReferenceLevelRef,
    isRecordingRef,
    latestTranscriptRef,
    nativeSessionIdRef,
    rejectPendingStop,
    resetVisualState,
    resolvePendingStop,
    setIsRecording,
    setMeteringData,
    setWaveformData,
    stopRequestedRef,
    stopResolverRef,
  } = session;

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
        inputReferenceLevelRef.current,
      );
      inputReferenceLevelRef.current = referenceLevel;

      setWaveformData((previous) =>
        blendWaveformSamples(previous, samples, 0.08),
      );
      setMeteringData(levelToMetering(averageSampleMagnitude(samples)));
    });
  }, [
    inputReferenceLevelRef,
    nativeSessionIdRef,
    rejectPendingStop,
    setMeteringData,
    setWaveformData,
    usingNativeRecorder,
  ]);

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
      handleResult,
    );

    const volumeSubscription = ExpoSpeechRecognitionModule.addListener(
      "volumechange",
      (event) => {
        const metering = volumeToMetering(event.value);
        setMeteringData(metering);
        setWaveformData((previous) => appendMeterHistory(previous, metering));
      },
    );

    const errorSubscription = ExpoSpeechRecognitionModule.addListener(
      "error",
      handleError,
    );

    const endSubscription = ExpoSpeechRecognitionModule.addListener("end", () => {
      if (abortRequestedRef.current) {
        resolvePendingStop(null);
        return;
      }

      if (stopResolverRef.current || stopRequestedRef.current) {
        const transcript =
          finalTranscriptRef.current.trim() ||
          latestTranscriptRef.current.trim() ||
          null;
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
    abortRequestedRef,
    finalTranscriptRef,
    handleError,
    handleResult,
    isRecordingRef,
    latestTranscriptRef,
    resetVisualState,
    resolvePendingStop,
    setIsRecording,
    setMeteringData,
    setWaveformData,
    stopRequestedRef,
    stopResolverRef,
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
  }, [nativeSessionIdRef, usingNativeRecorder]);
}
