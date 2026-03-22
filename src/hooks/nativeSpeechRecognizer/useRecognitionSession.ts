import { useCallback, useRef, useState } from "react";
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import type { TranslationKey } from "../../i18n";
import {
  EMPTY_OSCILLOSCOPE_SAMPLES,
  EMPTY_VISUAL_LEVELS,
  INPUT_WAVEFORM_REFERENCE_FLOOR,
} from "../../utils/audioVisualization";
import { buildErrorMessage } from "./shared";

type StopResolver = (value: string | null) => void;
type StopRejecter = (error: Error) => void;

export interface RecognitionSession {
  isRecording: boolean;
  lastError: string | null;
  meteringData: number;
  waveformData: number[];
  isRecordingRef: React.MutableRefObject<boolean>;
  startedAtRef: React.MutableRefObject<number>;
  latestTranscriptRef: React.MutableRefObject<string>;
  finalTranscriptRef: React.MutableRefObject<string>;
  stopResolverRef: React.MutableRefObject<StopResolver | null>;
  stopRejectRef: React.MutableRefObject<StopRejecter | null>;
  stopRequestedRef: React.MutableRefObject<boolean>;
  abortRequestedRef: React.MutableRefObject<boolean>;
  nativeSessionIdRef: React.MutableRefObject<string | null>;
  inputReferenceLevelRef: React.MutableRefObject<number>;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setLastError: React.Dispatch<React.SetStateAction<string | null>>;
  setMeteringData: React.Dispatch<React.SetStateAction<number>>;
  setWaveformData: React.Dispatch<React.SetStateAction<number[]>>;
  resetVisualState: () => void;
  clearPendingResolution: () => void;
  resolvePendingStop: (value: string | null) => void;
  rejectPendingStop: (error: Error) => void;
  handleResult: (event: ExpoSpeechRecognitionResultEvent) => void;
  handleError: (event: ExpoSpeechRecognitionErrorEvent) => void;
  clearLastError: () => void;
}

interface UseRecognitionSessionParams {
  t: (
    key: TranslationKey,
    params?: Record<string, string | number | undefined>,
  ) => string;
  usingNativeRecorder: boolean;
}

export function useRecognitionSession({
  t,
  usingNativeRecorder,
}: UseRecognitionSessionParams): RecognitionSession {
  const emptyWaveform = usingNativeRecorder
    ? EMPTY_OSCILLOSCOPE_SAMPLES
    : EMPTY_VISUAL_LEVELS;
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState<number[]>(emptyWaveform);
  const isRecordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const latestTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const stopResolverRef = useRef<StopResolver | null>(null);
  const stopRejectRef = useRef<StopRejecter | null>(null);
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
    [clearPendingResolution, resetVisualState],
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
    [clearPendingResolution, resetVisualState],
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
    [rejectPendingStop, resolvePendingStop, t],
  );

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    isRecording,
    lastError,
    meteringData,
    waveformData,
    isRecordingRef,
    startedAtRef,
    latestTranscriptRef,
    finalTranscriptRef,
    stopResolverRef,
    stopRejectRef,
    stopRequestedRef,
    abortRequestedRef,
    nativeSessionIdRef,
    inputReferenceLevelRef,
    setIsRecording,
    setLastError,
    setMeteringData,
    setWaveformData,
    resetVisualState,
    clearPendingResolution,
    resolvePendingStop,
    rejectPendingStop,
    handleResult,
    handleError,
    clearLastError,
  };
}
