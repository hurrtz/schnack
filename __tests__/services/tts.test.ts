import {
  getProviderTtsTimeoutMs,
  PROVIDER_TTS_MAX_TIMEOUT_MS,
  PROVIDER_TTS_TIMEOUT_MS,
  PROVIDER_TTS_MAX_INPUT_CHARS,
  splitIntoSentences,
  splitTextForTts,
  synthesizeSpeech,
  synthesizeSpeechSequence,
  TtsRequestError,
} from "../../src/services/tts";

global.fetch = jest.fn();

jest.mock("../../src/services/localTts", () => ({
  getLocalTtsInstallStatus: jest.fn(),
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

const { getLocalTtsInstallStatus, synthesizeLocalSpeech } = jest.requireMock(
  "../../src/services/localTts",
) as {
  getLocalTtsInstallStatus: jest.Mock;
  synthesizeLocalSpeech: jest.Mock;
};

const localVoices = {
  en: "af_heart",
  de: "thorsten-medium",
  zh: "zf_xiaoxiao",
  es: "vits-piper-es_ES-davefx-medium",
  pt: "vits-piper-pt_BR-faber-medium",
  hi: "vits-piper-hi_IN-priyamvada-medium",
  fr: "vits-piper-fr_FR-siwis-medium",
  it: "vits-piper-it_IT-paola-medium",
  ja: "",
};

function mockInstalledLocalVoice(language: string, voice: string) {
  getLocalTtsInstallStatus.mockImplementation(
    async ({
      language: candidateLanguage,
      voice: candidateVoice,
    }: {
      language: string;
      voice: string;
    }) => ({
      supported: true,
      downloaded: candidateLanguage === language && candidateVoice === voice,
      verified: candidateLanguage === language && candidateVoice === voice,
      installed: candidateLanguage === language && candidateVoice === voice,
      verificationError: null,
    }),
  );
}

describe("splitIntoSentences", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });

  it("splits a single sentence ending with a period", () => {
    expect(splitIntoSentences("Hello world.")).toEqual(["Hello world."]);
  });

  it("splits multiple sentences with different terminators", () => {
    expect(splitIntoSentences("Hi. How are you? Great!\nBye")).toEqual([
      "Hi.",
      " How are you?",
      " Great!",
      "\n",
      "Bye",
    ]);
  });

  it("returns the full text as a single element when there is no sentence boundary", () => {
    expect(splitIntoSentences("no punctuation here")).toEqual([
      "no punctuation here",
    ]);
  });

  it("handles text with only whitespace", () => {
    expect(splitIntoSentences("   ")).toEqual(["   "]);
  });

  it("handles consecutive terminators", () => {
    expect(splitIntoSentences("Wait...")).toEqual(["Wait.", ".", "."]);
  });
});

