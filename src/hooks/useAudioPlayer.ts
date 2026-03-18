import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioSampleListener,
  useAudioPlayerStatus,
} from "expo-audio";
import {
  type SpeechDiagnosticsContext,
  recordSpeechDiagnostic,
} from "../services/speech/diagnostics";
import {
  enqueueNativeAudioQueueItem,
  isNativeAudioQueueAvailable,
  prepareNativeAudioQueue,
  startNativeAudioQueue,
  stopNativeAudioQueue,
  subscribeToNativeAudioQueue,
  type NativeAudioQueueEvent,
} from "../services/nativeAudioQueue";
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
  const usingNativeAudioQueue =
    Platform.OS === "ios" && isNativeAudioQueueAvailable();
  const player = useExpoAudioPlayer(null, {
    updateInterval: PLAYER_STATUS_INTERVAL_MS,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const [hasPendingPlayback, setHasPendingPlayback] = useState(false);
  const queueRef = useRef<
    Array<{ id: string; uri: string; diagnostics?: SpeechDiagnosticsContext }>
  >([]);
  const currentAudioRef = useRef<{
    id: string;
    uri: string;
    diagnostics?: SpeechDiagnosticsContext;
  } | null>(null);
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const loadedSourceRef = useRef(false);
  const hasSeenAudioPlayingRef = useRef(false);
  const nativeAudioQueueContextsRef = useRef<
    Map<string, { uri: string; diagnostics?: SpeechDiagnosticsContext }>
  >(new Map());
  const nativeAudioQueuePendingCountRef = useRef(0);
  const nativeAudioQueuePlayingRef = useRef(false);
  const nativeQueueRef = useRef<
    Array<{
      id: string;
      text: string;
      voice?: string;
      diagnostics?: SpeechDiagnosticsContext;
    }>
  >([]);
  const nativeSpeakingRef = useRef(false);
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioSessionReadyRef = useRef(false);
  const audioSessionPromiseRef = useRef<Promise<void> | null>(null);
  const drainResolversRef = useRef<Array<() => void>>([]);
  const [nativeSpeaking, setNativeSpeaking] = useState(false);
  const [nativeAudioQueuePlaying, setNativeAudioQueuePlaying] = useState(false);

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

  const clearNativeAudioQueueState = useCallback(() => {
    nativeAudioQueueContextsRef.current.clear();
    nativeAudioQueuePendingCountRef.current = 0;
    nativeAudioQueuePlayingRef.current = false;
    setNativeAudioQueuePlaying(false);
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
    const hasAudioQueuePending = usingNativeAudioQueue
      ? nativeAudioQueuePendingCountRef.current > 0 ||
        nativeAudioQueuePlayingRef.current
      : startingRef.current ||
        playingRef.current ||
        currentAudioRef.current !== null ||
        queueRef.current.length > 0;

    return (
      hasAudioQueuePending ||
      nativeSpeakingRef.current ||
      nativeQueueRef.current.length > 0
    );
  }, [usingNativeAudioQueue]);

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
    clearNativeAudioQueueState();
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
  }, [
    clearNativeAudioQueueState,
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

  const ensureAudioQueuePlaybackSession = useCallback(async () => {
    if (!usingNativeAudioQueue) {
      await ensurePlaybackSession();
      return;
    }

    await ensurePlaybackSession();
    await prepareNativeAudioQueue();
  }, [ensurePlaybackSession, usingNativeAudioQueue]);

  const playNextAudio = useCallback(async () => {
    if (usingNativeAudioQueue) {
      return;
    }

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
        requestId: next.diagnostics?.requestId,
        source: next.diagnostics?.source ?? "unknown",
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
  }, [
    ensurePlaybackSession,
    finalizeDrainedState,
    player,
    usingNativeAudioQueue,
    updatePendingPlaybackState,
  ]);

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
        requestId: next.diagnostics?.requestId,
        source: next.diagnostics?.source ?? "unknown",
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
            requestId: next.diagnostics?.requestId,
            source: next.diagnostics?.source ?? "unknown",
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
            requestId: next.diagnostics?.requestId,
            source: next.diagnostics?.source ?? "unknown",
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
            requestId: next.diagnostics?.requestId,
            source: next.diagnostics?.source ?? "unknown",
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
        requestId: next.diagnostics?.requestId,
        source: next.diagnostics?.source ?? "unknown",
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

  useEffect(() => {
    if (!usingNativeAudioQueue) {
      return;
    }

    const handleNativeAudioQueueEvent = (event: NativeAudioQueueEvent) => {
      const itemId = event.itemId ?? "";
      const context = itemId
        ? nativeAudioQueueContextsRef.current.get(itemId)
        : undefined;

      switch (event.type) {
        case "started": {
          if (context) {
            currentAudioRef.current = {
              id: itemId,
              uri: context.uri,
              diagnostics: context.diagnostics,
            };
          }
          hasSeenAudioPlayingRef.current = true;
          playingRef.current = true;
          nativeAudioQueuePlayingRef.current = true;
          setNativeAudioQueuePlaying(true);
          recordSpeechDiagnostic({
            requestId: context?.diagnostics?.requestId ?? event.requestId ?? undefined,
            source:
              context?.diagnostics?.source ??
              (event.source as SpeechDiagnosticsContext["source"] | null) ??
              "unknown",
            stage: "playback-started",
            message: context?.uri ?? event.uri,
          });
          updatePendingPlaybackState();
          break;
        }
        case "finished": {
          if (context) {
            recordSpeechDiagnostic({
              requestId: context.diagnostics?.requestId ?? event.requestId ?? undefined,
              source:
                context.diagnostics?.source ??
                (event.source as SpeechDiagnosticsContext["source"] | null) ??
                "unknown",
              stage: "playback-finished",
              message: context.uri,
            });
          }

          if (itemId) {
            nativeAudioQueueContextsRef.current.delete(itemId);
          }
          nativeAudioQueuePendingCountRef.current = Math.max(
            0,
            nativeAudioQueuePendingCountRef.current - 1,
          );
          if (nativeAudioQueuePendingCountRef.current === 0) {
            currentAudioRef.current = null;
            hasSeenAudioPlayingRef.current = false;
            playingRef.current = false;
            nativeAudioQueuePlayingRef.current = false;
            setNativeAudioQueuePlaying(false);
          }
          updatePendingPlaybackState();
          if (
            !cancelledRef.current &&
            nativeAudioQueuePendingCountRef.current === 0 &&
            nativeQueueRef.current.length > 0
          ) {
            void playNextNative();
          }
          break;
        }
        case "failed": {
          if (context) {
            recordSpeechDiagnostic({
              requestId: context.diagnostics?.requestId ?? event.requestId ?? undefined,
              source:
                context.diagnostics?.source ??
                (event.source as SpeechDiagnosticsContext["source"] | null) ??
                "unknown",
              stage: "playback-stopped",
              message: event.message ?? context.uri,
            });
          }

          if (itemId) {
            nativeAudioQueueContextsRef.current.delete(itemId);
          }
          nativeAudioQueuePendingCountRef.current = Math.max(
            0,
            nativeAudioQueuePendingCountRef.current - 1,
          );
          if (nativeAudioQueuePendingCountRef.current === 0) {
            currentAudioRef.current = null;
            hasSeenAudioPlayingRef.current = false;
            playingRef.current = false;
            nativeAudioQueuePlayingRef.current = false;
            setNativeAudioQueuePlaying(false);
          }
          updatePendingPlaybackState();
          if (
            !cancelledRef.current &&
            nativeAudioQueuePendingCountRef.current === 0 &&
            nativeQueueRef.current.length > 0
          ) {
            void playNextNative();
          }
          break;
        }
        case "stopped": {
          break;
        }
        case "drained": {
          currentAudioRef.current = null;
          hasSeenAudioPlayingRef.current = false;
          playingRef.current = false;
          nativeAudioQueuePlayingRef.current = false;
          setNativeAudioQueuePlaying(false);
          nativeAudioQueuePendingCountRef.current = 0;
          nativeAudioQueueContextsRef.current.clear();
          updatePendingPlaybackState();

          if (!cancelledRef.current && nativeQueueRef.current.length > 0) {
            void playNextNative();
          } else {
            finalizeDrainedState();
          }
          break;
        }
      }
    };

    return subscribeToNativeAudioQueue(handleNativeAudioQueueEvent);
  }, [
    finalizeDrainedState,
    playNextNative,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  ]);

  useAudioSampleListener(player, (sample) => {
    const levels = buildSampleLevels(sample.channels);

    setWaveformData((previous) => blendLevels(previous, levels, 0.28));
    setMeteringData(levelToMetering(averageLevels(levels)));
  });

  useEffect(() => {
    if (usingNativeAudioQueue) {
      if (
        !nativeSpeakingRef.current &&
        !cancelledRef.current &&
        nativeQueueRef.current.length > 0 &&
        nativeAudioQueuePendingCountRef.current === 0 &&
        !nativeAudioQueuePlayingRef.current
      ) {
        void playNextNative();
        return;
      }

      if (
        !startingRef.current &&
        !nativeSpeakingRef.current &&
        nativeAudioQueuePendingCountRef.current === 0 &&
        !nativeAudioQueuePlayingRef.current &&
        nativeQueueRef.current.length === 0
      ) {
        finalizeDrainedState();
      }
      return;
    }

    if (status.playing) {
      playingRef.current = true;
      if (currentAudioRef.current && !hasSeenAudioPlayingRef.current) {
        hasSeenAudioPlayingRef.current = true;
        recordSpeechDiagnostic({
          requestId: currentAudioRef.current.diagnostics?.requestId,
          source: currentAudioRef.current.diagnostics?.source ?? "unknown",
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
        requestId: finishedAudio.diagnostics?.requestId,
        source: finishedAudio.diagnostics?.source ?? "unknown",
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
    usingNativeAudioQueue,
    updatePendingPlaybackState,
  ]);

  useEffect(() => {
    const clipPlaybackActive = usingNativeAudioQueue
      ? nativeAudioQueuePlaying
      : status.playing;

    if (nativeSpeaking) {
      return;
    }

    if (!clipPlaybackActive) {
      resetVisualState();
      return;
    }

    if (!usingNativeAudioQueue && player.isAudioSamplingSupported) {
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
  }, [
    nativeSpeaking,
    nativeAudioQueuePlaying,
    player.currentTime,
    player.id,
    player.isAudioSamplingSupported,
    resetVisualState,
    status.playing,
    usingNativeAudioQueue,
  ]);

  const enqueueAudio = useCallback(
    (audioUri: string, diagnostics?: SpeechDiagnosticsContext) => {
      if (cancelledRef.current) {
        return;
      }

      if (usingNativeAudioQueue) {
        const itemId = nextPlaybackJobId("audio");
        nativeAudioQueueContextsRef.current.set(itemId, {
          uri: audioUri,
          diagnostics,
        });
        nativeAudioQueuePendingCountRef.current += 1;
        recordSpeechDiagnostic({
          requestId: diagnostics?.requestId,
          source: diagnostics?.source ?? "unknown",
          stage: "playback-enqueued",
          message: audioUri,
        });
        updatePendingPlaybackState();

        void (async () => {
          try {
            await ensureAudioQueuePlaybackSession();

            if (cancelledRef.current) {
              nativeAudioQueueContextsRef.current.delete(itemId);
              nativeAudioQueuePendingCountRef.current = Math.max(
                0,
                nativeAudioQueuePendingCountRef.current - 1,
              );
              updatePendingPlaybackState();
              return;
            }

            await enqueueNativeAudioQueueItem({
              uri: audioUri,
              itemId,
              requestId: diagnostics?.requestId,
              source: diagnostics?.source ?? "unknown",
            });
            await startNativeAudioQueue();
          } catch (error) {
            nativeAudioQueueContextsRef.current.delete(itemId);
            nativeAudioQueuePendingCountRef.current = Math.max(
              0,
              nativeAudioQueuePendingCountRef.current - 1,
            );
            recordSpeechDiagnostic({
              requestId: diagnostics?.requestId,
              source: diagnostics?.source ?? "unknown",
              stage: "playback-stopped",
              message:
                error instanceof Error
                  ? error.message
                  : "Native audio queue playback could not be started.",
            });
            updatePendingPlaybackState();
            if (
              nativeAudioQueuePendingCountRef.current === 0 &&
              !nativeSpeakingRef.current &&
              nativeQueueRef.current.length === 0
            ) {
              finalizeDrainedState();
            }
          }
        })();
        return;
      }

      queueRef.current.push({
        id: nextPlaybackJobId("audio"),
        uri: audioUri,
        diagnostics,
      });
      recordSpeechDiagnostic({
        requestId: diagnostics?.requestId,
        source: diagnostics?.source ?? "unknown",
        stage: "playback-enqueued",
        message: audioUri,
      });
      updatePendingPlaybackState();

      if (
        !playingRef.current &&
        !startingRef.current &&
        !nativeSpeakingRef.current
      ) {
        void playNextAudio();
      }
    },
    [
      ensureAudioQueuePlaybackSession,
      finalizeDrainedState,
      playNextAudio,
      updatePendingPlaybackState,
      usingNativeAudioQueue,
    ],
  );

  const speakText = useCallback(
    (
      text: string,
      options?: { voice?: string; diagnostics?: SpeechDiagnosticsContext },
    ) => {
      if (cancelledRef.current) {
        return;
      }

      nativeQueueRef.current.push({
        id: nextPlaybackJobId("native"),
        text,
        voice: options?.voice,
        diagnostics: options?.diagnostics,
      });
      recordSpeechDiagnostic({
        requestId: options?.diagnostics?.requestId,
        source: options?.diagnostics?.source ?? "unknown",
        stage: "playback-enqueued",
        actualRoute: "native",
        voice: options?.voice ?? null,
        textLength: text.trim().length,
      });
      updatePendingPlaybackState();

      if (
        !nativeSpeakingRef.current &&
        !playingRef.current &&
        !startingRef.current
      ) {
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
    clearNativeAudioQueueState();
    player.pause();
    removeLoadedAudio();
    if (usingNativeAudioQueue) {
      await stopNativeAudioQueue();
    }
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
    usingNativeAudioQueue,
    updatePendingPlaybackState,
    clearNativeAudioQueueState,
  ]);

  const resetCancellation = useCallback(() => {
    cancelledRef.current = false;
    queueRef.current = [];
    nativeQueueRef.current = [];
    currentAudioRef.current = null;
    hasSeenAudioPlayingRef.current = false;
    clearNativeAudioQueueState();
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    player.pause();
    removeLoadedAudio();
    if (usingNativeAudioQueue) {
      void stopNativeAudioQueue();
    }
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
    usingNativeAudioQueue,
    updatePendingPlaybackState,
    clearNativeAudioQueueState,
  ]);

  useEffect(() => {
    return () => {
      stopNativeMetering();
      if (usingNativeAudioQueue) {
        void stopNativeAudioQueue();
      }
      resolveDrainWaiters();
    };
  }, [resolveDrainWaiters, stopNativeMetering, usingNativeAudioQueue]);

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
