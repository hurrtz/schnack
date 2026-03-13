import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

export interface PlayerState {
  isPlaying: boolean;
  meteringData: number;
}

export function useAudioPlayer() {
  const [state, setState] = useState<PlayerState>({ isPlaying: false, meteringData: -160 });
  const soundRef = useRef<Audio.Sound | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;
    if (queueRef.current.length === 0) { setState({ isPlaying: false, meteringData: -160 }); return; }

    playingRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: true }));
    const audioData = queueRef.current.shift()!;

    const path = `${FileSystem.cacheDirectory}tts-${Date.now()}.aac`;
    await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(audioData), { encoding: FileSystem.EncodingType.Base64 });

    const { sound } = await Audio.Sound.createAsync({ uri: path });
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

  const enqueueAudio = useCallback((audioData: ArrayBuffer) => {
    if (cancelledRef.current) return;
    queueRef.current.push(audioData);
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
