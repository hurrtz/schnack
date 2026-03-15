import { useEffect, useState, useRef, useCallback } from "react";
import * as Speech from "expo-speech";
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
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const nativeQueueRef = useRef<Array<{ text: string; voice?: string }>>([]);
  const nativeSpeakingRef = useRef(false);
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nativeSpeaking, setNativeSpeaking] = useState(false);

  const resetVisualState = useCallback(() => {
    setMeteringData(-160);
    setWaveformData(EMPTY_VISUAL_LEVELS);
  }, []);

  const stopNativeMetering = useCallback(() => {
    if (nativeIntervalRef.current) {
      clearInterval(nativeIntervalRef.current);
      nativeIntervalRef.current = null;
    }
  }, []);

  const startNativeMetering = useCallback(() => {
    stopNativeMetering();

    const baseTime = Date.now() / 1000;
    nativeIntervalRef.current = setInterval(() => {
      const levels = buildFallbackSpeechLevels(baseTime + Date.now() / 700);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, 80);
  }, [stopNativeMetering]);

  const playNextNative = useCallback(function playNextNativeInner() {
    if (nativeSpeakingRef.current || cancelledRef.current) {
      return;
    }

    const next = nativeQueueRef.current.shift();

    if (!next) {
      stopNativeMetering();
      resetVisualState();
      return;
    }

    nativeSpeakingRef.current = true;
    setNativeSpeaking(true);
    startNativeMetering();

    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).finally(() => {
      Speech.speak(next.text, {
        voice: next.voice,
        rate: 0.96,
        onDone: () => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          if (!cancelledRef.current) {
            playNextNativeInner();
          }
        },
        onStopped: () => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          stopNativeMetering();
          if (!cancelledRef.current) {
            playNextNativeInner();
          }
        },
        onError: () => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          stopNativeMetering();
          if (!cancelledRef.current) {
            playNextNativeInner();
          }
        },
      });
    });
  }, [resetVisualState, startNativeMetering, stopNativeMetering]);

  useAudioSampleListener(player, (sample) => {
    const levels = buildSampleLevels(sample.channels);

    setWaveformData((previous) => blendLevels(previous, levels, 0.28));
    setMeteringData(levelToMetering(averageLevels(levels)));
  });

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current || startingRef.current) {
      return;
    }

    const audioUri = queueRef.current.shift();

    if (!audioUri) {
      resetVisualState();
      return;
    }

    startingRef.current = true;

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (cancelledRef.current) {
        return;
      }

      player.replace(audioUri);
      player.play();
      playingRef.current = true;
    } finally {
      startingRef.current = false;
    }
  }, [player, resetVisualState]);

  useEffect(() => {
    playingRef.current = status.playing;
    if (!status.playing && !nativeSpeaking) {
      if (queueRef.current.length > 0 && !cancelledRef.current) {
        void playNext();
        return;
      }

      if (!startingRef.current) {
        resetVisualState();
      }
    }
  }, [nativeSpeaking, playNext, resetVisualState, status.playing]);

  useEffect(() => {
    if (nativeSpeaking) {
      return;
    }

    if (!status.playing) {
      resetVisualState();
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
  }, [nativeSpeaking, player.id, player.isAudioSamplingSupported, resetVisualState, status.playing]);

  const enqueueAudio = useCallback((audioUri: string) => {
    if (cancelledRef.current) return;
    queueRef.current.push(audioUri);
    if (!playingRef.current) {
      void playNext();
    }
  }, [playNext]);

  const speakText = useCallback(
    (text: string, options?: { voice?: string }) => {
      if (cancelledRef.current) {
        return;
      }

      nativeQueueRef.current.push({ text, voice: options?.voice });
      if (!nativeSpeakingRef.current) {
        playNextNative();
      }
    },
    [playNextNative]
  );

  const stopPlayback = useCallback(async () => {
    cancelledRef.current = true;
    queueRef.current = [];
    nativeQueueRef.current = [];
    player.pause();
    await Speech.stop();
    stopNativeMetering();
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    resetVisualState();
  }, [player, resetVisualState, stopNativeMetering]);

  const resetCancellation = useCallback(() => {
    cancelledRef.current = false;
    queueRef.current = [];
    nativeQueueRef.current = [];
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    player.pause();
    resetVisualState();
  }, [player, resetVisualState]);

  useEffect(() => {
    return () => {
      stopNativeMetering();
    };
  }, [stopNativeMetering]);

  return {
    isPlaying: status.playing || nativeSpeaking,
    meteringData,
    waveformData,
    enqueueAudio,
    speakText,
    stopPlayback,
    resetCancellation,
  };
}
