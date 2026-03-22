import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";
import {
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
} from "../services/nativeAudioQueue";
import {
  type NativeWaveformAnalysis,
  supportsNativeOutputWaveformPlayback,
} from "../services/nativeWaveform";
import { WaveformVisualizationVariant } from "../types";
import {
  EMPTY_VISUAL_LEVELS,
  averageLevels,
  averageSampleMagnitude,
  blendWaveformSamples,
  buildFallbackSpeechLevels,
  buildSampleWaveform,
  levelToMetering,
} from "../utils/audioVisualization";
import { logWaveformDebug } from "../utils/waveformDebug";
import {
  nextPlaybackJobId,
  PLAYER_STATUS_INTERVAL_MS,
  VISUAL_UPDATE_INTERVAL_MS,
} from "./audioPlayer/shared";
import { useNativeAudioQueueSubscription } from "./audioPlayer/useNativeAudioQueueSubscription";
import { useNativeOutputWaveformController } from "./audioPlayer/useNativeOutputWaveformController";
import { useNativeSpeechPlayback } from "./audioPlayer/useNativeSpeechPlayback";
import { usePendingPlaybackState } from "./audioPlayer/usePendingPlaybackState";
import { usePlaybackSession } from "./audioPlayer/usePlaybackSession";

export function useAudioPlayer() {
  const usingNativeAudioQueue =
    Platform.OS === "ios" && isNativeAudioQueueAvailable();
  const supportsNativeOutputWaveform =
    supportsNativeOutputWaveformPlayback();
  const player = useExpoAudioPlayer(null, {
    updateInterval: PLAYER_STATUS_INTERVAL_MS,
    keepAudioSessionActive: false,
  });
  const status = useAudioPlayerStatus(player);
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const [waveformVariant, setWaveformVariant] =
    useState<WaveformVisualizationVariant>("bars");
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
  const nativeQueueRef = useRef<
    Array<{
      id: string;
      text: string;
      voice?: string;
      diagnostics?: SpeechDiagnosticsContext;
    }>
  >([]);
  const nativeSpeakingRef = useRef(false);
  const [nativeAudioQueuePlaying, setNativeAudioQueuePlaying] =
    useState(false);
  const { ensurePlaybackSession, resetPlaybackSession } =
    usePlaybackSession();
  const {
    clearNativeAudioQueueState,
    getWaveformAnalysis,
    nativeOutputWaveformItemIdRef,
    nativeOutputWaveformStartedAtRef,
    startNativeMetering,
    startNativeOutputWaveform,
    stopNativeMetering,
    stopNativeOutputWaveform,
  } = useNativeOutputWaveformController({
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    setMeteringData,
    setNativeAudioQueuePlaying,
    setWaveformData,
    setWaveformVariant,
    supportsNativeOutputWaveform,
    usingNativeAudioQueue,
  });
  const {
    hasPendingPlayback,
    hasPendingPlaybackNow,
    markPlaybackEnded,
    resolveDrainWaiters,
    updatePendingPlaybackState,
    waitForDrain,
    waitForPlaybackRouteSettle: waitForPlaybackRouteSettleInternal,
  } = usePendingPlaybackState({
    currentAudioRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    nativeQueueRef,
    nativeSpeakingRef,
    playingRef,
    queueRef,
    startingRef,
    usingNativeAudioQueue,
  });

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

  const removeLoadedAudio = useCallback(() => {
    if (!loadedSourceRef.current) {
      return;
    }

    player.remove();
    loadedSourceRef.current = false;
  }, [player]);

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
  const { nativeSpeaking, setNativeSpeaking, playNextNative, speakText } =
    useNativeSpeechPlayback({
      nativeQueueRef,
      queueRef,
      currentAudioRef,
      nativeSpeakingRef,
      playingRef,
      startingRef,
      cancelledRef,
      ensurePlaybackSession,
      finalizeDrainedState,
      playNextAudio,
      startNativeMetering,
      stopNativeMetering,
      updatePendingPlaybackState,
    });
  useNativeAudioQueueSubscription({
    usingNativeAudioQueue,
    supportsNativeOutputWaveform,
    playNextNative,
    finalizeDrainedState,
    updatePendingPlaybackState,
    startNativeOutputWaveform,
    stopNativeOutputWaveform,
    setNativeAudioQueuePlaying,
    currentAudioRef,
    cancelledRef,
    playingRef,
    hasSeenAudioPlayingRef,
    nativeOutputWaveformItemIdRef,
    nativeOutputWaveformStartedAtRef,
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    nativeQueueRef,
  });

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

  const waitForPlaybackRouteSettle = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return;
    }

    await waitForPlaybackRouteSettleInternal();
  }, [waitForPlaybackRouteSettleInternal]);

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
