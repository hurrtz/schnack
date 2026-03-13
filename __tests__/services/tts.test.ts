import { synthesizeSpeech } from "../../src/services/tts";
global.fetch = jest.fn();

jest.mock("../../src/config", () => ({
  OPENAI_API_KEY: "sk-test-key",
  ANTHROPIC_API_KEY: "sk-ant-test-key",
}));

describe("synthesizeSpeech", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("calls OpenAI TTS API and returns audio ArrayBuffer", async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(mockArrayBuffer) });
    const result = await synthesizeSpeech("Hello world", "alloy");
    expect(result).toBe(mockArrayBuffer);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe("alloy");
    expect(body.input).toBe("Hello world");
  });

  it("throws on API error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("Bad Request") });
    await expect(synthesizeSpeech("Test", "alloy")).rejects.toThrow();
  });
});
