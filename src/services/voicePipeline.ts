import { transcribeAudio } from "./whisper";
import { streamChat, summarizeConversationContext } from "./llm";
import { synthesizeSpeech } from "./tts";
import { buildConversationContextPlan } from "./conversationContext";
import {
  AssistantResponseLength,
  AssistantResponseTone,
  Message,
  Provider,
  ReplyPlayback,
  VoiceBackendMode,
} from "../types";

export function splitIntoSentences(text: string): string[] {
  const result: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (char === "." || char === "!" || char === "?" || char === "\n") {
      result.push(current);
      current = "";
    }
  }
  if (current) result.push(current);
  return result;
}

interface PipelineCallbacks {
  onTranscription: (text: string) => void;
  onContextSummary?: (summary: string, summarizedMessageCount: number) => void;
  onChunk: (text: string) => void;
  onResponseDone: (fullText: string) => void;
  onAudioReady: (audioUri: string) => void;
  onSpeechTextReady: (text: string, voice?: string) => void;
  onError: (error: Error) => void;
}

export async function runVoicePipeline(params: {
  audioUri?: string;
  transcriptionOverride?: string;
  messages: Message[];
  model: string;
  provider: Provider;
  providerApiKey: string;
  sttMode: VoiceBackendMode;
  sttProvider?: Provider | null;
  sttApiKey?: string;
  ttsMode: VoiceBackendMode;
  ttsProvider?: Provider | null;
  ttsApiKey?: string;
  ttsVoice: string;
  replyPlayback: ReplyPlayback;
  contextSummary?: string;
  summarizedMessageCount?: number;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
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
    replyPlayback,
    contextSummary,
    summarizedMessageCount,
    assistantInstructions,
    responseLength,
    responseTone,
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
      const updatedSummary = await summarizeConversationContext({
        existingSummary: effectiveSummary,
        messages: contextPlan.messagesToSummarize,
        model,
        provider,
        apiKey: providerApiKey,
        abortSignal,
      });

      if (abortSignal?.aborted) {
        return transcription;
      }

      if (updatedSummary) {
        effectiveSummary = updatedSummary;
        callbacks.onContextSummary?.(
          updatedSummary,
          contextPlan.targetSummarizedCount
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

  const enqueueTts = (sentence: string) => {
    const task = ttsChain.then(async () => {
      if (abortSignal?.aborted) {
        return;
      }

      if (ttsMode === "native") {
        callbacks.onSpeechTextReady(sentence, undefined);
        return;
      }

      const audio = await synthesizeSpeech({
        text: sentence,
        voice: ttsVoice,
        mode: ttsMode,
        provider: ttsProvider,
        apiKey: ttsApiKey,
      });

      if (!abortSignal?.aborted) {
        callbacks.onAudioReady(audio);
      }
    });

    ttsChain = task.catch((error) => {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    });
    ttsQueue.push(task.catch(() => undefined));
  };

  await streamChat({
    messages: allMessages,
    model,
    provider,
    apiKey: providerApiKey,
    assistantInstructions,
    responseLength,
    responseTone,
    conversationSummary: effectiveSummary || undefined,
    abortSignal,
    onChunk: (text) => {
      if (abortSignal?.aborted) return;
      callbacks.onChunk(text);
      if (replyPlayback === "stream") {
        sentenceBuffer += text;
        const sentences = splitIntoSentences(sentenceBuffer);
        if (sentences.length > 1) {
          for (let i = 0; i < sentences.length - 1; i++) enqueueTts(sentences[i]);
          sentenceBuffer = sentences[sentences.length - 1];
        }
      }
    },
    onDone: async (fullText) => {
      if (abortSignal?.aborted) return;
      callbacks.onResponseDone(fullText);
      if (replyPlayback === "stream") {
        if (sentenceBuffer.trim()) enqueueTts(sentenceBuffer);
      } else {
        enqueueTts(fullText);
      }
    },
    onError: callbacks.onError,
  });

  await Promise.all(ttsQueue);
  return transcription;
}
