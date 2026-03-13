import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({ isRecording: false, meteringData: -160 });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone permission not granted");

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true });
    await recording.startAsync();
    recordingRef.current = recording;
    setState({ isRecording: true, meteringData: -160 });

    meteringInterval.current = setInterval(async () => {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          setState((prev) => ({ ...prev, meteringData: status.metering! }));
        }
      }
    }, 100);
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (meteringInterval.current) { clearInterval(meteringInterval.current); meteringInterval.current = null; }
    if (!recordingRef.current) return null;
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    setState({ isRecording: false, meteringData: -160 });
    return uri;
  }, []);

  return { ...state, startRecording, stopRecording };
}
