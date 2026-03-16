import { transcribeAudio } from "./whisper";
import { streamChat, summarizeConversationContext } from "./llm";
import { synthesizeSpeech } from "./tts";
import { buildConversationContextPlan } from "./conversationContext";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  Message,
  Provider,
  ReplyPlayback,
  VoiceBackendMode,
} from "../types";

const PROVIDER_TTS_MAX_INPUT_CHARS = 3500;

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
    completeSentences: segments.slice(0, completeCount).filter((segment) => segment.trim()),
    remainder: segments.slice(completeCount).join(""),
  };
}

function splitLongTtsSegment(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  const words = normalized.split(/\s+/);
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (!word) {
      continue;
    }

    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let index = 0; index < word.length; index += maxChars) {
          chunks.push(word.slice(index, index + maxChars));
        }
      }
      continue;
    }

    const next = `${current} ${word}`;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    pushCurrent();

    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
    }
  }

  pushCurrent();
  return chunks;
}

function splitTextForTts(text: string, maxChars: number): string[] {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const sentenceSegments = splitIntoSentences(normalized);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  const appendSegment = (segment: string) => {
    const normalizedSegment = segment.replace(/\s+/g, " ").trim();

    if (!normalizedSegment) {
      return;
    }

    if (normalizedSegment.length > maxChars) {
      pushCurrent();
      chunks.push(...splitLongTtsSegment(normalizedSegment, maxChars));
      return;
    }

    if (!current) {
      current = normalizedSegment;
      return;
    }

    const next = `${current} ${normalizedSegment}`;

    if (next.length <= maxChars) {
      current = next;
      return;
    }

    pushCurrent();
    current = normalizedSegment;
  };

  sentenceSegments.forEach(appendSegment);
  pushCurrent();
  return chunks;
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
      const updatedSummary = await summarizeConversationContext({
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
        callbacks.onSpeechTextReady(trimmed, undefined);
        return;
      }

      const audio = await synthesizeSpeech({
        text: trimmed,
        voice: ttsVoice,
        mode: ttsMode,
        provider: ttsProvider,
        apiKey: ttsApiKey,
        language,
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

  const enqueueTts = (text: string) => {
    if (ttsMode !== "provider") {
      enqueueTtsChunk(text);
      return;
    }

    const segments = splitTextForTts(text, PROVIDER_TTS_MAX_INPUT_CHARS);

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
      if (replyPlayback === "stream") {
        sentenceBuffer += text;
        const { completeSentences, remainder } = extractCompleteSentences(sentenceBuffer);
        for (const sentence of completeSentences) {
          enqueueStreamPlayback(sentence);
        }
        sentenceBuffer = remainder;
      }
    },
    onDone: async (fullText) => {
      if (abortSignal?.aborted) return;
      callbacks.onResponseDone(fullText);
      if (replyPlayback === "stream") {
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
