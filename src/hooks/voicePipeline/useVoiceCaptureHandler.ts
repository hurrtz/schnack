import { useCallback, useRef } from "react";

import { runVoicePipeline } from "../../services/voicePipeline";
import type { UsageEstimate } from "../../types";
import type { PipelinePhase, UseVoicePipelineParams } from "./types";

type VoiceCaptureHandlerParams = Omit<UseVoicePipelineParams, "isRecording"> & {
  abortRef: React.MutableRefObject<AbortController | null>;
  handleRepeatLastReply: (
    textOverride?: string,
    messageId?: string,
  ) => Promise<void>;
  lastCompletedReplyRef: React.MutableRefObject<string>;
  setPipelinePhase: (phase: PipelinePhase) => void;
  setStreamingText: (text: string | ((prev: string) => string)) => void;
};

export function useVoiceCaptureHandler({
  abortRef,
  activeConversation,
  addMessage,
  assistantInstructions,
  createConversation,
  handleRepeatLastReply,
  language,
  lastCompletedReplyRef,
  localTtsVoices,
  model,
  player,
  provider,
  providerApiKey,
  replyPlayback,
  responseLength,
  responseTone,
  selectedSttModel,
  selectedTtsModel,
  selectedTtsVoice,
  setPipelinePhase,
  setStreamingText,
  showToast,
  sttApiKey,
  sttMode,
  sttProvider,
  t,
  ttsApiKey,
  ttsListenLanguages,
  ttsMode,
  ttsProvider,
  updateConversationContextSummary,
}: VoiceCaptureHandlerParams) {
  const ttsFallbackToastShownRef = useRef(false);

  const handleVoiceCaptureDone = useCallback(
    async ({
      audioUri,
      transcriptionOverride,
    }: {
      audioUri?: string;
      transcriptionOverride?: string;
    }) => {
      setPipelinePhase(transcriptionOverride ? "thinking" : "transcribing");
      setStreamingText("");
      ttsFallbackToastShownRef.current = false;
      abortRef.current = new AbortController();
      player.resetCancellation();

      try {
        const transcription = await runVoicePipeline({
          audioUri,
          transcriptionOverride,
          messages: activeConversation?.messages || [],
          contextSummary: activeConversation?.contextSummary,
          summarizedMessageCount: activeConversation?.summarizedMessageCount,
          model,
          provider,
          providerApiKey,
          sttMode,
          sttProvider,
          sttApiKey,
          sttModel: selectedSttModel,
          ttsMode,
          ttsProvider,
          ttsApiKey,
          ttsModel: selectedTtsModel,
          ttsVoice: selectedTtsVoice,
          ttsListenLanguages,
          localTtsVoices,
          replyPlayback,
          assistantInstructions,
          responseLength,
          responseTone,
          language,
          abortSignal: abortRef.current!.signal,
          callbacks: {
            onTranscription: (text) => {
              setPipelinePhase("thinking");
              if (!activeConversation) {
                createConversation(text, model, provider);
              }
              setTimeout(() => {
                addMessage({
                  role: "user",
                  content: text,
                  model: null,
                  provider: null,
                });
              }, 0);
            },
            onContextSummary: (summary, summarizedCount, usage) => {
              updateConversationContextSummary(
                summary,
                summarizedCount,
                usage,
                model,
                provider,
              );
            },
            onChunk: (text) => {
              setPipelinePhase("thinking");
              setStreamingText((prev) => prev + text);
            },
            onResponseDone: (fullText, usage?: UsageEstimate) => {
              setStreamingText("");
              setPipelinePhase(ttsMode === "native" ? "speaking" : "synthesizing");
              lastCompletedReplyRef.current = fullText;
              addMessage({
                role: "assistant",
                content: fullText,
                model,
                provider,
                usage,
              });
            },
            onAudioReady: (audioData, diagnostics) => {
              player.enqueueAudio(audioData, diagnostics);
            },
            onSpeechTextReady: (text, _voice, diagnostics) => {
              player.speakText(text, {
                diagnostics,
              });
            },
            onTtsFallback: () => {
              if (ttsFallbackToastShownRef.current) {
                return;
              }

              ttsFallbackToastShownRef.current = true;
              showToast(
                ttsMode === "local"
                  ? t("localVoiceFallback")
                  : t("providerVoiceFallback"),
              );
            },
            onError: async (error) => {
              await player.stopPlayback();
              setPipelinePhase("idle");
              const retryAction = lastCompletedReplyRef.current.trim()
                ? () => {
                    void handleRepeatLastReply(lastCompletedReplyRef.current);
                  }
                : () => {
                    void handleVoiceCaptureDone({
                      audioUri,
                      transcriptionOverride,
                    });
                  };

              showToast(error.message, retryAction);
            },
          },
        });

        if (!transcription) {
          showToast(t("couldntCatchThatTryAgain"));
        }
      } catch (error) {
        if (abortRef.current?.signal.aborted) {
          return;
        }

        showToast(
          error instanceof Error ? error.message : t("couldntProcessVoiceInput"),
        );
      } finally {
        if (player.hasPendingPlaybackNow()) {
          setPipelinePhase("speaking");
        }

        if (player.hasPendingPlaybackNow()) {
          await player.waitForDrain();
        }
        setPipelinePhase("idle");
      }
    },
    [
      abortRef,
      activeConversation,
      addMessage,
      assistantInstructions,
      createConversation,
      handleRepeatLastReply,
      language,
      lastCompletedReplyRef,
      localTtsVoices,
      model,
      player,
      provider,
      providerApiKey,
      replyPlayback,
      responseLength,
      responseTone,
      selectedSttModel,
      selectedTtsModel,
      selectedTtsVoice,
      setPipelinePhase,
      setStreamingText,
      showToast,
      sttApiKey,
      sttMode,
      sttProvider,
      t,
      ttsApiKey,
      ttsListenLanguages,
      ttsMode,
      ttsProvider,
      updateConversationContextSummary,
    ],
  );

  return {
    handleVoiceCaptureDone,
  };
}
