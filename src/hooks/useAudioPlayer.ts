import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import {
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import {
  isNativeAudioQueueAvailable,
  prepareNativeAudioQueue,
} from "../services/nativeAudioQueue";
import { supportsNativeOutputWaveformPlayback } from "../services/nativeWaveform";
import { logWaveformDebug } from "../utils/waveformDebug";
import { PLAYER_STATUS_INTERVAL_MS } from "./audioPlayer/shared";
import { useAudioClipPlayback } from "./audioPlayer/useAudioClipPlayback";
import { useNativeAudioQueuePlayback } from "./audioPlayer/useNativeAudioQueuePlayback";
import { useNativeAudioQueueSubscription } from "./audioPlayer/useNativeAudioQueueSubscription";
import { useNativeOutputWaveformController } from "./audioPlayer/useNativeOutputWaveformController";
import { useNativeSpeechPlayback } from "./audioPlayer/useNativeSpeechPlayback";
import { usePendingPlaybackState } from "./audioPlayer/usePendingPlaybackState";
import { usePlaybackLifecycle } from "./audioPlayer/usePlaybackLifecycle";
import { usePlaybackSession } from "./audioPlayer/usePlaybackSession";
import { usePlaybackVisualState } from "./audioPlayer/usePlaybackVisualState";
import { useStopPlaybackController } from "./audioPlayer/useStopPlaybackController";
import {
  type AudioQueueItem,
  type NativeAudioQueueContext,
  type NativeSpeechQueueItem,
} from "./audioPlayer/types";

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
  const queueRef = useRef<AudioQueueItem[]>([]);
  const currentAudioRef = useRef<AudioQueueItem | null>(null);
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const loadedSourceRef = useRef(false);
  const hasSeenAudioPlayingRef = useRef(false);
  const nativeAudioQueueContextsRef = useRef<Map<string, NativeAudioQueueContext>>(
    new Map(),
  );
  const nativeAudioQueuePendingCountRef = useRef(0);
  const nativeAudioQueuePlayingRef = useRef(false);
  const nativeQueueRef = useRef<NativeSpeechQueueItem[]>([]);
  const nativeSpeakingRef = useRef(false);
  const [nativeAudioQueuePlaying, setNativeAudioQueuePlaying] =
    useState(false);
  const [nativeSpeaking, setNativeSpeaking] = useState(false);
  const { ensurePlaybackSession, resetPlaybackSession } =
    usePlaybackSession();
  const {
    meteringData,
    resetVisualState,
    setMeteringData,
    setWaveformData,
    setWaveformVariant,
    waveformData,
    waveformVariant,
  } = usePlaybackVisualState({
    player,
    status,
    nativeSpeaking,
    nativeSpeakingRef,
    nativeAudioQueuePlaying,
    usingNativeAudioQueue,
  });
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
  const finalizeDrainedStateRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    logWaveformDebug("audio-player-init", {
      platform: Platform.OS,
      usingNativeAudioQueue,
      supportsNativeOutputWaveform,
      expoAudioSamplingSupported: player.isAudioSamplingSupported,
    });
  }, [
    player.isAudioSamplingSupported,
    supportsNativeOutputWaveform,
    usingNativeAudioQueue,
  ]);

  const ensureAudioQueuePlaybackSession = useCallback(async () => {
    if (!usingNativeAudioQueue) {
      await ensurePlaybackSession();
      return;
    }

    await ensurePlaybackSession();
    await prepareNativeAudioQueue();
  }, [ensurePlaybackSession, usingNativeAudioQueue]);

  const { playNativeAudio } = useNativeAudioQueuePlayback({
    cancelledRef,
    ensureAudioQueuePlaybackSession,
    finalizeDrainedStateRef,
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeQueueRef,
    nativeSpeakingRef,
    updatePendingPlaybackState,
  });

  const { enqueueAudio, playNextAudio, removeLoadedAudio } =
    useAudioClipPlayback({
      player,
      cancelledRef,
      currentAudioRef,
      ensurePlaybackSession,
      finalizeDrainedStateRef,
      getWaveformAnalysis,
      hasSeenAudioPlayingRef,
      loadedSourceRef,
      nativeAudioQueueContextsRef,
      nativeAudioQueuePendingCountRef,
      nativeSpeakingRef,
      playNativeAudio,
      playingRef,
      queueRef,
      startingRef,
      supportsNativeOutputWaveform,
      updatePendingPlaybackState,
      usingNativeAudioQueue,
    });

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

  finalizeDrainedStateRef.current = finalizeDrainedState;

  const { playNextNative, speakText } = useNativeSpeechPlayback({
    nativeSpeaking,
    setNativeSpeaking,
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

  usePlaybackLifecycle({
    cancelledRef,
    currentAudioRef,
    finalizeDrainedState,
    hasSeenAudioPlayingRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    nativeQueueRef,
    nativeSpeakingRef,
    playNextAudio,
    playNextNative,
    playingRef,
    queueRef,
    resolveDrainWaiters,
    setNativeAudioQueuePlaying,
    statusPlaying: status.playing,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  });

  const { stopPlayback, resetCancellation } = useStopPlaybackController({
    cancelledRef,
    clearNativeAudioQueueState,
    currentAudioRef,
    hasPendingPlaybackNow,
    hasSeenAudioPlayingRef,
    markPlaybackEnded,
    nativeQueueRef,
    nativeSpeakingRef,
    player,
    playingRef,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    setNativeSpeaking,
    startingRef,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
    queueRef,
  });

  const waitForPlaybackRouteSettle = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return;
    }

    await waitForPlaybackRouteSettleInternal();
  }, [waitForPlaybackRouteSettleInternal]);

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
