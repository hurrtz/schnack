import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({ isRecording: false, meteringData: -160 });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    // Clean up any existing recording first
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone permission not granted");

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const { recording } = await Audio.Recording.createAsync(
      {
        isMeteringEnabled: true,
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      },
      (status) => {
        if (status.isRecording && status.metering !== undefined) {
          setState((prev) => ({ ...prev, meteringData: status.metering! }));
        }
      },
      100
    );
    recordingRef.current = recording;
    startTimeRef.current = Date.now();
    setState({ isRecording: true, meteringData: -160 });
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    const duration = Date.now() - startTimeRef.current;
    if (duration < 300) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      setState({ isRecording: false, meteringData: -160 });
      return null;
    }

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    setState({ isRecording: false, meteringData: -160 });
    return uri;
  }, []);

  return { ...state, startRecording, stopRecording };
}
