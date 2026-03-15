import { transcribeAudio } from "../../src/services/whisper";

global.fetch = jest.fn();

describe("transcribeAudio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends audio to the configured provider STT endpoint and returns text", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Hello world" }),
    });

    const result = await transcribeAudio({
      fileUri: "/path/to/audio.m4a",
      mode: "provider",
      provider: "groq",
      apiKey: "gsk-test",
    });

    expect(result).toBe("Hello world");
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer gsk-test");
  });

  it("returns null for empty transcription", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "  " }),
    });

    const result = await transcribeAudio({
      fileUri: "/path/to/audio.m4a",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(result).toBeNull();
  });

  it("throws for native mode because native STT bypasses this service", async () => {
    await expect(
      transcribeAudio({
        fileUri: "/path/to/audio.m4a",
        mode: "native",
      })
    ).rejects.toThrow("Native STT is handled directly");
  });
});
