import { transcribeAudio } from "./whisper";
import { streamChat, summarizeConversationContext } from "./llm";
import {
  LOCAL_TTS_MAX_INPUT_CHARS,
  PROVIDER_TTS_MAX_INPUT_CHARS,
  splitIntoSentences,
  splitTextForTts,
  synthesizeSpeech,
} from "./tts";
import {
  type SpeechDiagnosticsContext,
  createSpeechRequestId,
} from "./speech/diagnostics";
import { buildConversationContextPlan } from "./conversationContext";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  LocalTtsVoiceSelections,
  Message,
  Provider,
  ReplyPlayback,
  SttBackendMode,
  TtsBackendMode,
  TtsListenLanguage,
  UsageEstimate,
} from "../types";

function extractCompleteSentences(text: string): {
  completeSentences: string[];
  remainder: string;
} {
  if (!text) {
    return {
      completeSentences: [],
      remainder: "",
    };
  }

  const segments = splitIntoSentences(text);
  const endsWithSentenceBoundary = /[.!?\n]\s*$/.test(text);
  const completeCount = endsWithSentenceBoundary
    ? segments.length
    : Math.max(segments.length - 1, 0);

  return {
    completeSentences: segments
      .slice(0, completeCount)
      .filter((segment) => segment.trim()),
    remainder: segments.slice(completeCount).join(""),
  };
}

interface PipelineCallbacks {
  onTranscription: (text: string) => void;
  onContextSummary?: (
    summary: string,
    summarizedMessageCount: number,
    usage?: UsageEstimate,
  ) => void;
  onChunk: (text: string) => void;
  onResponseDone: (fullText: string, usage?: UsageEstimate) => void;
  onAudioReady: (
    audioUri: string,
    diagnostics?: SpeechDiagnosticsContext,
  ) => void;
  onSpeechTextReady: (
    text: string,
    voice?: string,
    diagnostics?: SpeechDiagnosticsContext,
  ) => void;
  onTtsFallback?: (error: Error) => void;
  onError: (error: Error) => void;
}

