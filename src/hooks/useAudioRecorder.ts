import { useEffect, useRef, useCallback, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import {
  EMPTY_VISUAL_LEVELS,
  appendMeterHistory,
} from "../utils/audioVisualization";
import { useLocalization } from "../i18n";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number;
  waveformData: number[];
}

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
};

export function useAudioRecorder() {
  const { t } = useLocalization();
  const recorder = useExpoAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const startTimeRef = useRef<number>(0);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);

  useEffect(() => {
    if (!recorderState.isRecording) {
      setWaveformData(EMPTY_VISUAL_LEVELS);
      return;
    }

    setWaveformData((previous) =>
      appendMeterHistory(previous, recorderState.metering ?? -160)
    );
  }, [recorderState.isRecording, recorderState.metering]);

  const startRecording = useCallback(async () => {
    if (recorderState.isRecording) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t("microphonePermissionNotGranted"));
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    recorder.record();
    startTimeRef.current = Date.now();
  }, [recorder, recorderState.isRecording, t]);

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
    waveformData,
    startRecording,
    stopRecording,
  };
}
