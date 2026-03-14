import { useRef, useCallback } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number;
}

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
};

export function useAudioRecorder() {
  const recorder = useExpoAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    if (recorderState.isRecording) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission not granted");
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    recorder.record();
    startTimeRef.current = Date.now();
  }, [recorder, recorderState.isRecording]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recorderState.isRecording && !recorderState.canRecord) {
      return null;
    }

    const duration = Date.now() - startTimeRef.current;
    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    if (duration < 300) {
      return null;
    }

    return recorder.uri ?? recorderState.url;
  }, [recorder, recorderState.canRecord, recorderState.isRecording, recorderState.url]);

  return {
    isRecording: recorderState.isRecording,
    meteringData: recorderState.metering ?? -160,
    startRecording,
    stopRecording,
  };
}