export async function runVoicePipeline(params: {
  audioUri?: string;
  transcriptionOverride?: string;
  messages: Message[];
  model: string;
  provider: Provider;
  providerApiKey: string;
  sttMode: SttBackendMode;
  sttProvider?: Provider | null;
  sttApiKey?: string;
  ttsMode: TtsBackendMode;
  ttsProvider?: Provider | null;
  ttsApiKey?: string;
  ttsVoice: string;
  ttsListenLanguages?: TtsListenLanguage[];
  localTtsVoices?: LocalTtsVoiceSelections;
  replyPlayback: ReplyPlayback;
  contextSummary?: string;
  summarizedMessageCount?: number;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  language: AppLanguage;
  callbacks: PipelineCallbacks;
  abortSignal?: AbortSignal;
}): Promise<string | null> {
  const {
    audioUri,
    transcriptionOverride,
    messages,
    model,
    provider,
    providerApiKey,
    sttMode,
    sttProvider,
    sttApiKey,
    ttsMode,
    ttsProvider,
    ttsApiKey,
    ttsVoice,
    ttsListenLanguages,
    localTtsVoices,
    replyPlayback,
    contextSummary,
    summarizedMessageCount,
    assistantInstructions,
    responseLength,
    responseTone,
    language,
    callbacks,
    abortSignal,
  } = params;

  const transcription =
    transcriptionOverride?.trim() ||
    (audioUri
      ? await transcribeAudio({
          fileUri: audioUri,
          mode: sttMode,
          provider: sttProvider,
          apiKey: sttApiKey,
          language,
        })
      : null);

  if (!transcription) return null;
  callbacks.onTranscription(transcription);
  if (abortSignal?.aborted) return transcription;

  const contextPlan = buildConversationContextPlan({
    messages,
    contextSummary,
    summarizedMessageCount,
  });
  let effectiveSummary = contextSummary?.trim() ?? "";
  let contextualMessages = contextPlan.recentMessages;

  if (contextPlan.needsSummaryUpdate) {
    try {
      const { summary: updatedSummary, usage } =
        await summarizeConversationContext({
          existingSummary: effectiveSummary,
          messages: contextPlan.messagesToSummarize,
          model,
          provider,
          apiKey: providerApiKey,
          language,
          abortSignal,
        });

      if (abortSignal?.aborted) {
        return transcription;
      }

      if (updatedSummary) {
        effectiveSummary = updatedSummary;
        callbacks.onContextSummary?.(
          updatedSummary,
          contextPlan.targetSummarizedCount,
          usage,
        );
      } else if (!effectiveSummary) {
        contextualMessages = contextPlan.fallbackRecentMessages;
      }
    } catch {
      if (abortSignal?.aborted) {
        return transcription;
      }

      contextualMessages = contextPlan.fallbackRecentMessages;
    }
  }

  const allMessages: Message[] = [
    ...contextualMessages,
    {
      id: "pending",
      role: "user",
      content: transcription,
      model: null,
      provider: null,
      timestamp: new Date().toISOString(),
    },
  ];

  let sentenceBuffer = "";
  let ttsChain = Promise.resolve();
  const ttsQueue: Promise<void>[] = [];
  const effectiveReplyPlayback = ttsMode === "local" ? "wait" : replyPlayback;
  const speechRequestId = createSpeechRequestId("conversation");
  const speechDiagnostics = {
    requestId: speechRequestId,
    source: "conversation" as const,
  };

  const enqueueTtsChunk = (text: string) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    const task = ttsChain.then(async () => {
      if (abortSignal?.aborted) {
        return;
      }

      if (ttsMode === "native") {
        callbacks.onSpeechTextReady(trimmed, undefined, speechDiagnostics);
        return;
      }

      try {
        const audio = await synthesizeSpeech({
          text: trimmed,
          voice: ttsVoice,
          mode: ttsMode,
          provider: ttsProvider,
          apiKey: ttsApiKey,
          language,
          listenLanguages: ttsListenLanguages,
          localVoices: localTtsVoices,
          diagnostics: speechDiagnostics,
        });

        if (!abortSignal?.aborted) {
          callbacks.onAudioReady(audio, speechDiagnostics);
        }
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));

        callbacks.onTtsFallback?.(normalizedError);

        if (!abortSignal?.aborted) {
          callbacks.onSpeechTextReady(trimmed, undefined, speechDiagnostics);
        }
      }
    });

    ttsChain = task.catch((error) => {
      callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
    ttsQueue.push(task.catch(() => undefined));
  };

  const enqueueTts = (text: string) => {
    if (ttsMode === "native") {
      enqueueTtsChunk(text);
      return;
    }

    const segments = splitTextForTts(
      text,
      ttsMode === "local"
        ? LOCAL_TTS_MAX_INPUT_CHARS
        : PROVIDER_TTS_MAX_INPUT_CHARS,
    );

    if (segments.length === 0) {
      return;
    }

    segments.forEach(enqueueTtsChunk);
  };

  const enqueueStreamPlayback = (sentence: string) => {
    enqueueTts(sentence);
  };

  await streamChat({
    messages: allMessages,
    model,
    provider,
    apiKey: providerApiKey,
    assistantInstructions,
    responseLength,
    responseTone,
    language,
    conversationSummary: effectiveSummary || undefined,
    abortSignal,
    onChunk: (text) => {
      if (abortSignal?.aborted) return;
      callbacks.onChunk(text);
      if (effectiveReplyPlayback === "stream") {
        sentenceBuffer += text;
        const { completeSentences, remainder } =
          extractCompleteSentences(sentenceBuffer);
        for (const sentence of completeSentences) {
          enqueueStreamPlayback(sentence);
        }
        sentenceBuffer = remainder;
      }
    },
    onDone: async (fullText, usage) => {
      if (abortSignal?.aborted) return;
      callbacks.onResponseDone(fullText, usage);
      if (effectiveReplyPlayback === "stream") {
        if (sentenceBuffer.trim()) {
          enqueueStreamPlayback(sentenceBuffer);
        }
      } else {
        enqueueTts(fullText);
      }
    },
    onError: callbacks.onError,
  });

  await Promise.all(ttsQueue);
  return transcription;
}
