import { useEffect, useState, useRef, useCallback } from "react";
import * as Speech from "expo-speech";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioSampleListener,
  useAudioPlayerStatus,
} from "expo-audio";
import { recordSpeechDiagnostic } from "../services/speech/diagnostics";
import {
  EMPTY_VISUAL_LEVELS,
  averageLevels,
  blendLevels,
  buildFallbackSpeechLevels,
  buildSampleLevels,
  levelToMetering,
} from "../utils/audioVisualization";

const PLAYER_STATUS_INTERVAL_MS = 250;
const VISUAL_UPDATE_INTERVAL_MS = 150;

export interface PlayerState {
  isPlaying: boolean;
  hasPendingPlayback: boolean;
  meteringData: number;
  waveformData: number[];
}

function nextPlaybackJobId(prefix: "audio" | "native") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAudioPlayer() {
  const player = useExpoAudioPlayer(null, {
    updateInterval: PLAYER_STATUS_INTERVAL_MS,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const [hasPendingPlayback, setHasPendingPlayback] = useState(false);
  const queueRef = useRef<Array<{ id: string; uri: string }>>([]);
  const currentAudioRef = useRef<{ id: string; uri: string } | null>(null);
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const loadedSourceRef = useRef(false);
  const hasSeenAudioPlayingRef = useRef(false);
  const nativeQueueRef = useRef<Array<{ id: string; text: string; voice?: string }>>(
    [],
  );
  const nativeSpeakingRef = useRef(false);
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioSessionReadyRef = useRef(false);
  const audioSessionPromiseRef = useRef<Promise<void> | null>(null);
  const drainResolversRef = useRef<Array<() => void>>([]);
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

  const removeLoadedAudio = useCallback(() => {
    if (!loadedSourceRef.current) {
      return;
    }

    player.remove();
    loadedSourceRef.current = false;
  }, [player]);

  const startNativeMetering = useCallback(() => {
    stopNativeMetering();

    const baseTime = Date.now() / 1000;
    nativeIntervalRef.current = setInterval(() => {
      const levels = buildFallbackSpeechLevels(baseTime + Date.now() / 700);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, VISUAL_UPDATE_INTERVAL_MS);
  }, [stopNativeMetering]);

  const hasPendingPlaybackNow = useCallback(() => {
    return (
      startingRef.current ||
      playingRef.current ||
      currentAudioRef.current !== null ||
      queueRef.current.length > 0 ||
      nativeSpeakingRef.current ||
      nativeQueueRef.current.length > 0
    );
  }, []);

  const resolveDrainWaiters = useCallback(() => {
    if (drainResolversRef.current.length === 0) {
      return;
    }

    recordSpeechDiagnostic({
      source: "unknown",
      stage: "playback-drained",
    });

    const resolvers = [...drainResolversRef.current];
    drainResolversRef.current = [];
    resolvers.forEach((resolve) => resolve());
  }, []);

  const updatePendingPlaybackState = useCallback(() => {
    const nextState = hasPendingPlaybackNow();
    setHasPendingPlayback(nextState);

    if (!nextState) {
      resolveDrainWaiters();
    }
  }, [hasPendingPlaybackNow, resolveDrainWaiters]);

  const resetPlaybackSession = useCallback(() => {
    audioSessionReadyRef.current = false;
    audioSessionPromiseRef.current = null;
  }, []);

  const finalizeDrainedState = useCallback(() => {
    removeLoadedAudio();
    stopNativeMetering();
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
  }, [
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    stopNativeMetering,
    updatePendingPlaybackState,
  ]);

  const ensurePlaybackSession = useCallback(async () => {
    if (audioSessionReadyRef.current) {
      return;
    }

    if (!audioSessionPromiseRef.current) {
      audioSessionPromiseRef.current = setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      })
        .then(() => {
          audioSessionReadyRef.current = true;
        })
        .finally(() => {
          audioSessionPromiseRef.current = null;
        });
    }

    await audioSessionPromiseRef.current;
  }, []);

  const playNextAudio = useCallback(async () => {
    if (
      playingRef.current ||
      startingRef.current ||
      nativeSpeakingRef.current ||
      cancelledRef.current
    ) {
      return;
    }

    const next = queueRef.current.shift();

    if (!next) {
      finalizeDrainedState();
      return;
    }

    startingRef.current = true;
    currentAudioRef.current = next;
    updatePendingPlaybackState();

    try {
      await ensurePlaybackSession();

      if (cancelledRef.current) {
        queueRef.current.unshift(next);
        currentAudioRef.current = null;
        return;
      }

      player.replace(next.uri);
      loadedSourceRef.current = true;
      player.play();
      playingRef.current = true;
    } catch (error) {
      currentAudioRef.current = null;
      playingRef.current = false;
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-stopped",
        message:
          error instanceof Error
            ? error.message
            : "Audio playback could not be started.",
      });
      finalizeDrainedState();
    } finally {
      startingRef.current = false;
      updatePendingPlaybackState();
    }
  }, [ensurePlaybackSession, finalizeDrainedState, player, updatePendingPlaybackState]);

  const playNextNative = useCallback(async () => {
    if (
      nativeSpeakingRef.current ||
      playingRef.current ||
      startingRef.current ||
      cancelledRef.current
    ) {
      return;
    }

    const next = nativeQueueRef.current.shift();

    if (!next) {
      finalizeDrainedState();
      return;
    }

    currentAudioRef.current = null;
    updatePendingPlaybackState();

    try {
      await ensurePlaybackSession();

      if (cancelledRef.current) {
        nativeQueueRef.current.unshift(next);
        updatePendingPlaybackState();
        return;
      }

      nativeSpeakingRef.current = true;
      setNativeSpeaking(true);
      startNativeMetering();
      updatePendingPlaybackState();
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-started",
        actualRoute: "native",
        voice: next.voice ?? null,
        textLength: next.text.trim().length,
      });

      Speech.speak(next.text, {
        voice: next.voice,
        rate: 0.96,
        onDone: () => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          recordSpeechDiagnostic({
            source: "unknown",
            stage: "playback-finished",
            actualRoute: "native",
            voice: next.voice ?? null,
            textLength: next.text.trim().length,
          });
          updatePendingPlaybackState();
          if (!cancelledRef.current) {
            if (queueRef.current.length > 0) {
              void playNextAudio();
            } else {
              void playNextNative();
            }
          } else {
            finalizeDrainedState();
          }
        },
        onStopped: () => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          stopNativeMetering();
          recordSpeechDiagnostic({
            source: "unknown",
            stage: "playback-stopped",
            actualRoute: "native",
            voice: next.voice ?? null,
            textLength: next.text.trim().length,
          });
          updatePendingPlaybackState();
          if (!cancelledRef.current) {
            if (queueRef.current.length > 0) {
              void playNextAudio();
            } else {
              void playNextNative();
            }
          } else {
            finalizeDrainedState();
          }
        },
        onError: (error) => {
          nativeSpeakingRef.current = false;
          setNativeSpeaking(false);
          stopNativeMetering();
          recordSpeechDiagnostic({
            source: "unknown",
            stage: "playback-stopped",
            actualRoute: "native",
            voice: next.voice ?? null,
            textLength: next.text.trim().length,
            message:
              error instanceof Error
                ? error.message
                : "Native speech playback failed.",
          });
          updatePendingPlaybackState();
          if (!cancelledRef.current) {
            if (queueRef.current.length > 0) {
              void playNextAudio();
            } else {
              void playNextNative();
            }
          } else {
            finalizeDrainedState();
          }
        },
      });
    } catch (error) {
      nativeSpeakingRef.current = false;
      setNativeSpeaking(false);
      stopNativeMetering();
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-stopped",
        actualRoute: "native",
        voice: next.voice ?? null,
        textLength: next.text.trim().length,
        message:
          error instanceof Error
            ? error.message
            : "Native playback session could not be started.",
      });
      updatePendingPlaybackState();
      finalizeDrainedState();
    }
  }, [
    ensurePlaybackSession,
    finalizeDrainedState,
    playNextAudio,
    startNativeMetering,
    stopNativeMetering,
    updatePendingPlaybackState,
  ]);

  useAudioSampleListener(player, (sample) => {
    const levels = buildSampleLevels(sample.channels);

    setWaveformData((previous) => blendLevels(previous, levels, 0.28));
    setMeteringData(levelToMetering(averageLevels(levels)));
  });

  useEffect(() => {
    if (status.playing) {
      playingRef.current = true;
      if (currentAudioRef.current && !hasSeenAudioPlayingRef.current) {
        hasSeenAudioPlayingRef.current = true;
        recordSpeechDiagnostic({
          source: "unknown",
          stage: "playback-started",
          textLength: undefined,
          message: currentAudioRef.current.uri,
        });
      }
      updatePendingPlaybackState();
      return;
    }

    if (currentAudioRef.current && hasSeenAudioPlayingRef.current) {
      const finishedAudio = currentAudioRef.current;
      currentAudioRef.current = null;
      hasSeenAudioPlayingRef.current = false;
      playingRef.current = false;
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-finished",
        message: finishedAudio.uri,
      });
      updatePendingPlaybackState();

      if (!cancelledRef.current) {
        if (queueRef.current.length > 0) {
          void playNextAudio();
          return;
        }

        if (nativeQueueRef.current.length > 0) {
          void playNextNative();
          return;
        }
      }

      if (!startingRef.current && !nativeSpeakingRef.current) {
        finalizeDrainedState();
      }
      return;
    }

    if (!nativeSpeakingRef.current && !cancelledRef.current) {
      if (
        queueRef.current.length > 0 &&
        !playingRef.current &&
        !startingRef.current
      ) {
        void playNextAudio();
        return;
      }

      if (
        nativeQueueRef.current.length > 0 &&
        !playingRef.current &&
        !startingRef.current
      ) {
        void playNextNative();
        return;
      }
    }

    if (
      !startingRef.current &&
      !playingRef.current &&
      !nativeSpeakingRef.current &&
      queueRef.current.length === 0 &&
      nativeQueueRef.current.length === 0
    ) {
      finalizeDrainedState();
    }
  }, [
    finalizeDrainedState,
    playNextAudio,
    playNextNative,
    status.playing,
    updatePendingPlaybackState,
  ]);

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
    }, VISUAL_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [nativeSpeaking, player.currentTime, player.id, player.isAudioSamplingSupported, resetVisualState, status.playing]);

  const enqueueAudio = useCallback(
    (audioUri: string) => {
      if (cancelledRef.current) {
        return;
      }

      queueRef.current.push({
        id: nextPlaybackJobId("audio"),
        uri: audioUri,
      });
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-enqueued",
        message: audioUri,
      });
      updatePendingPlaybackState();

      if (!playingRef.current && !startingRef.current && !nativeSpeakingRef.current) {
        void playNextAudio();
      }
    },
    [playNextAudio, updatePendingPlaybackState],
  );

  const speakText = useCallback(
    (text: string, options?: { voice?: string }) => {
      if (cancelledRef.current) {
        return;
      }

      nativeQueueRef.current.push({
        id: nextPlaybackJobId("native"),
        text,
        voice: options?.voice,
      });
      recordSpeechDiagnostic({
        source: "unknown",
        stage: "playback-enqueued",
        actualRoute: "native",
        voice: options?.voice ?? null,
        textLength: text.trim().length,
      });
      updatePendingPlaybackState();

      if (!nativeSpeakingRef.current && !playingRef.current && !startingRef.current) {
        void playNextNative();
      }
    },
    [playNextNative, updatePendingPlaybackState],
  );

  const waitForDrain = useCallback(() => {
    if (!hasPendingPlaybackNow()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      drainResolversRef.current.push(resolve);
    });
  }, [hasPendingPlaybackNow]);

  const stopPlayback = useCallback(async () => {
    cancelledRef.current = true;
    queueRef.current = [];
    nativeQueueRef.current = [];
    currentAudioRef.current = null;
    hasSeenAudioPlayingRef.current = false;
    player.pause();
    removeLoadedAudio();
    await Speech.stop();
    stopNativeMetering();
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
    recordSpeechDiagnostic({
      source: "unknown",
      stage: "playback-stopped",
      message: "Playback stopped explicitly.",
    });
  }, [
    player,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    stopNativeMetering,
    updatePendingPlaybackState,
  ]);

  const resetCancellation = useCallback(() => {
    cancelledRef.current = false;
    queueRef.current = [];
    nativeQueueRef.current = [];
    currentAudioRef.current = null;
    hasSeenAudioPlayingRef.current = false;
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    player.pause();
    removeLoadedAudio();
    stopNativeMetering();
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
  }, [
    player,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    stopNativeMetering,
    updatePendingPlaybackState,
  ]);

  useEffect(() => {
    return () => {
      stopNativeMetering();
      resolveDrainWaiters();
    };
  }, [resolveDrainWaiters, stopNativeMetering]);

  return {
    isPlaying: hasPendingPlayback,
    hasPendingPlayback,
    meteringData,
    waveformData,
    enqueueAudio,
    speakText,
    stopPlayback,
    resetCancellation,
    hasPendingPlaybackNow,
    waitForDrain,
  };
}
