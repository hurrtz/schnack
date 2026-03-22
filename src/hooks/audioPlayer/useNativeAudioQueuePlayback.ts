import { type MutableRefObject, useCallback } from "react";
import {
  enqueueNativeAudioQueueItem,
  startNativeAudioQueue,
} from "../../services/nativeAudioQueue";
import {
  recordSpeechDiagnostic,
  type SpeechDiagnosticsContext,
} from "../../services/speech/diagnostics";
import { type NativeAudioQueueContext, type NativeSpeechQueueItem } from "./types";

export function useNativeAudioQueuePlayback(params: {
  cancelledRef: MutableRefObject<boolean>;
  ensureAudioQueuePlaybackSession: () => Promise<void>;
  finalizeDrainedStateRef: MutableRefObject<() => void>;
  nativeAudioQueueContextsRef: MutableRefObject<Map<string, NativeAudioQueueContext>>;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeQueueRef: MutableRefObject<NativeSpeechQueueItem[]>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  updatePendingPlaybackState: () => void;
}) {
  const {
    cancelledRef,
    ensureAudioQueuePlaybackSession,
    finalizeDrainedStateRef,
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeQueueRef,
    nativeSpeakingRef,
    updatePendingPlaybackState,
  } = params;

  const playNativeAudio = useCallback(
    async (
      itemId: string,
      audioUri: string,
      diagnostics?: SpeechDiagnosticsContext,
    ) => {
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
          finalizeDrainedStateRef.current();
        }
      }
    },
    [
      cancelledRef,
      ensureAudioQueuePlaybackSession,
      finalizeDrainedStateRef,
      nativeAudioQueueContextsRef,
      nativeAudioQueuePendingCountRef,
      nativeQueueRef,
      nativeSpeakingRef,
      updatePendingPlaybackState,
    ],
  );

  return {
    playNativeAudio,
  };
}
