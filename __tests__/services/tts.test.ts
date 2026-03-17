import {
  getProviderTtsTimeoutMs,
  PROVIDER_TTS_MAX_TIMEOUT_MS,
  PROVIDER_TTS_TIMEOUT_MS,
  synthesizeSpeech,
  synthesizeSpeechSequence,
  TtsRequestError,
} from "../../src/services/tts";

global.fetch = jest.fn();

jest.mock("../../src/services/localTts", () => ({
  synthesizeLocalSpeech: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/tmp/",
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

class MockFileReader {
  public result: string | ArrayBuffer | null = null;
  public onloadend: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  readAsDataURL() {
    this.result = "data:audio/mpeg;base64,ZmFrZQ==";
    this.onloadend?.();
  }
}

Object.defineProperty(global, "FileReader", {
  value: MockFileReader,
  writable: true,
});

const { synthesizeLocalSpeech } = jest.requireMock("../../src/services/localTts") as {
  synthesizeLocalSpeech: jest.Mock;
};

const localVoices = {
  en: "af_heart",
  de: "thorsten-medium",
  zh: "zf_xiaoxiao",
  es: "",
  pt: "",
  hi: "",
  fr: "",
  it: "",
  ja: "",
};

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the configured provider TTS API and returns a cached file path", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const result = await synthesizeSpeech({
      text: "Hello world",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });

    expect(result).toMatch(/^\/tmp\/tts-/);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe("alloy");
    expect(body.input).toBe("Hello world");
  });

  it("throws when provider mode is selected without a provider", async () => {
    await expect(
      synthesizeSpeech({
        text: "Test",
        voice: "alloy",
        mode: "provider",
        language: "en",
      })
    ).rejects.toThrow("Choose a text-to-speech provider");
  });

  it("calls Together TTS with a provider-specific language hint", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const result = await synthesizeSpeech({
      text: "Hello world",
      voice: "af_alloy",
      mode: "provider",
      provider: "together",
      apiKey: "together-test",
      language: "en",
    });

    expect(result).toMatch(/^\/tmp\/tts-.*\.mp3$/);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.together.xyz/v1/audio/speech");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("hexgrad/Kokoro-82M");
    expect(body.language).toBe("en");
    expect(body.voice).toBe("af_alloy");
  });

  it("uses Gemini TTS and writes a wav file", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/L16;rate=24000",
                      data: "AQACAAMABAA=",
                    },
                  },
                ],
              },
            },
          ],
        }),
    });

    const result = await synthesizeSpeech({
      text: "Hallo Welt",
      voice: "Aoede",
      mode: "provider",
      provider: "gemini",
      apiKey: "AIza-test",
      language: "de",
    });

    expect(result).toMatch(/^\/tmp\/tts-.*\.wav$/);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"
    );
    expect(options.headers["x-goog-api-key"]).toBe("AIza-test");
    const body = JSON.parse(options.body);
    expect(
      body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName
    ).toBe("Aoede");
  });

  it("uses the German local voice pack before any fallback", async () => {
    synthesizeLocalSpeech.mockResolvedValueOnce("/tmp/local-de.wav");

    const result = await synthesizeSpeech({
      text: "Ich glaube, das ist die richtige Antwort.",
      voice: "alloy",
      mode: "local",
      language: "en",
      listenLanguages: ["en", "de"],
      localVoices,
    });

    expect(result).toBe("/tmp/local-de.wav");
    expect(synthesizeLocalSpeech).toHaveBeenCalledWith({
      text: "Ich glaube, das ist die richtige Antwort.",
      language: "de",
      voice: "thorsten-medium",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to provider TTS when German local synthesis fails", async () => {
    synthesizeLocalSpeech.mockRejectedValueOnce(new Error("local failure"));
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const result = await synthesizeSpeech({
      text: "Ich glaube, das ist die richtige Antwort.",
      voice: "alloy",
      mode: "local",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
      listenLanguages: ["de"],
      localVoices,
    });

    expect(result).toMatch(/^\/tmp\/tts-/);
    expect(synthesizeLocalSpeech).toHaveBeenCalledWith({
      text: "Ich glaube, das ist die richtige Antwort.",
      language: "de",
      voice: "thorsten-medium",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("calls xAI TTS with provider-specific fields", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const result = await synthesizeSpeech({
      text: "Hello world",
      voice: "leo",
      mode: "provider",
      provider: "xai",
      apiKey: "xai-test",
      language: "en",
    });

    expect(result).toMatch(/^\/tmp\/tts-.*\.mp3$/);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.x.ai/v1/audio/speech");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("grok-tts-mini");
    expect(body.voice_id).toBe("leo");
    expect(body.output_format.codec).toBe("mp3");
  });

  it("splits long provider speech into multiple synthesis requests", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const segments = await synthesizeSpeechSequence({
      text: `${"Sentence one. ".repeat(400)}Sentence two.`,
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
    });

    expect(segments.length).toBeGreaterThan(1);
    expect((fetch as jest.Mock).mock.calls.length).toBeGreaterThan(1);
  });

  it("surfaces a readable long-input TTS error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: {
              message:
                "String should have at most 4096 characters",
              type: "invalid_request_error",
              code: "string_too_long",
            },
          })
        ),
    });

    await expect(
      synthesizeSpeech({
        text: "Hello world",
        voice: "alloy",
        mode: "provider",
        provider: "openai",
        apiKey: "sk-test",
        language: "en",
      })
    ).rejects.toEqual(
      expect.objectContaining<TtsRequestError>({
        name: "TtsRequestError",
        inputTooLong: true,
        message:
          "OpenAI speech output rejected the reply because it was too long.",
      })
    );
  });

  it("times out a hanging provider TTS request with a readable error", async () => {
    jest.useFakeTimers();
    try {
      (fetch as jest.Mock).mockImplementation(() => new Promise(() => undefined));
      const text = "Hello world";

      const pending = synthesizeSpeech({
        text,
        voice: "alloy",
        mode: "provider",
        provider: "openai",
        apiKey: "sk-test",
        language: "en",
      });
      const expectation = expect(pending).rejects.toThrow(
        "OpenAI speech output took too long."
      );

      await jest.advanceTimersByTimeAsync(getProviderTtsTimeoutMs(text) + 1);

      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it("scales provider TTS timeout with reply length up to a cap", () => {
    expect(getProviderTtsTimeoutMs("short")).toBeGreaterThan(PROVIDER_TTS_TIMEOUT_MS);
    expect(getProviderTtsTimeoutMs("x".repeat(10000))).toBe(PROVIDER_TTS_MAX_TIMEOUT_MS);
  });
});
