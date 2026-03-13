import { transcribeAudio } from "../../src/services/whisper";
global.fetch = jest.fn();

jest.mock("../../src/config", () => ({
  OPENAI_API_KEY: "sk-test-key",
  ANTHROPIC_API_KEY: "sk-ant-test-key",
}));

describe("transcribeAudio", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("sends audio file to Whisper API and returns text", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ text: "Hello world" }) });
    const result = await transcribeAudio("/path/to/audio.m4a");
    expect(result).toBe("Hello world");
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toMatch(/^Bearer /);
  });

  it("returns null for empty transcription", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ text: "  " }) });
    const result = await transcribeAudio("/path/to/audio.m4a");
    expect(result).toBeNull();
  });

  it("throws on API error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("Internal Server Error") });
    await expect(transcribeAudio("/path/to/audio.m4a")).rejects.toThrow();
  });
});
