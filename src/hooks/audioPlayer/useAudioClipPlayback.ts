import { type MutableRefObject, useCallback } from "react";
import { type AudioPlayer } from "expo-audio";
import {
  recordSpeechDiagnostic,
  type SpeechDiagnosticsContext,
} from "../../services/speech/diagnostics";
import { logWaveformDebug } from "../../utils/waveformDebug";
import { nextPlaybackJobId } from "./shared";
import { type AudioQueueItem, type NativeAudioQueueContext } from "./types";

export function useAudioClipPlayback(params: {
  player: AudioPlayer;
  cancelledRef: MutableRefObject<boolean>;
  currentAudioRef: MutableRefObject<AudioQueueItem | null>;
  ensurePlaybackSession: () => Promise<void>;
  finalizeDrainedStateRef: MutableRefObject<() => void>;
  getWaveformAnalysis: (uri: string) => Promise<any>;
  hasSeenAudioPlayingRef: MutableRefObject<boolean>;
  loadedSourceRef: MutableRefObject<boolean>;
  nativeAudioQueueContextsRef: MutableRefObject<Map<string, NativeAudioQueueContext>>;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  playNativeAudio: (itemId: string, uri: string, diagnostics?: SpeechDiagnosticsContext) => Promise<void>;
  playingRef: MutableRefObject<boolean>;
  queueRef: MutableRefObject<AudioQueueItem[]>;
  startingRef: MutableRefObject<boolean>;
  supportsNativeOutputWaveform: boolean;
  updatePendingPlaybackState: () => void;
  usingNativeAudioQueue: boolean;
}) {
  const {
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
  } = params;

  const removeLoadedAudio = useCallback(() => {
    if (!loadedSourceRef.current) {
      return;
    }

    player.remove();
    loadedSourceRef.current = false;
  }, [player]);

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
      finalizeDrainedStateRef.current();
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
      finalizeDrainedStateRef.current();
    } finally {
      startingRef.current = false;
      updatePendingPlaybackState();
    }
  }, [
    cancelledRef,
    currentAudioRef,
    ensurePlaybackSession,
    finalizeDrainedStateRef,
    nativeSpeakingRef,
    player,
    playingRef,
    startingRef,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
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
        void playNativeAudio(itemId, audioUri, diagnostics);
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
      cancelledRef,
      getWaveformAnalysis,
      nativeAudioQueueContextsRef,
      nativeAudioQueuePendingCountRef,
      nativeSpeakingRef,
      playNativeAudio,
      playNextAudio,
      playingRef,
      startingRef,
      supportsNativeOutputWaveform,
      updatePendingPlaybackState,
      usingNativeAudioQueue,
    ],
  );

  return {
    enqueueAudio,
    playNextAudio,
    removeLoadedAudio,
  };
}
