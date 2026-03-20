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
  analyzeNativeAudioFile,
  type NativeWaveformAnalysis,
  startNativeOutputWaveformPlayback,
  stopNativeOutputWaveformPlayback,
} from "../services/nativeWaveform";
import { WaveformVisualizationVariant } from "../types";
import {
  EMPTY_VISUAL_LEVELS,
  OSCILLOSCOPE_SAMPLE_COUNT,
  averageLevels,
  averageSampleMagnitude,
  blendWaveformSamples,
  buildFallbackSpeechLevels,
  buildSampleWaveform,
  getTrailingWaveformWindow,
  levelToMetering,
} from "../utils/audioVisualization";
import { logWaveformDebug } from "../utils/waveformDebug";
import { supportsNativeOutputWaveformPlayback } from "../services/nativeWaveform";

const PLAYER_STATUS_INTERVAL_MS = 250;
const VISUAL_UPDATE_INTERVAL_MS = 150;
const OSCILLOSCOPE_TICK_INTERVAL_MS = 16;
const PLAYBACK_ROUTE_SETTLE_MS = 220;

export interface PlayerState {
  isPlaying: boolean;
  hasPendingPlayback: boolean;
  meteringData: number;
  waveformData: number[];
  waveformVariant: WaveformVisualizationVariant;
}

