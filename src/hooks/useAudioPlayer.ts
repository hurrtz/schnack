import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export interface PlayerState {
  isPlaying: boolean;
  meteringData: number;
}

export function useAudioPlayer() {
  const [state, setState] = useState<PlayerState>({ isPlaying: false, meteringData: -160 });
  const soundRef = useRef<Audio.Sound | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;
    if (queueRef.current.length === 0) { setState({ isPlaying: false, meteringData: -160 }); return; }

    playingRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: true }));
    const audioUri = queueRef.current.shift()!;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
    soundRef.current = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        if (meteringIntervalRef.current) { clearInterval(meteringIntervalRef.current); meteringIntervalRef.current = null; }
        sound.unloadAsync();
        soundRef.current = null;
        playingRef.current = false;
        playNext();
      }
    });

    await sound.playAsync();
    meteringIntervalRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, meteringData: -20 + Math.random() * 20 }));
    }, 100);
  }, []);

  const enqueueAudio = useCallback((audioUri: string) => {
    if (cancelledRef.current) return;
    queueRef.current.push(audioUri);
    if (!playingRef.current) playNext();
  }, [playNext]);

  const stopPlayback = useCallback(async () => {
    cancelledRef.current = true;
    queueRef.current = [];
    if (meteringIntervalRef.current) { clearInterval(meteringIntervalRef.current); meteringIntervalRef.current = null; }
    if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
    playingRef.current = false;
    setState({ isPlaying: false, meteringData: -160 });
  }, []);

  const resetCancellation = useCallback(() => { cancelledRef.current = false; }, []);

  return { ...state, enqueueAudio, stopPlayback, resetCancellation };
}
