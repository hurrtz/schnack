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
      callbacks,
    });

    expect(callbacks.onSpeechTextReady).toHaveBeenCalledWith("Wind is moving air.", undefined);
    expect(events).toEqual(["speak:Wind is moving air.", "response-done"]);
  });
});