function nextPlaybackJobId(prefix: "audio" | "native") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAudioPlayer() {
  const usingNativeAudioQueue =
    Platform.OS === "ios" && isNativeAudioQueueAvailable();
  const supportsNativeOutputWaveform =
    supportsNativeOutputWaveformPlayback();
  const player = useExpoAudioPlayer(null, {
    updateInterval: PLAYER_STATUS_INTERVAL_MS,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const [waveformVariant, setWaveformVariant] =
    useState<WaveformVisualizationVariant>("bars");
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
    Map<
      string,
      {
        uri: string;
        diagnostics?: SpeechDiagnosticsContext;
        waveformAnalysis?: Promise<NativeWaveformAnalysis | null>;
      }
    >
  >(new Map());
  const nativeAudioQueuePendingCountRef = useRef(0);
  const nativeAudioQueuePlayingRef = useRef(false);
  const waveformAnalysisCacheRef = useRef<
    Map<string, Promise<NativeWaveformAnalysis | null>>
  >(new Map());
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
  const nativeOutputWaveformIntervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeOutputWaveformItemIdRef = useRef<string | null>(null);
  const nativeOutputWaveformStartedAtRef = useRef<number | null>(null);
  const audioSessionReadyRef = useRef(false);
  const audioSessionPromiseRef = useRef<Promise<void> | null>(null);
  const drainResolversRef = useRef<Array<() => void>>([]);
  const lastPlaybackEndedAtRef = useRef(0);
  const [nativeSpeaking, setNativeSpeaking] = useState(false);
  const [nativeAudioQueuePlaying, setNativeAudioQueuePlaying] = useState(false);

  useEffect(() => {
    logWaveformDebug("audio-player-init", {
      platform: Platform.OS,
      usingNativeAudioQueue,
      supportsNativeOutputWaveform,
      expoAudioSamplingSupported: player.isAudioSamplingSupported,
    });
  }, [player.isAudioSamplingSupported, supportsNativeOutputWaveform, usingNativeAudioQueue]);

  const resetVisualState = useCallback(() => {
    setMeteringData(-160);
    setWaveformData(EMPTY_VISUAL_LEVELS);
    setWaveformVariant("bars");
  }, []);

  const stopNativeMetering = useCallback(() => {
    if (nativeIntervalRef.current) {
      clearInterval(nativeIntervalRef.current);
      nativeIntervalRef.current = null;
    }
  }, []);

  const stopNativeOutputWaveform = useCallback(() => {
    if (usingNativeAudioQueue) {
      logWaveformDebug("output-waveform-stop-requested", {
        itemId: nativeOutputWaveformItemIdRef.current ?? null,
        usingNativeAudioQueue,
        supportsNativeOutputWaveform,
      });
      void stopNativeOutputWaveformPlayback(
        nativeOutputWaveformItemIdRef.current ?? null
      );
    }

    if (nativeOutputWaveformIntervalRef.current) {
      clearInterval(nativeOutputWaveformIntervalRef.current);
      nativeOutputWaveformIntervalRef.current = null;
    }

    nativeOutputWaveformItemIdRef.current = null;
    nativeOutputWaveformStartedAtRef.current = null;
    setWaveformVariant("bars");
  }, [supportsNativeOutputWaveform, usingNativeAudioQueue]);

  const clearNativeAudioQueueState = useCallback(() => {
    nativeAudioQueueContextsRef.current.clear();
    nativeAudioQueuePendingCountRef.current = 0;
    nativeAudioQueuePlayingRef.current = false;
    setNativeAudioQueuePlaying(false);
    stopNativeOutputWaveform();
  }, [stopNativeOutputWaveform]);

  const removeLoadedAudio = useCallback(() => {
    if (!loadedSourceRef.current) {
      return;
    }

    player.remove();
    loadedSourceRef.current = false;
  }, [player]);

  const startNativeMetering = useCallback(() => {
    stopNativeMetering();
    setWaveformVariant("bars");

    const baseTime = Date.now() / 1000;
    nativeIntervalRef.current = setInterval(() => {
      const levels = buildFallbackSpeechLevels(baseTime + Date.now() / 700);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, VISUAL_UPDATE_INTERVAL_MS);
  }, [stopNativeMetering]);

  const getWaveformAnalysis = useCallback((uri: string) => {
    const cached = waveformAnalysisCacheRef.current.get(uri);
    if (cached) {
      return cached;
    }

    const next = analyzeNativeAudioFile({
      uri,
      sampleCount: 960,
    }).catch(() => null);

    waveformAnalysisCacheRef.current.set(uri, next);
    return next;
  }, []);

  const startNativeOutputWaveform = useCallback(
    (itemId: string, analysis: NativeWaveformAnalysis) => {
      if (!analysis.samples.length || analysis.durationMs <= 0) {
        logWaveformDebug("output-waveform-skipped", {
          itemId,
          reason: "empty-analysis",
          durationMs: analysis.durationMs,
          sampleCount: analysis.samples.length,
        });
        return;
      }

      logWaveformDebug("output-waveform-primed", {
        itemId,
        durationMs: analysis.durationMs,
        sampleCount: analysis.samples.length,
        usingNativeAudioQueue,
        supportsNativeOutputWaveform,
      });
      stopNativeOutputWaveform();
      nativeOutputWaveformItemIdRef.current = itemId;
      nativeOutputWaveformStartedAtRef.current = Date.now();
      setWaveformVariant("oscilloscope");
      void startNativeOutputWaveformPlayback({
        itemId,
        samples: analysis.samples,
        durationMs: analysis.durationMs,
      });

      const tick = () => {
        if (nativeOutputWaveformItemIdRef.current !== itemId) {
          return;
        }

        const startedAt = nativeOutputWaveformStartedAtRef.current ?? Date.now();
        const progress = Math.min(
          1,
          Math.max(0, (Date.now() - startedAt) / Math.max(1, analysis.durationMs))
        );
        const samples = getTrailingWaveformWindow(
          analysis.samples,
          progress,
          OSCILLOSCOPE_SAMPLE_COUNT
        );

        setWaveformData(samples);
        setMeteringData(levelToMetering(averageSampleMagnitude(samples)));
      };

      tick();
      nativeOutputWaveformIntervalRef.current = setInterval(
        tick,
        OSCILLOSCOPE_TICK_INTERVAL_MS
      );
    },
    [stopNativeOutputWaveform, supportsNativeOutputWaveform, usingNativeAudioQueue]
  );

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

  const markPlaybackEnded = useCallback(() => {
    lastPlaybackEndedAtRef.current = Date.now();
  }, []);

  const finalizeDrainedState = useCallback(() => {
    markPlaybackEnded();
    removeLoadedAudio();
    stopNativeMetering();
    stopNativeOutputWaveform();
    clearNativeAudioQueueState();
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
  }, [
    clearNativeAudioQueueState,
    markPlaybackEnded,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    stopNativeMetering,
    stopNativeOutputWaveform,
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
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            uri: context?.uri ?? event.uri ?? null,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          stopNativeOutputWaveform();
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
          nativeOutputWaveformItemIdRef.current = itemId;
          nativeOutputWaveformStartedAtRef.current = Date.now();
          recordSpeechDiagnostic({
            requestId: context?.diagnostics?.requestId ?? event.requestId ?? undefined,
            source:
              context?.diagnostics?.source ??
              (event.source as SpeechDiagnosticsContext["source"] | null) ??
              "unknown",
            stage: "playback-started",
            message: context?.uri ?? event.uri,
          });
          if (context?.waveformAnalysis) {
            void context.waveformAnalysis.then((analysis) => {
              if (
                !analysis ||
                !analysis.samples.length ||
                cancelledRef.current ||
                !nativeAudioQueuePlayingRef.current ||
                nativeOutputWaveformItemIdRef.current !== itemId
              ) {
                return;
              }

              startNativeOutputWaveform(itemId, analysis);
            });
          }
          updatePendingPlaybackState();
          break;
        }
        case "finished": {
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            uri: context?.uri ?? event.uri ?? null,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          if (
            itemId &&
            nativeOutputWaveformItemIdRef.current === itemId
          ) {
            stopNativeOutputWaveform();
          }
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
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            uri: context?.uri ?? event.uri ?? null,
            message: event.message ?? null,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          if (
            itemId &&
            nativeOutputWaveformItemIdRef.current === itemId
          ) {
            stopNativeOutputWaveform();
          }
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
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          if (
            itemId &&
            nativeOutputWaveformItemIdRef.current === itemId
          ) {
            stopNativeOutputWaveform();
          }
          break;
        }
        case "drained": {
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          stopNativeOutputWaveform();
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
    startNativeOutputWaveform,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  ]);

  useAudioSampleListener(player, (sample) => {
    if (usingNativeAudioQueue || nativeSpeakingRef.current) {
      return;
    }

    const samples = buildSampleWaveform(sample.channels);

    setWaveformVariant("oscilloscope");
    setWaveformData((previous) => blendWaveformSamples(previous, samples, 0.16));
    setMeteringData(levelToMetering(averageSampleMagnitude(samples)));
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

    if (
      (!usingNativeAudioQueue && player.isAudioSamplingSupported) ||
      (usingNativeAudioQueue && waveformVariant === "oscilloscope")
    ) {
      return;
    }

    setWaveformVariant("bars");
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
    waveformVariant,
  ]);

  const enqueueAudio = useCallback(
    (audioUri: string, diagnostics?: SpeechDiagnosticsContext) => {
      if (cancelledRef.current) {
        return;
      }

      if (usingNativeAudioQueue) {
        const itemId = nextPlaybackJobId("audio");
        logWaveformDebug("output-audio-enqueued", {
          itemId,
          route: "native-audio-queue",
          uri: audioUri,
          usingNativeAudioQueue,
          supportsNativeOutputWaveform,
        });
        nativeAudioQueueContextsRef.current.set(itemId, {
          uri: audioUri,
          diagnostics,
          waveformAnalysis: getWaveformAnalysis(audioUri),
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

      logWaveformDebug("output-audio-enqueued", {
        route: "expo-audio-player",
        uri: audioUri,
        usingNativeAudioQueue,
        supportsNativeOutputWaveform,
      });
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
      getWaveformAnalysis,
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

  const waitForPlaybackRouteSettle = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return;
    }

    const elapsed = Date.now() - lastPlaybackEndedAtRef.current;
    const remaining = PLAYBACK_ROUTE_SETTLE_MS - elapsed;

    if (remaining <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }, []);

  const stopPlayback = useCallback(async () => {
    const hadPlayback =
      hasPendingPlaybackNow() ||
      nativeSpeakingRef.current ||
      playingRef.current ||
      startingRef.current;
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
    stopNativeOutputWaveform();
    nativeSpeakingRef.current = false;
    setNativeSpeaking(false);
    startingRef.current = false;
    playingRef.current = false;
    if (hadPlayback) {
      markPlaybackEnded();
    }
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
    stopNativeOutputWaveform,
    usingNativeAudioQueue,
    updatePendingPlaybackState,
    clearNativeAudioQueueState,
    hasPendingPlaybackNow,
    markPlaybackEnded,
  ]);

  const resetCancellation = useCallback(() => {
    const hadPlayback =
      hasPendingPlaybackNow() ||
      nativeSpeakingRef.current ||
      playingRef.current ||
      startingRef.current;
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
    if (hadPlayback) {
      markPlaybackEnded();
    }
    player.pause();
    removeLoadedAudio();
    if (usingNativeAudioQueue) {
      void stopNativeAudioQueue();
    }
    stopNativeMetering();
    stopNativeOutputWaveform();
    resetVisualState();
    resetPlaybackSession();
    updatePendingPlaybackState();
  }, [
    player,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    stopNativeMetering,
    stopNativeOutputWaveform,
    usingNativeAudioQueue,
    updatePendingPlaybackState,
    clearNativeAudioQueueState,
    hasPendingPlaybackNow,
    markPlaybackEnded,
  ]);

  useEffect(() => {
    return () => {
      stopNativeMetering();
      stopNativeOutputWaveform();
      if (usingNativeAudioQueue) {
        void stopNativeAudioQueue();
      }
      resolveDrainWaiters();
    };
  }, [
    resolveDrainWaiters,
    stopNativeMetering,
    stopNativeOutputWaveform,
    usingNativeAudioQueue,
  ]);

  return {
    isPlaying: hasPendingPlayback,
    hasPendingPlayback,
    meteringData,
    waveformData,
    waveformVariant,
    enqueueAudio,
    speakText,
    stopPlayback,
    resetCancellation,
    hasPendingPlaybackNow,
    waitForDrain,
    waitForPlaybackRouteSettle,
  };
}
