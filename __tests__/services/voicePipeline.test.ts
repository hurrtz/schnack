import { splitIntoSentences, runVoicePipeline } from "../../src/services/voicePipeline";
import { transcribeAudio } from "../../src/services/whisper";
import { streamChat, summarizeConversationContext } from "../../src/services/llm";
import { synthesizeSpeech } from "../../src/services/tts";

jest.mock("../../src/services/whisper", () => ({
  transcribeAudio: jest.fn(),
}));

jest.mock("../../src/services/llm", () => ({
  streamChat: jest.fn(),
  summarizeConversationContext: jest.fn(),
}));

jest.mock("../../src/services/tts", () => ({
  LOCAL_TTS_MAX_INPUT_CHARS: 420,
  PROVIDER_TTS_MAX_INPUT_CHARS: 3500,
  splitTextForTts: (text: string, maxChars = 3500) => {
    const normalized = text.trim();

    if (!normalized) {
      return [];
    }

    const words = normalized.split(/\s+/);
    const chunks: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;

      if (next.length <= maxChars) {
        current = next;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      current = word;
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  },
  synthesizeSpeech: jest.fn(),
}));

describe("splitIntoSentences", () => {
  it("splits on period", () => { expect(splitIntoSentences("Hello. World.")).toEqual(["Hello.", " World."]); });
  it("splits on question mark", () => { expect(splitIntoSentences("How? Why?")).toEqual(["How?", " Why?"]); });
  it("splits on exclamation mark", () => { expect(splitIntoSentences("Wow! Great!")).toEqual(["Wow!", " Great!"]); });
  it("splits on newline", () => { expect(splitIntoSentences("Line one\nLine two")).toEqual(["Line one\n", "Line two"]); });
  it("returns single chunk for no delimiters", () => { expect(splitIntoSentences("hello world")).toEqual(["hello world"]); });
});

describe("runVoicePipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (summarizeConversationContext as jest.Mock).mockResolvedValue("");
  });

  it("uses a native transcript override and skips provider STT", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({ onChunk, onDone }: { onChunk: (text: string) => void; onDone: (text: string) => Promise<void> }) => {
        onChunk("Wind is moving air.");
        await onDone("Wind is moving air.");
      }
    );

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onError: jest.fn(),
    };

    const result = await runVoicePipeline({
      transcriptionOverride: "Explain wind.",
      messages: [],
      model: "llama-3.3-70b-versatile",
      provider: "groq",
      providerApiKey: "gsk-test",
      sttMode: "native",
      ttsMode: "native",
      ttsVoice: "alloy",
      replyPlayback: "wait",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(result).toBe("Explain wind.");
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(callbacks.onTranscription).toHaveBeenCalledWith("Explain wind.");
    expect(callbacks.onSpeechTextReady).toHaveBeenCalledWith("Wind is moving air.", undefined);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("speaks a completed sentence immediately in stream mode", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({
        onChunk,
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        onChunk("Wind is moving air.");
        await Promise.resolve();
        expect(events).toEqual(["speak:Wind is moving air."]);
        await onDone("Wind is moving air.");
      }
    );

    const events: string[] = [];
    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(() => {
        events.push("response-done");
      }),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn((text: string) => {
        events.push(`speak:${text}`);
      }),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Explain wind.",
      messages: [],
      model: "llama-3.3-70b-versatile",
      provider: "groq",
      providerApiKey: "gsk-test",
      sttMode: "native",
      ttsMode: "native",
      ttsVoice: "alloy",
      replyPlayback: "stream",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(callbacks.onSpeechTextReady).toHaveBeenCalledWith("Wind is moving air.", undefined);
    expect(events).toEqual(["speak:Wind is moving air.", "response-done"]);
  });

  it("queues provider TTS sentence by sentence in stream mode", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({
        onChunk,
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        onChunk("Sentence one. Sentence two.");
        await onDone("Sentence one. Sentence two.");
      }
    );

    (synthesizeSpeech as jest.Mock)
      .mockResolvedValueOnce("/tmp/tts-1.mp3")
      .mockResolvedValueOnce("/tmp/tts-2.mp3");

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Explain glass.",
      messages: [],
      model: "gpt-5.4",
      provider: "openai",
      providerApiKey: "sk-test",
      sttMode: "native",
      ttsMode: "provider",
      ttsProvider: "openai",
      ttsApiKey: "sk-test",
      ttsVoice: "alloy",
      replyPlayback: "stream",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(synthesizeSpeech).toHaveBeenNthCalledWith(1, {
      text: "Sentence one.",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });
    expect(synthesizeSpeech).toHaveBeenNthCalledWith(2, {
      text: "Sentence two.",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });
    expect(callbacks.onAudioReady).toHaveBeenCalledTimes(2);
    expect(callbacks.onSpeechTextReady).not.toHaveBeenCalled();
  });

  it("batches local TTS until the full reply is done even in stream mode", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({
        onChunk,
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        onChunk("Sentence one. Sentence two.");
        await Promise.resolve();
        expect(synthesizeSpeech).not.toHaveBeenCalled();
        await onDone("Sentence one. Sentence two.");
      }
    );

    (synthesizeSpeech as jest.Mock).mockResolvedValueOnce("/tmp/local-tts-1.wav");

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Explain glass.",
      messages: [],
      model: "gpt-5.4",
      provider: "openai",
      providerApiKey: "sk-test",
      sttMode: "native",
      ttsMode: "local",
      ttsVoice: "alloy",
      ttsListenLanguages: ["en"],
      localTtsVoices: {
        en: "af_bella",
        de: "thorsten-medium",
        zh: "zf_xiaobei",
        es: "vits-piper-es_ES-davefx-medium",
        pt: "vits-piper-pt_BR-faber-medium",
        hi: "vits-piper-hi_IN-priyamvada-medium",
        fr: "vits-piper-fr_FR-siwis-medium",
        it: "vits-piper-it_IT-paola-medium",
        ja: "",
      },
      replyPlayback: "stream",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(synthesizeSpeech).toHaveBeenCalledWith({
      text: "Sentence one. Sentence two.",
      voice: "alloy",
      mode: "local",
      provider: undefined,
      apiKey: undefined,
      language: "en",
      listenLanguages: ["en"],
      localVoices: {
        en: "af_bella",
        de: "thorsten-medium",
        zh: "zf_xiaobei",
        es: "vits-piper-es_ES-davefx-medium",
        pt: "vits-piper-pt_BR-faber-medium",
        hi: "vits-piper-hi_IN-priyamvada-medium",
        fr: "vits-piper-fr_FR-siwis-medium",
        it: "vits-piper-it_IT-paola-medium",
        ja: "",
      },
    });
    expect(callbacks.onAudioReady).toHaveBeenCalledTimes(1);
    expect(callbacks.onSpeechTextReady).not.toHaveBeenCalled();
  });

  it("flushes a trailing partial sentence for provider TTS when the stream finishes", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({
        onChunk,
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        onChunk("One. Two");
        await onDone("One. Two");
      }
    );

    (synthesizeSpeech as jest.Mock)
      .mockResolvedValueOnce("/tmp/tts-1.mp3")
      .mockResolvedValueOnce("/tmp/tts-2.mp3");

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Count.",
      messages: [],
      model: "gpt-5.4",
      provider: "openai",
      providerApiKey: "sk-test",
      sttMode: "native",
      ttsMode: "provider",
      ttsProvider: "openai",
      ttsApiKey: "sk-test",
      ttsVoice: "alloy",
      replyPlayback: "stream",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(synthesizeSpeech).toHaveBeenNthCalledWith(1, {
      text: "One.",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });
    expect(synthesizeSpeech).toHaveBeenNthCalledWith(2, {
      text: "Two",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });
    expect(callbacks.onAudioReady).toHaveBeenCalledTimes(2);
  });

  it("chunks long provider TTS replies in wait mode", async () => {
    const longReply = Array.from(
      { length: 180 },
      () => "This is a deliberately long reply sentence."
    ).join(" ");

    (streamChat as jest.Mock).mockImplementation(
      async ({
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        await onDone(longReply);
      }
    );

    (synthesizeSpeech as jest.Mock).mockImplementation(
      async ({ text }: { text: string }) => `/tmp/tts-${text.length}.mp3`
    );

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Summarize the route.",
      messages: [],
      model: "gpt-5.4",
      provider: "openai",
      providerApiKey: "sk-test",
      sttMode: "native",
      ttsMode: "provider",
      ttsProvider: "openai",
      ttsApiKey: "sk-test",
      ttsVoice: "alloy",
      replyPlayback: "wait",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    const synthesizedTexts = (synthesizeSpeech as jest.Mock).mock.calls.map(
      ([params]: [{ text: string }]) => params.text
    );

    expect(synthesizedTexts.length).toBeGreaterThan(1);
    expect(synthesizedTexts.every((text: string) => text.length <= 3500)).toBe(true);
    expect(synthesizedTexts.join(" ")).toBe(longReply);
    expect(callbacks.onAudioReady).toHaveBeenCalledTimes(synthesizedTexts.length);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("falls back to native speech when provider TTS fails in wait mode", async () => {
    (streamChat as jest.Mock).mockImplementation(
      async ({
        onDone,
      }: {
        onChunk: (text: string) => void;
        onDone: (text: string) => Promise<void>;
      }) => {
        await onDone("A complete answer.");
      }
    );

    (synthesizeSpeech as jest.Mock).mockRejectedValueOnce(
      new Error("Provider TTS unavailable")
    );

    const callbacks = {
      onTranscription: jest.fn(),
      onChunk: jest.fn(),
      onResponseDone: jest.fn(),
      onAudioReady: jest.fn(),
      onSpeechTextReady: jest.fn(),
      onTtsFallback: jest.fn(),
      onError: jest.fn(),
    };

    await runVoicePipeline({
      transcriptionOverride: "Explain the issue.",
      messages: [],
      model: "gpt-5.4",
      provider: "openai",
      providerApiKey: "sk-test",
      sttMode: "native",
      ttsMode: "provider",
      ttsProvider: "openai",
      ttsApiKey: "sk-test",
      ttsVoice: "alloy",
      replyPlayback: "wait",
      assistantInstructions: "You are a voice assistant.",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
      callbacks,
    });

    expect(callbacks.onTtsFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Provider TTS unavailable",
      })
    );
    expect(callbacks.onSpeechTextReady).toHaveBeenCalledWith(
      "A complete answer.",
      undefined
    );
    expect(callbacks.onAudioReady).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});
