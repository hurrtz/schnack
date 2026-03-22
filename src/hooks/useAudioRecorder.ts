import { useEffect, useRef, useCallback, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import {
  EMPTY_OSCILLOSCOPE_SAMPLES,
  EMPTY_VISUAL_LEVELS,
  levelToMetering,
  averageSampleMagnitude,
  appendMeterHistory,
  blendWaveformSamples,
  enhanceInputWaveformSamples,
  INPUT_WAVEFORM_REFERENCE_FLOOR,
} from "../utils/audioVisualization";
import { useLocalization } from "../i18n";
import { WaveformVisualizationVariant } from "../types";
import {
  cancelNativeWaveformRecording,
  isNativeWaveformAvailable,
  startNativeWaveformRecording,
  stopNativeWaveformRecording,
  subscribeToNativeWaveform,
} from "../services/nativeWaveform";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number;
  waveformData: number[];
  waveformVariant: WaveformVisualizationVariant;
  lastError: string | null;
  clearLastError: () => void;
}

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
};
const RECORDER_STATUS_INTERVAL_MS = 150;

export function useAudioRecorder() {
  const { t } = useLocalization();
  const usingNativeRecorder =
    Platform.OS === "ios" && isNativeWaveformAvailable();
  const recorder = useExpoAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, RECORDER_STATUS_INTERVAL_MS);
  const startTimeRef = useRef<number>(0);
  const nativeSessionIdRef = useRef<string | null>(null);
  const inputReferenceLevelRef = useRef(INPUT_WAVEFORM_REFERENCE_FLOOR);
  const [nativeRecording, setNativeRecording] = useState(false);
  const [nativeMeteringData, setNativeMeteringData] = useState(-160);
  const [lastError, setLastError] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState(
    usingNativeRecorder ? EMPTY_OSCILLOSCOPE_SAMPLES : EMPTY_VISUAL_LEVELS
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
        inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
        setNativeRecording(false);
        setNativeMeteringData(-160);
        setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);
        setLastError(event.message);
        void cancelNativeWaveformRecording(sessionId).catch(() => {
          // The native module may have already cleaned up after the failure.
        });
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
      setNativeMeteringData(
        levelToMetering(averageSampleMagnitude(samples))
      );
    });
  }, [usingNativeRecorder]);

  useEffect(() => {
    if (usingNativeRecorder) {
      if (!nativeRecording) {
        inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
        setNativeMeteringData(-160);
        setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);
      }
      return;
    }

    if (!recorderState.isRecording) {
      setWaveformData(EMPTY_VISUAL_LEVELS);
      return;
    }

    setWaveformData((previous) =>
      appendMeterHistory(previous, recorderState.metering ?? -160)
    );
  }, [
    nativeRecording,
    recorderState.isRecording,
    recorderState.metering,
    usingNativeRecorder,
  ]);

  const startRecording = useCallback(async () => {
    if (usingNativeRecorder) {
      if (nativeRecording) {
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error(t("microphonePermissionNotGranted"));
      }

      setLastError(null);
      const sessionId = `native-recorder-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      nativeSessionIdRef.current = sessionId;
      inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
      setNativeMeteringData(-160);
      setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);

      try {
        await startNativeWaveformRecording({ sessionId });
        startTimeRef.current = Date.now();
        setNativeRecording(true);
      } catch (error) {
        nativeSessionIdRef.current = null;
        setNativeRecording(false);
        throw error;
      }
      return;
    }

    if (recorderState.isRecording) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t("microphonePermissionNotGranted"));
    }

    setLastError(null);
    await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    recorder.record();
    startTimeRef.current = Date.now();
  }, [nativeRecording, recorder, recorderState.isRecording, t, usingNativeRecorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (usingNativeRecorder) {
      const sessionId = nativeSessionIdRef.current;
      if (!sessionId) {
        return null;
      }

      const duration = Date.now() - startTimeRef.current;
      nativeSessionIdRef.current = null;

      try {
        if (duration < 300) {
          await cancelNativeWaveformRecording(sessionId);
          inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
          setNativeRecording(false);
          setNativeMeteringData(-160);
          setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);
          return null;
        }

        const result = await stopNativeWaveformRecording(sessionId);
        inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
        setNativeRecording(false);
        setNativeMeteringData(-160);
        setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);

        return result.uri ?? null;
      } catch (error) {
        inputReferenceLevelRef.current = INPUT_WAVEFORM_REFERENCE_FLOOR;
        setNativeRecording(false);
        setNativeMeteringData(-160);
        setWaveformData(EMPTY_OSCILLOSCOPE_SAMPLES);
        throw error;
      }
    }

    if (!recorderState.isRecording && !recorderState.canRecord) {
      return null;
    }

    const duration = Date.now() - startTimeRef.current;
    await recorder.stop();

    if (duration < 300) {
      return null;
    }

    return recorder.uri ?? recorderState.url;
  }, [
    recorder,
    recorderState.canRecord,
    recorderState.isRecording,
    recorderState.url,
    usingNativeRecorder,
  ]);

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    isRecording: usingNativeRecorder ? nativeRecording : recorderState.isRecording,
    meteringData: usingNativeRecorder
      ? nativeMeteringData
      : recorderState.metering ?? -160,
    waveformData,
    waveformVariant: usingNativeRecorder ? "oscilloscope" : "bars",
    lastError,
    clearLastError,
    startRecording,
    stopRecording,
  };
}
