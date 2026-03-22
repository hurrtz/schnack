import { MutableRefObject, useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { PipelinePhase } from "../../hooks/useVoicePipeline";
import { releaseLocalTtsResources } from "../../services/localTts";
import { Provider, Settings } from "../../types";

import { ShowToastFn, TranslateFn } from "./shared";

interface AudioPlayerController {
  isPlaying: boolean;
  stopPlayback: () => Promise<void>;
  waitForPlaybackRouteSettle: () => Promise<void>;
}

interface AudioRecorderController {
  clearLastError: () => void;
  lastError: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
}

interface NativeSpeechRecognizerController {
  abortRecognition: () => Promise<void>;
  clearLastError: () => void;
  isAvailable: boolean;
  lastError: string | null;
  startRecognition: () => Promise<void>;
  stopRecognition: () => Promise<string | null>;
}

interface UseVoiceSessionControllerParams<Snapshot> {
  abortRef: MutableRefObject<AbortController | null>;
  availableSttProviders: Provider[];
  availableTtsProviders: Provider[];
  captureActiveConversationSnapshot: () => Snapshot;
  handleVoiceCaptureDone: (params: {
    audioUri?: string;
    transcriptionOverride?: string;
  }) => Promise<void>;
  isBusy: boolean;
  isRecording: boolean;
  lastCompletedReplyRef: MutableRefObject<string>;
  nativeStt: NativeSpeechRecognizerController;
  player: AudioPlayerController;
  providerApiKey: string;
  providerLabel: string;
  recorder: AudioRecorderController;
  restoreActiveConversationSnapshot: (snapshot: Snapshot) => Promise<void>;
  setPipelinePhase: (phase: PipelinePhase) => void;
  setStreamingText: (text: string) => void;
  settings: Pick<Settings, "sttMode" | "ttsMode">;
  showToast: ShowToastFn;
  sttApiKey: string;
  sttProvider: Provider | null;
  t: TranslateFn;
  ttsApiKey: string;
  ttsProvider: Provider | null;
}

export function useVoiceSessionController<Snapshot>({
  abortRef,
  availableSttProviders,
  availableTtsProviders,
  captureActiveConversationSnapshot,
  handleVoiceCaptureDone,
  isBusy,
  isRecording,
  lastCompletedReplyRef,
  nativeStt,
  player,
  providerApiKey,
  providerLabel,
  recorder,
  restoreActiveConversationSnapshot,
  setPipelinePhase,
  setStreamingText,
  settings,
  showToast,
  sttApiKey,
  sttProvider,
  t,
  ttsApiKey,
  ttsProvider,
}: UseVoiceSessionControllerParams<Snapshot>) {
  const recordingStartedRef = useRef<Promise<void> | null>(null);
  const voiceTurnSessionRef = useRef(0);
  const voiceTurnSnapshotRef = useRef<Snapshot | null>(null);
  const cancelableVoiceTurnSessionRef = useRef<number | null>(null);

  const rollbackCancelableVoiceTurn = useCallback(async () => {
    const snapshot = voiceTurnSnapshotRef.current;

    if (!snapshot || cancelableVoiceTurnSessionRef.current === null) {
      return;
    }

    voiceTurnSnapshotRef.current = null;
    cancelableVoiceTurnSessionRef.current = null;
    await restoreActiveConversationSnapshot(snapshot);
  }, [restoreActiveConversationSnapshot]);

  const cancelCurrentInteraction = useCallback(
    async ({ rollbackConversation }: { rollbackConversation: boolean }) => {
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");

      if (player.isPlaying) {
        await player.stopPlayback();
      }

      if (rollbackConversation) {
        await rollbackCancelableVoiceTurn();
      }
    },
    [
      abortRef,
      player,
      rollbackCancelableVoiceTurn,
      setPipelinePhase,
      setStreamingText,
    ],
  );

  const processCapturedVoiceTurn = useCallback(
    async (params: { audioUri?: string; transcriptionOverride?: string }) => {
      const sessionId = voiceTurnSessionRef.current + 1;
      voiceTurnSessionRef.current = sessionId;
      voiceTurnSnapshotRef.current = captureActiveConversationSnapshot();
      cancelableVoiceTurnSessionRef.current = sessionId;

      try {
        await handleVoiceCaptureDone(params);
      } finally {
        if (cancelableVoiceTurnSessionRef.current === sessionId) {
          cancelableVoiceTurnSessionRef.current = null;
        }

        if (voiceTurnSessionRef.current === sessionId) {
          voiceTurnSnapshotRef.current = null;
        }
      }
    },
    [captureActiveConversationSnapshot, handleVoiceCaptureDone],
  );

  useEffect(() => {
    if (player.isPlaying && cancelableVoiceTurnSessionRef.current !== null) {
      cancelableVoiceTurnSessionRef.current = null;
    }
  }, [player.isPlaying]);

  useEffect(() => {
    if (!nativeStt.lastError) {
      return;
    }

    showToast(nativeStt.lastError);
    nativeStt.clearLastError();
  }, [nativeStt, showToast]);

  useEffect(() => {
    if (!recorder.lastError) {
      return;
    }

    showToast(recorder.lastError);
    recorder.clearLastError();
  }, [recorder, showToast]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "background") {
        return;
      }

      void (async () => {
        abortRef.current?.abort();
        setPipelinePhase("idle");
        setStreamingText("");

        try {
          if (settings.sttMode === "native") {
            await nativeStt.abortRecognition();
          } else {
            await recorder.stopRecording();
          }
        } catch {
          // Ignore background-stop failures.
        }

        await releaseLocalTtsResources();
      })();
    });

    return () => {
      subscription.remove();
      void releaseLocalTtsResources();
    };
  }, [abortRef, nativeStt, recorder, setPipelinePhase, setStreamingText, settings.sttMode]);

  const ensureVoiceSessionReady = useCallback(() => {
    if (!providerApiKey) {
      showToast(t("addProviderKeyToUseProvider", { provider: providerLabel }));
      return false;
    }

    if (settings.sttMode === "native" && !nativeStt.isAvailable) {
      showToast(t("speechRecognitionUnavailableOnDevice"));
      return false;
    }

    if (
      settings.sttMode === "provider" &&
      (!sttProvider ||
        !availableSttProviders.includes(sttProvider) ||
        !sttApiKey)
    ) {
      showToast(t("chooseSttBeforeVoiceSession"));
      return false;
    }

    if (
      settings.ttsMode === "provider" &&
      (!ttsProvider ||
        !availableTtsProviders.includes(ttsProvider) ||
        !ttsApiKey)
    ) {
      showToast(t("chooseTtsBeforeSpokenReplies"));
      return false;
    }

    return true;
  }, [
    availableSttProviders,
    availableTtsProviders,
    nativeStt.isAvailable,
    providerApiKey,
    providerLabel,
    settings.sttMode,
    settings.ttsMode,
    showToast,
    sttApiKey,
    sttProvider,
    t,
    ttsApiKey,
    ttsProvider,
  ]);

  const startVoiceCapture = useCallback(async () => {
    await player.waitForPlaybackRouteSettle();

    const startPromise =
      settings.sttMode === "native"
        ? nativeStt.startRecognition()
        : recorder.startRecording();

    recordingStartedRef.current = startPromise;

    try {
      await startPromise;
    } finally {
      if (recordingStartedRef.current === startPromise) {
        recordingStartedRef.current = null;
      }
    }
  }, [nativeStt, player, recorder, settings.sttMode]);

  const stopVoiceCapture = useCallback(async () => {
    const startPromise = recordingStartedRef.current;

    if (startPromise) {
      try {
        await startPromise;
      } catch {
        return;
      } finally {
        if (recordingStartedRef.current === startPromise) {
          recordingStartedRef.current = null;
        }
      }
    }

    if (settings.sttMode === "native") {
      const transcription = await nativeStt.stopRecognition();

      if (transcription) {
        void processCapturedVoiceTurn({ transcriptionOverride: transcription });
      }

      return;
    }

    const uri = await recorder.stopRecording();

    if (uri) {
      void processCapturedVoiceTurn({ audioUri: uri });
    }
  }, [nativeStt, processCapturedVoiceTurn, recorder, settings.sttMode]);

  const handlePressIn = useCallback(async () => {
    if (player.isPlaying) {
      await cancelCurrentInteraction({ rollbackConversation: false });
      return;
    }

    if (isBusy) {
      await cancelCurrentInteraction({ rollbackConversation: true });
      return;
    }

    if (!ensureVoiceSessionReady()) {
      return;
    }

    try {
      await startVoiceCapture();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("couldntStartVoiceInput");
      showToast(message);
    }
  }, [
    cancelCurrentInteraction,
    ensureVoiceSessionReady,
    isBusy,
    player.isPlaying,
    showToast,
    startVoiceCapture,
    t,
  ]);

  const handlePressOut = useCallback(async () => {
    try {
      await stopVoiceCapture();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("couldntProcessVoiceInput");
      showToast(message);
    }
  }, [showToast, stopVoiceCapture, t]);

  const handleTogglePress = useCallback(async () => {
    if (
      !isRecording &&
      !player.isPlaying &&
      !isBusy &&
      !ensureVoiceSessionReady()
    ) {
      return;
    }

    if (player.isPlaying) {
      await cancelCurrentInteraction({ rollbackConversation: false });
      return;
    }

    if (isBusy) {
      await cancelCurrentInteraction({ rollbackConversation: true });
      return;
    }

    try {
      if (isRecording) {
        await stopVoiceCapture();
        return;
      }

      await startVoiceCapture();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isRecording
            ? t("couldntProcessVoiceInput")
            : t("couldntStartVoiceInput");
      showToast(message);
    }
  }, [
    cancelCurrentInteraction,
    ensureVoiceSessionReady,
    isBusy,
    isRecording,
    player.isPlaying,
    showToast,
    startVoiceCapture,
    stopVoiceCapture,
    t,
  ]);

  const resetVoiceSessionState = useCallback(async () => {
    abortRef.current?.abort();
    setPipelinePhase("idle");
    setStreamingText("");
    lastCompletedReplyRef.current = "";
    voiceTurnSnapshotRef.current = null;
    cancelableVoiceTurnSessionRef.current = null;

    if (player.isPlaying) {
      await player.stopPlayback();
    }

    if (!isRecording) {
      return;
    }

    try {
      if (settings.sttMode === "native") {
        await nativeStt.abortRecognition();
      } else {
        await recorder.stopRecording();
      }
    } catch {
      // Ignore recorder cleanup failures while switching conversations.
    }
  }, [
    abortRef,
    isRecording,
    lastCompletedReplyRef,
    nativeStt,
    player,
    recorder,
    setPipelinePhase,
    setStreamingText,
    settings.sttMode,
  ]);

  return {
    handlePressIn,
    handlePressOut,
    handleTogglePress,
    resetVoiceSessionState,
  };
}
