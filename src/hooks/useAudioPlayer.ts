import { useEffect, useState, useRef, useCallback } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioSampleListener,
  useAudioPlayerStatus,
} from "expo-audio";
import {
  EMPTY_VISUAL_LEVELS,
  averageLevels,
  blendLevels,
  buildFallbackSpeechLevels,
  buildSampleLevels,
  levelToMetering,
} from "../utils/audioVisualization";

export interface PlayerState {
  isPlaying: boolean;
  meteringData: number;
  waveformData: number[];
}

export function useAudioPlayer() {
  const player = useExpoAudioPlayer(null, {
    updateInterval: 100,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const didFinishRef = useRef(false);

  useAudioSampleListener(player, (sample) => {
    const levels = buildSampleLevels(sample.channels);

    setWaveformData((previous) => blendLevels(previous, levels, 0.28));
    setMeteringData(levelToMetering(averageLevels(levels)));
  });

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;
    const audioUri = queueRef.current.shift();

    if (!audioUri) {
      setMeteringData(-160);
      setWaveformData(EMPTY_VISUAL_LEVELS);
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
      setWaveformData(EMPTY_VISUAL_LEVELS);
      return;
    }

    if (player.isAudioSamplingSupported) {
      return;
    }

    const baseTime = player.currentTime;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const levels = buildFallbackSpeechLevels(baseTime + elapsed);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, 80);

    return () => {
      clearInterval(interval);
    };
  }, [player.id, player.isAudioSamplingSupported, status.playing]);

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
    setWaveformData(EMPTY_VISUAL_LEVELS);
  }, [player]);

  const resetCancellation = useCallback(() => { cancelledRef.current = false; }, []);

  return {
    isPlaying: status.playing,
    meteringData,
    waveformData,
    enqueueAudio,
    stopPlayback,
    resetCancellation,
  };
}
