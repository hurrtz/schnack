import { type MutableRefObject, useCallback, useState } from "react";

import * as Speech from "expo-speech";

import { SpeechDiagnosticsContext, recordSpeechDiagnostic } from "../../services/speech/diagnostics";
import { nextPlaybackJobId } from "./shared";

export function useNativeSpeechPlayback(params: {
  nativeQueueRef: MutableRefObject<
    Array<{
      id: string;
      text: string;
      voice?: string;
      diagnostics?: SpeechDiagnosticsContext;
    }>
  >;
  queueRef: MutableRefObject<
    Array<{ id: string; uri: string; diagnostics?: SpeechDiagnosticsContext }>
  >;
  currentAudioRef: MutableRefObject<{
    id: string;
    uri: string;
    diagnostics?: SpeechDiagnosticsContext;
  } | null>;
  nativeSpeakingRef: MutableRefObject<boolean>;
  playingRef: MutableRefObject<boolean>;
  startingRef: MutableRefObject<boolean>;
  cancelledRef: MutableRefObject<boolean>;
  ensurePlaybackSession: () => Promise<void>;
  finalizeDrainedState: () => void;
  playNextAudio: () => Promise<void>;
  startNativeMetering: () => void;
  stopNativeMetering: () => void;
  updatePendingPlaybackState: () => void;
}) {
  const {
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
  } = params;
  const [nativeSpeaking, setNativeSpeaking] = useState(false);

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
    cancelledRef,
    currentAudioRef,
    ensurePlaybackSession,
    finalizeDrainedState,
    nativeQueueRef,
    nativeSpeakingRef,
    playNextAudio,
    playingRef,
    queueRef,
    startNativeMetering,
    startingRef,
    stopNativeMetering,
    updatePendingPlaybackState,
  ]);

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
    [
      cancelledRef,
      nativeQueueRef,
      nativeSpeakingRef,
      playNextNative,
      playingRef,
      startingRef,
      updatePendingPlaybackState,
    ],
  );

  return {
    nativeSpeaking,
    setNativeSpeaking,
    playNextNative,
    speakText,
  };
}
