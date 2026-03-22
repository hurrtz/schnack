import { useCallback, useRef, useState } from "react";

import { createSpeechRequestId } from "../../services/speech/diagnostics";
import { synthesizeSpeechSequence } from "../../services/tts";
import type {
  AudioPlayer,
  ReplayPhase,
  UseVoicePipelineParams,
} from "./types";

type ReplayControllerParams = Pick<
  UseVoicePipelineParams,
  | "isRecording"
  | "language"
  | "localTtsVoices"
  | "selectedTtsModel"
  | "selectedTtsVoice"
  | "showToast"
  | "t"
  | "ttsApiKey"
  | "ttsListenLanguages"
  | "ttsMode"
  | "ttsProvider"
> & {
  isBusy: boolean;
  lastCompletedReplyRef: React.MutableRefObject<string>;
  player: AudioPlayer;
};

export function useReplyReplayController({
  isBusy,
  isRecording,
  language,
  lastCompletedReplyRef,
  localTtsVoices,
  player,
  selectedTtsModel,
  selectedTtsVoice,
  showToast,
  t,
  ttsApiKey,
  ttsListenLanguages,
  ttsMode,
  ttsProvider,
}: ReplayControllerParams) {
  const replayingRef = useRef(false);
  const replaySessionRef = useRef(0);
  const [replayPhase, setReplayPhase] = useState<ReplayPhase>("idle");
  const [activeReplayMessageId, setActiveReplayMessageId] = useState<string | null>(
    null,
  );

  const playReplyText = useCallback(
    async (text: string, messageId?: string) => {
      const trimmed = text.trim();

      if (!trimmed || replayingRef.current) {
        return;
      }

      replayingRef.current = true;
      const replaySession = replaySessionRef.current + 1;
      replaySessionRef.current = replaySession;
      setActiveReplayMessageId(messageId ?? null);
      setReplayPhase("preparing");

      try {
        if (player.isPlaying) {
          await player.stopPlayback();
        }

        player.resetCancellation();
        const speechDiagnostics = {
          requestId: createSpeechRequestId("repeat"),
          source: "repeat" as const,
        };

        if (ttsMode === "native") {
          if (replaySessionRef.current !== replaySession) {
            return;
          }

          setReplayPhase("speaking");
          player.speakText(trimmed, {
            diagnostics: speechDiagnostics,
          });
          await player.waitForDrain();
          return;
        }

        if (ttsMode === "provider" && (!ttsProvider || !ttsApiKey)) {
          showToast(t("chooseTtsBeforeSpokenReplies"));
          return;
        }

        const audioUris = await synthesizeSpeechSequence({
          text: trimmed,
          voice: selectedTtsVoice,
          mode: ttsMode,
          provider: ttsProvider,
          providerModel: selectedTtsModel,
          apiKey: ttsApiKey,
          language,
          listenLanguages: ttsListenLanguages,
          localVoices: localTtsVoices,
          diagnostics: speechDiagnostics,
        }).catch(async () => {
          if (replaySessionRef.current !== replaySession) {
            return null;
          }

          setReplayPhase("speaking");
          player.speakText(trimmed, {
            diagnostics: speechDiagnostics,
          });
          showToast(
            ttsMode === "local"
              ? t("localVoiceFallback")
              : t("providerVoiceFallback"),
          );
          return null;
        });

        if (!audioUris) {
          if (player.isPlaying && replaySessionRef.current === replaySession) {
            setReplayPhase("speaking");
            await player.waitForDrain();
          }
          return;
        }

        if (replaySessionRef.current !== replaySession) {
          return;
        }

        setReplayPhase("speaking");
        audioUris.forEach((audioUri) => {
          player.enqueueAudio(audioUri, speechDiagnostics);
        });
        await player.waitForDrain();
      } finally {
        if (replaySessionRef.current === replaySession) {
          replayingRef.current = false;
          setReplayPhase("idle");
          setActiveReplayMessageId(null);
        }
      }
    },
    [
      language,
      localTtsVoices,
      player,
      selectedTtsModel,
      selectedTtsVoice,
      showToast,
      t,
      ttsApiKey,
      ttsListenLanguages,
      ttsMode,
      ttsProvider,
    ],
  );

  const stopReplay = useCallback(async () => {
    replaySessionRef.current += 1;
    replayingRef.current = false;
    setReplayPhase("idle");
    setActiveReplayMessageId(null);
    player.resetCancellation();

    if (player.isPlaying) {
      await player.stopPlayback();
    }
  }, [player]);

  const handleRepeatLastReply = useCallback(
    async (textOverride?: string, messageId?: string) => {
      const replyText = textOverride?.trim() || lastCompletedReplyRef.current.trim();

      if (!replyText) {
        showToast(t("noReplyToRepeatYet"));
        return;
      }

      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforeReplay"));
        return;
      }

      try {
        await playReplyText(replyText, messageId);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : t("couldntReplayReply"),
        );
      }
    },
    [isBusy, isRecording, lastCompletedReplyRef, playReplyText, showToast, t],
  );

  return {
    replayPhase,
    activeReplayMessageId,
    playReplyText,
    stopReplay,
    handleRepeatLastReply,
  };
}
