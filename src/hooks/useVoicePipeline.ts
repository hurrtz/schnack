import { useState, useCallback, useRef } from "react";

import { TranslationKey } from "../i18n";
import { createSpeechRequestId } from "../services/speech/diagnostics";
import { runVoicePipeline } from "../services/voicePipeline";
import { synthesizeSpeechSequence } from "../services/tts";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  Conversation,
  LocalTtsVoiceSelections,
  Message,
  Provider,
  ReplyPlayback,
  SttBackendMode,
  TtsBackendMode,
  TtsListenLanguage,
  UsageEstimate,
} from "../types";

import type { useAudioPlayer } from "./useAudioPlayer";

export type PipelinePhase =
  | "idle"
  | "transcribing"
  | "thinking"
  | "synthesizing"
  | "speaking";

type AudioPlayer = ReturnType<typeof useAudioPlayer>;

export interface UseVoicePipelineParams {
  /** Current active conversation (may be null for fresh sessions). */
  activeConversation: Conversation | null;

  /** Add a message to the active conversation. */
  addMessage: (msg: Omit<Message, "id" | "timestamp">) => void;

  /** Create a new conversation with first-message title. */
  createConversation: (
    firstMessage: string,
    initialModel?: string | null,
    initialProvider?: Provider | null,
  ) => void;

  /** Persist a context-summary update for the active conversation. */
  updateConversationContextSummary: (
    summary: string,
    summarizedCount: number,
    usage?: UsageEstimate,
    usageModel?: string | null,
    usageProvider?: Provider | null,
  ) => void;

  /** Audio player instance from useAudioPlayer. */
  player: AudioPlayer;

  /** Selected chat provider. */
  provider: Provider;

  /** API key for the selected chat provider. */
  providerApiKey: string;

  /** Selected chat model. */
  model: string;

  /** STT mode setting. */
  sttMode: SttBackendMode;

  /** Selected STT provider (null when native mode). */
  sttProvider: Provider | null;

  /** API key for the selected STT provider. */
  sttApiKey: string;

  /** TTS mode setting. */
  ttsMode: TtsBackendMode;

  /** Selected TTS provider (null when native/local mode). */
  ttsProvider: Provider | null;

  /** API key for the selected TTS provider. */
  ttsApiKey: string;

  /** Selected TTS voice for the provider. */
  selectedTtsVoice: string;

  /** TTS listen languages setting. */
  ttsListenLanguages: TtsListenLanguage[];

  /** Local TTS voice selections. */
  localTtsVoices: LocalTtsVoiceSelections;

  /** Reply playback mode setting. */
  replyPlayback: ReplyPlayback;

  /** Custom assistant instructions. */
  assistantInstructions: string;

  /** Response length preference. */
  responseLength: AssistantResponseLength;

  /** Response tone preference. */
  responseTone: AssistantResponseTone;

  /** Current app language. */
  language: AppLanguage;

  /** Whether the recorder or native STT is currently recording. */
  isRecording: boolean;

  /** Show a toast notification. */
  showToast: (message: string, onRetry?: () => void) => void;

  /** Translation function. */
  t: (
    key: TranslationKey,
    params?: Record<string, string | number | undefined>,
  ) => string;
}

export interface UseVoicePipelineResult {
  pipelinePhase: PipelinePhase;
  setPipelinePhase: (phase: PipelinePhase) => void;
  streamingText: string;
  setStreamingText: (text: string) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
  lastCompletedReplyRef: React.MutableRefObject<string>;
  playReplyText: (text: string) => Promise<void>;
  handleRepeatLastReply: (textOverride?: string) => Promise<void>;
  handleVoiceCaptureDone: (params: {
    audioUri?: string;
    transcriptionOverride?: string;
  }) => Promise<void>;
}

export function useVoicePipeline(
  params: UseVoicePipelineParams,
): UseVoicePipelineResult {
  const {
    activeConversation,
    addMessage,
    createConversation,
    updateConversationContextSummary,
    player,
    provider,
    providerApiKey,
    model,
    sttMode,
    sttProvider,
    sttApiKey,
    ttsMode,
    ttsProvider,
    ttsApiKey,
    selectedTtsVoice,
    ttsListenLanguages,
    localTtsVoices,
    replyPlayback,
    assistantInstructions,
    responseLength,
    responseTone,
    language,
    isRecording,
    showToast,
    t,
  } = params;

  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [streamingText, setStreamingText] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const lastCompletedReplyRef = useRef("");
  const ttsFallbackToastShownRef = useRef(false);
  const replayingRef = useRef(false);

  const isBusy = pipelinePhase !== "idle";

  const playReplyText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      if (replayingRef.current) {
        return;
      }
      replayingRef.current = true;

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
          apiKey: ttsApiKey,
          language,
          listenLanguages: ttsListenLanguages,
          localVoices: localTtsVoices,
          diagnostics: speechDiagnostics,
        }).catch(async () => {
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
          return;
        }

        audioUris.forEach((audioUri) => {
          player.enqueueAudio(audioUri, speechDiagnostics);
        });
        await player.waitForDrain();
      } finally {
        replayingRef.current = false;
      }
    },
    [
      player,
      ttsMode,
      ttsListenLanguages,
      localTtsVoices,
      selectedTtsVoice,
      showToast,
      t,
      ttsApiKey,
      language,
      ttsProvider,
    ],
  );

  const handleRepeatLastReply = useCallback(
    async (textOverride?: string) => {
      const replyText =
        textOverride?.trim() || lastCompletedReplyRef.current.trim();

      if (!replyText) {
        showToast(t("noReplyToRepeatYet"));
        return;
      }

      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforeReplay"));
        return;
      }

      try {
        await playReplyText(replyText);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("couldntReplayReply");
        showToast(message);
      }
    },
    [isBusy, isRecording, playReplyText, showToast, t],
  );

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
          ttsMode,
          ttsProvider,
          ttsApiKey,
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
              setPipelinePhase(
                ttsMode === "native" ? "speaking" : "synthesizing",
              );
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
      } catch {
        // Errors are surfaced through the toast callback above.
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
      activeConversation,
      addMessage,
      createConversation,
      model,
      player,
      provider,
      providerApiKey,
      replyPlayback,
      selectedTtsVoice,
      sttMode,
      ttsMode,
      ttsListenLanguages,
      localTtsVoices,
      assistantInstructions,
      responseLength,
      responseTone,
      language,
      handleRepeatLastReply,
      showToast,
      sttApiKey,
      sttProvider,
      t,
      ttsApiKey,
      ttsProvider,
      updateConversationContextSummary,
    ],
  );

  return {
    pipelinePhase,
    setPipelinePhase,
    streamingText,
    setStreamingText,
    abortRef,
    lastCompletedReplyRef,
    playReplyText,
    handleRepeatLastReply,
    handleVoiceCaptureDone,
  };
}
