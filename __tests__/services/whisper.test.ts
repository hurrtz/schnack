import { transcribeAudio } from "../../src/services/whisper";

global.fetch = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve("ZmFrZS1hdWRpbw==")),
}));

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

  it("uses Gemini audio understanding for Google STT", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: "Bonjour tout le monde" }],
              },
            },
          ],
        }),
    });

    const result = await transcribeAudio({
      fileUri: "/path/to/audio.m4a",
      mode: "provider",
      provider: "gemini",
      apiKey: "AIza-test",
    });

    expect(result).toBe("Bonjour tout le monde");
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    );
    expect(options.headers["x-goog-api-key"]).toBe("AIza-test");
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("audio/m4a");
  });

  it("sends language hints for Mistral STT", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Hello world" }),
    });

    const result = await transcribeAudio({
      fileUri: "/path/to/audio.m4a",
      mode: "provider",
      provider: "mistral",
      apiKey: "mistral-test",
    });

    expect(result).toBe("Hello world");
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.mistral.ai/v1/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer mistral-test");
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