describe("splitTextForTts", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitTextForTts("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(splitTextForTts("   ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    expect(splitTextForTts("Hello world.")).toEqual(["Hello world."]);
  });

  it("groups sentences together up to the max chars limit", () => {
    const chunks = splitTextForTts("Short. Also short.", 30);
    expect(chunks).toEqual(["Short. Also short."]);
  });

  it("splits into multiple chunks when text exceeds max chars", () => {
    const sentence = "Word. ";
    const text = sentence.repeat(100);
    const chunks = splitTextForTts(text, 20);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it("uses the default max chars constant when none is provided", () => {
    const longText = "Sentence. ".repeat(500);
    const chunks = splitTextForTts(longText);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(PROVIDER_TTS_MAX_INPUT_CHARS);
    }
  });

  it("handles a single very long word by splitting it into fixed-size chunks", () => {
    const longWord = "a".repeat(50);
    const chunks = splitTextForTts(longWord, 20);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe("a".repeat(20));
    expect(chunks[1]).toBe("a".repeat(20));
    expect(chunks[2]).toBe("a".repeat(10));
  });

  it("normalizes internal whitespace", () => {
    const chunks = splitTextForTts("Hello   world.   Goodbye   world.");
    expect(chunks).toEqual(["Hello world. Goodbye world."]);
  });
});

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocalTtsInstallStatus.mockResolvedValue({
      supported: true,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    });
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
      }),
    ).rejects.toThrow("Choose a text-to-speech provider");
  });

  it("falls back to a matching local voice when provider mode has no provider configured", async () => {
    mockInstalledLocalVoice("en", "af_heart");
    synthesizeLocalSpeech.mockResolvedValueOnce("/tmp/local-en.wav");

    const result = await synthesizeSpeech({
      text: "I think this is the right answer.",
      voice: "alloy",
      mode: "provider",
      language: "en",
      listenLanguages: ["en"],
      localVoices,
    });

    expect(result).toBe("/tmp/local-en.wav");
    expect(synthesizeLocalSpeech).toHaveBeenCalledWith({
      text: "I think this is the right answer.",
      language: "en",
      voice: "af_heart",
    });
    expect(fetch).not.toHaveBeenCalled();
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    );
    expect(options.headers["x-goog-api-key"]).toBe("AIza-test");
    const body = JSON.parse(options.body);
    expect(
      body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
        .voiceName,
    ).toBe("Aoede");
  });

  it("uses the German local voice pack before any fallback", async () => {
    mockInstalledLocalVoice("de", "thorsten-medium");
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

  it("uses the Spanish local voice pack before any fallback", async () => {
    mockInstalledLocalVoice("es", "vits-piper-es_ES-davefx-medium");
    synthesizeLocalSpeech.mockResolvedValueOnce("/tmp/local-es.wav");

    const result = await synthesizeSpeech({
      text: "Creo que esta es la respuesta correcta.",
      voice: "alloy",
      mode: "local",
      language: "en",
      listenLanguages: ["es"],
      localVoices,
    });

    expect(result).toBe("/tmp/local-es.wav");
    expect(synthesizeLocalSpeech).toHaveBeenCalledWith({
      text: "Creo que esta es la respuesta correcta.",
      language: "es",
      voice: "vits-piper-es_ES-davefx-medium",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to provider TTS when German local synthesis fails", async () => {
    mockInstalledLocalVoice("de", "thorsten-medium");
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

  it("uses another installed local voice before falling back to the provider", async () => {
    getLocalTtsInstallStatus.mockImplementation(
      async ({ language, voice }: { language: string; voice: string }) => ({
        supported: true,
        downloaded:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        verified:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        installed:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        verificationError: null,
      }),
    );
    synthesizeLocalSpeech
      .mockRejectedValueOnce(new Error("selected voice failed"))
      .mockResolvedValueOnce("/tmp/local-heart.wav");

    const result = await synthesizeSpeech({
      text: "This should still stay local.",
      voice: "alloy",
      mode: "local",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
      listenLanguages: ["en"],
      localVoices: {
        ...localVoices,
        en: "af_bella",
      },
    });

    expect(result).toBe("/tmp/local-heart.wav");
    expect(synthesizeLocalSpeech).toHaveBeenNthCalledWith(1, {
      text: "This should still stay local.",
      language: "en",
      voice: "af_bella",
    });
    expect(synthesizeLocalSpeech).toHaveBeenNthCalledWith(2, {
      text: "This should still stay local.",
      language: "en",
      voice: "af_heart",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not switch to another local voice when strict local voice mode is enabled", async () => {
    getLocalTtsInstallStatus.mockImplementation(
      async ({ language, voice }: { language: string; voice: string }) => ({
        supported: true,
        downloaded:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        verified:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        installed:
          language === "en" && (voice === "af_bella" || voice === "af_heart"),
        verificationError: null,
      }),
    );
    synthesizeLocalSpeech.mockRejectedValueOnce(
      new Error("selected voice failed"),
    );
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-audio"])),
    });

    const result = await synthesizeSpeech({
      text: "Preview this exact voice.",
      voice: "alloy",
      mode: "local",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
      listenLanguages: ["en"],
      localVoices: {
        ...localVoices,
        en: "af_bella",
      },
      strictLocalVoice: true,
    });

    expect(result).toMatch(/^\/tmp\/tts-/);
    expect(synthesizeLocalSpeech).toHaveBeenCalledTimes(1);
    expect(synthesizeLocalSpeech).toHaveBeenCalledWith({
      text: "Preview this exact voice.",
      language: "en",
      voice: "af_bella",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to a matching local voice when provider synthesis fails", async () => {
    mockInstalledLocalVoice("de", "thorsten-medium");
    (fetch as jest.Mock).mockRejectedValueOnce(new Error("provider failure"));
    synthesizeLocalSpeech.mockResolvedValueOnce("/tmp/local-de.wav");

    const result = await synthesizeSpeech({
      text: "Ich glaube, das ist die richtige Antwort.",
      voice: "alloy",
      mode: "provider",
      provider: "openai",
      apiKey: "sk-test",
      language: "en",
      listenLanguages: ["de"],
      localVoices,
    });

    expect(result).toBe("/tmp/local-de.wav");
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
              message: "String should have at most 4096 characters",
              type: "invalid_request_error",
              code: "string_too_long",
            },
          }),
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
      }),
    ).rejects.toEqual(
      expect.objectContaining<TtsRequestError>({
        name: "TtsRequestError",
        inputTooLong: true,
        message:
          "OpenAI speech output rejected the reply because it was too long.",
      }),
    );
  });

  it("times out a hanging provider TTS request with a readable error", async () => {
    jest.useFakeTimers();
    try {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise(() => undefined),
      );
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
        "OpenAI speech output took too long.",
      );

      await jest.advanceTimersByTimeAsync(getProviderTtsTimeoutMs(text) + 1);

      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it("scales provider TTS timeout with reply length up to a cap", () => {
    expect(getProviderTtsTimeoutMs("short")).toBeGreaterThan(
      PROVIDER_TTS_TIMEOUT_MS,
    );
    expect(getProviderTtsTimeoutMs("x".repeat(10000))).toBe(
      PROVIDER_TTS_MAX_TIMEOUT_MS,
    );
  });
});
