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
});
