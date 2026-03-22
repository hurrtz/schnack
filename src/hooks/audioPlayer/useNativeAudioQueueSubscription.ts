import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
} from "react";

import {
  subscribeToNativeAudioQueue,
  type NativeAudioQueueEvent,
} from "../../services/nativeAudioQueue";
import {
  NativeWaveformAnalysis,
} from "../../services/nativeWaveform";
import {
  SpeechDiagnosticsContext,
  recordSpeechDiagnostic,
} from "../../services/speech/diagnostics";
import { logWaveformDebug } from "../../utils/waveformDebug";

export function useNativeAudioQueueSubscription(params: {
  usingNativeAudioQueue: boolean;
  supportsNativeOutputWaveform: boolean;
  playNextNative: () => Promise<void>;
  finalizeDrainedState: () => void;
  updatePendingPlaybackState: () => void;
  startNativeOutputWaveform: (
    itemId: string,
    analysis: NativeWaveformAnalysis,
  ) => void;
  stopNativeOutputWaveform: () => void;
  setNativeAudioQueuePlaying: Dispatch<SetStateAction<boolean>>;
  currentAudioRef: MutableRefObject<{
    id: string;
    uri: string;
    diagnostics?: SpeechDiagnosticsContext;
  } | null>;
  cancelledRef: MutableRefObject<boolean>;
  playingRef: MutableRefObject<boolean>;
  hasSeenAudioPlayingRef: MutableRefObject<boolean>;
  nativeOutputWaveformItemIdRef: MutableRefObject<string | null>;
  nativeOutputWaveformStartedAtRef: MutableRefObject<number | null>;
  nativeAudioQueueContextsRef: MutableRefObject<
    Map<
      string,
      {
        uri: string;
        diagnostics?: SpeechDiagnosticsContext;
        waveformAnalysis?: Promise<NativeWaveformAnalysis | null>;
      }
    >
  >;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeAudioQueuePlayingRef: MutableRefObject<boolean>;
  nativeQueueRef: MutableRefObject<
    Array<{
      id: string;
      text: string;
      voice?: string;
      diagnostics?: SpeechDiagnosticsContext;
    }>
  >;
}) {
  const {
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
  } = params;

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
            requestId:
              context?.diagnostics?.requestId ?? event.requestId ?? undefined,
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
        case "finished":
        case "failed": {
          logWaveformDebug("native-audio-queue-event", {
            type: event.type,
            itemId,
            uri: context?.uri ?? event.uri ?? null,
            message: event.type === "failed" ? event.message ?? null : null,
            usingNativeAudioQueue,
            supportsNativeOutputWaveform,
          });
          if (itemId && nativeOutputWaveformItemIdRef.current === itemId) {
            stopNativeOutputWaveform();
          }
          if (context) {
            recordSpeechDiagnostic({
              requestId:
                context.diagnostics?.requestId ?? event.requestId ?? undefined,
              source:
                context.diagnostics?.source ??
                (event.source as SpeechDiagnosticsContext["source"] | null) ??
                "unknown",
              stage:
                event.type === "finished"
                  ? "playback-finished"
                  : "playback-stopped",
              message:
                event.type === "finished"
                  ? context.uri
                  : event.message ?? context.uri,
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
          if (itemId && nativeOutputWaveformItemIdRef.current === itemId) {
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
    cancelledRef,
    currentAudioRef,
    finalizeDrainedState,
    hasSeenAudioPlayingRef,
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    nativeOutputWaveformItemIdRef,
    nativeOutputWaveformStartedAtRef,
    nativeQueueRef,
    playNextNative,
    playingRef,
    setNativeAudioQueuePlaying,
    startNativeOutputWaveform,
    stopNativeOutputWaveform,
    supportsNativeOutputWaveform,
    updatePendingPlaybackState,
    usingNativeAudioQueue,
  ]);
}
