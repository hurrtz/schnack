import { useEffect, useState, useRef, useCallback } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

export interface PlayerState {
  isPlaying: boolean;
  meteringData: number;
}

export function useAudioPlayer() {
  const player = useExpoAudioPlayer(null, {
    updateInterval: 100,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const didFinishRef = useRef(false);

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;
    const audioUri = queueRef.current.shift();

    if (!audioUri) {
      setMeteringData(-160);
      return;
    }

    playingRef.current = true;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    player.replace(audioUri);
    player.play();
  }, [player]);

  useEffect(() => {
    playingRef.current = status.playing;
  }, [status.playing]);

  useEffect(() => {
    if (status.didJustFinish && !didFinishRef.current) {
      playingRef.current = false;
      void playNext();
    }

    didFinishRef.current = status.didJustFinish;
  }, [playNext, status.didJustFinish]);

  useEffect(() => {
    if (!status.playing) {
      setMeteringData(-160);
      return;
    }

    const interval = setInterval(() => {
      setMeteringData(-20 + Math.random() * 20);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [status.playing]);

  const enqueueAudio = useCallback((audioUri: string) => {
    if (cancelledRef.current) return;
    queueRef.current.push(audioUri);
    if (!playingRef.current) {
      void playNext();
    }
  }, [playNext]);

  const stopPlayback = useCallback(async () => {
    cancelledRef.current = true;
    queueRef.current = [];
    player.pause();
    player.replace(null);
    playingRef.current = false;
    setMeteringData(-160);
  }, [player]);

  const resetCancellation = useCallback(() => { cancelledRef.current = false; }, []);

  return {
    isPlaying: status.playing,
    meteringData,
    enqueueAudio,
    stopPlayback,
    resetCancellation,
  };
}
