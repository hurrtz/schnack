import { type MutableRefObject, useCallback, type Dispatch, type SetStateAction } from "react";
import * as Speech from "expo-speech";
import { stopNativeAudioQueue } from "../../services/nativeAudioQueue";
import { recordSpeechDiagnostic } from "../../services/speech/diagnostics";
import { type AudioQueueItem, type NativeSpeechQueueItem } from "./types";

export function useStopPlaybackController(params: {
  clearNativeAudioQueueState: () => void;
  currentAudioRef: MutableRefObject<AudioQueueItem | null>;
  hasPendingPlaybackNow: () => boolean;
  hasSeenAudioPlayingRef: MutableRefObject<boolean>;
  markPlaybackEnded: () => void;
  nativeQueueRef: MutableRefObject<NativeSpeechQueueItem[]>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  player: { pause: () => void };
  playingRef: MutableRefObject<boolean>;
  removeLoadedAudio: () => void;
  resetPlaybackSession: () => void;
  resetVisualState: () => void;
  setNativeSpeaking: Dispatch<SetStateAction<boolean>>;
  startingRef: MutableRefObject<boolean>;
  stopNativeMetering: () => void;
  stopNativeOutputWaveform: () => void;
  updatePendingPlaybackState: () => void;
  usingNativeAudioQueue: boolean;
  queueRef: MutableRefObject<AudioQueueItem[]>;
  cancelledRef: MutableRefObject<boolean>;
}) {
  const {
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
    queueRef,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    setNativeSpeaking,
    startingRef,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  } = params;

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
    queueRef,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    setNativeSpeaking,
    startingRef,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
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
    queueRef,
    removeLoadedAudio,
    resetPlaybackSession,
    resetVisualState,
    setNativeSpeaking,
    startingRef,
    stopNativeMetering,
    stopNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  ]);

  return {
    resetCancellation,
    stopPlayback,
  };
}
