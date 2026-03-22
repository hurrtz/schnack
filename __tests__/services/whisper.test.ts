import { transcribeAudio } from "../../src/services/whisper";

global.fetch = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve("ZmFrZQ==")),
  getInfoAsync: jest.fn(() =>
    Promise.resolve({
      exists: true,
      size: 8192,
    })
  ),
}));

describe("transcribeAudio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a human-readable rate limit error for provider STT", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          error: {
            message: "Rate limit exceeded",
          },
        }),
    });

    await expect(
      transcribeAudio({
        fileUri: "/tmp/recording.m4a",
        mode: "provider",
        provider: "openai",
        apiKey: "sk-test",
        language: "en",
      })
    ).rejects.toThrow(
      "OpenAI is rate limiting speech transcription right now. Try again in a moment."
    );
  });

  it("returns a human-readable network error for provider STT", async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(
      new TypeError("Network request failed")
    );

    await expect(
      transcribeAudio({
        fileUri: "/tmp/recording.m4a",
        mode: "provider",
        provider: "groq",
        apiKey: "gsk-test",
        language: "en",
      })
    ).rejects.toThrow(
      "Couldn't reach Groq for speech transcription. Check the connection and try again."
    );
  });

  it("aborts before starting the provider request when the signal is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      transcribeAudio({
        fileUri: "/tmp/recording.m4a",
        mode: "provider",
        provider: "openai",
        apiKey: "sk-test",
        language: "en",
        abortSignal: controller.signal,
      })
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
