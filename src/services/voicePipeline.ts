import { transcribeAudio } from "./whisper";
import { streamChat } from "./llm";
import { synthesizeSpeech } from "./tts";
import { Message, Provider } from "../types";

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
  onChunk: (text: string) => void;
  onResponseDone: (fullText: string) => void;
  onAudioReady: (audioUri: string) => void;
  onError: (error: Error) => void;
}

export async function runVoicePipeline(params: {
  audioUri: string;
  messages: Message[];
  model: string;
  provider: Provider;
  providerApiKey: string;
  openAIApiKey: string;
  ttsVoice: string;
  ttsPlayback: "stream" | "wait";
  callbacks: PipelineCallbacks;
  abortSignal?: AbortSignal;
}): Promise<string | null> {
  const {
    audioUri,
    messages,
    model,
    provider,
    providerApiKey,
    openAIApiKey,
    ttsVoice,
    ttsPlayback,
    callbacks,
    abortSignal,
  } = params;

  const transcription = await transcribeAudio(audioUri, openAIApiKey);
  if (!transcription) return null;
  callbacks.onTranscription(transcription);
  if (abortSignal?.aborted) return transcription;

  const allMessages: Message[] = [...messages, { id: "pending", role: "user", content: transcription, model: null, provider: null, timestamp: new Date().toISOString() }];

  let sentenceBuffer = "";
  const ttsQueue: Promise<void>[] = [];

  const enqueueTts = (sentence: string) => {
    const promise = synthesizeSpeech(sentence, ttsVoice, openAIApiKey)
      .then((audio) => { if (!abortSignal?.aborted) callbacks.onAudioReady(audio); })
      .catch(callbacks.onError);
    ttsQueue.push(promise);
  };

  await streamChat({
    messages: allMessages, model, provider, apiKey: providerApiKey, abortSignal,
    onChunk: (text) => {
      if (abortSignal?.aborted) return;
      callbacks.onChunk(text);
      if (ttsPlayback === "stream") {
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
      if (ttsPlayback === "stream") { if (sentenceBuffer.trim()) enqueueTts(sentenceBuffer); }
      else { enqueueTts(fullText); }
    },
    onError: callbacks.onError,
  });

  await Promise.all(ttsQueue);
  return transcription;
}
