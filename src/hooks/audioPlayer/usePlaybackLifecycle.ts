import { type MutableRefObject, useEffect } from "react";
import { stopNativeAudioQueue } from "../../services/nativeAudioQueue";
import { recordSpeechDiagnostic, type SpeechDiagnosticsContext } from "../../services/speech/diagnostics";
import { type AudioQueueItem, type NativeSpeechQueueItem } from "./types";

export function usePlaybackLifecycle(params: {
  cancelledRef: MutableRefObject<boolean>;
  currentAudioRef: MutableRefObject<AudioQueueItem | null>;
  finalizeDrainedState: () => void;
  hasSeenAudioPlayingRef: MutableRefObject<boolean>;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeAudioQueuePlayingRef: MutableRefObject<boolean>;
  nativeQueueRef: MutableRefObject<NativeSpeechQueueItem[]>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  playNextAudio: () => Promise<void>;
  playNextNative: () => Promise<void>;
  playingRef: MutableRefObject<boolean>;
  queueRef: MutableRefObject<AudioQueueItem[]>;
  resolveDrainWaiters: () => void;
  setNativeAudioQueuePlaying: (value: boolean) => void;
  statusPlaying: boolean;
  stopNativeMetering: () => void;
  stopNativeOutputWaveform: () => void;
  updatePendingPlaybackState: () => void;
  usingNativeAudioQueue: boolean;
}) {
  const {
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
    statusPlaying,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  } = params;

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
        !nativeSpeakingRef.current &&
        nativeAudioQueuePendingCountRef.current === 0 &&
        !nativeAudioQueuePlayingRef.current &&
        nativeQueueRef.current.length === 0
      ) {
        finalizeDrainedState();
      }
      return;
    }

    if (statusPlaying) {
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

      if (!nativeSpeakingRef.current) {
        finalizeDrainedState();
      }
      return;
    }

    if (!nativeSpeakingRef.current && !cancelledRef.current) {
      if (queueRef.current.length > 0 && !playingRef.current) {
        void playNextAudio();
        return;
      }

      if (nativeQueueRef.current.length > 0 && !playingRef.current) {
        void playNextNative();
        return;
      }
    }

    if (
      !playingRef.current &&
      !nativeSpeakingRef.current &&
      queueRef.current.length === 0 &&
      nativeQueueRef.current.length === 0
    ) {
      finalizeDrainedState();
    }
  }, [
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
    statusPlaying,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  ]);

  useEffect(() => {
    return () => {
      stopNativeMetering();
      stopNativeOutputWaveform();
      setNativeAudioQueuePlaying(false);
      if (usingNativeAudioQueue) {
        void stopNativeAudioQueue();
      }
      resolveDrainWaiters();
    };
  }, [
    resolveDrainWaiters,
    setNativeAudioQueuePlaying,
    stopNativeMetering,
    stopNativeOutputWaveform,
    usingNativeAudioQueue,
  ]);
}
