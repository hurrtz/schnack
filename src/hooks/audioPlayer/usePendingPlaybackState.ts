import { MutableRefObject, useCallback, useRef, useState } from "react";

import { type SpeechDiagnosticsContext, recordSpeechDiagnostic } from "../../services/speech/diagnostics";

import { PLAYBACK_ROUTE_SETTLE_MS } from "./shared";
import { type AudioQueueItem, type NativeSpeechQueueItem } from "./types";

interface UsePendingPlaybackStateParams {
  currentAudioRef: MutableRefObject<AudioQueueItem | null>;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeAudioQueuePlayingRef: MutableRefObject<boolean>;
  nativeQueueRef: MutableRefObject<NativeSpeechQueueItem[]>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  playingRef: MutableRefObject<boolean>;
  queueRef: MutableRefObject<AudioQueueItem[]>;
  startingRef: MutableRefObject<boolean>;
  usingNativeAudioQueue: boolean;
}

export function usePendingPlaybackState({
  currentAudioRef,
  nativeAudioQueuePendingCountRef,
  nativeAudioQueuePlayingRef,
  nativeQueueRef,
  nativeSpeakingRef,
  playingRef,
  queueRef,
  startingRef,
  usingNativeAudioQueue,
}: UsePendingPlaybackStateParams) {
  const [hasPendingPlayback, setHasPendingPlayback] = useState(false);
  const drainResolversRef = useRef<Array<() => void>>([]);
  const lastPlaybackEndedAtRef = useRef(0);

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
  }, [
    currentAudioRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    nativeQueueRef,
    nativeSpeakingRef,
    playingRef,
    queueRef,
    startingRef,
    usingNativeAudioQueue,
  ]);

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

  const markPlaybackEnded = useCallback(() => {
    lastPlaybackEndedAtRef.current = Date.now();
  }, []);

  const waitForDrain = useCallback(() => {
    if (!hasPendingPlaybackNow()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      drainResolversRef.current.push(resolve);
    });
  }, [hasPendingPlaybackNow]);

  const waitForPlaybackRouteSettle = useCallback(async () => {
    const elapsed = Date.now() - lastPlaybackEndedAtRef.current;
    const remaining = PLAYBACK_ROUTE_SETTLE_MS - elapsed;

    if (remaining <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }, []);

  return {
    hasPendingPlayback,
    hasPendingPlaybackNow,
    markPlaybackEnded,
    resolveDrainWaiters,
    updatePendingPlaybackState,
    waitForDrain,
    waitForPlaybackRouteSettle,
  };
}
