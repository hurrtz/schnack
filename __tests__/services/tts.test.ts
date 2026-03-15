import { synthesizeSpeech } from "../../src/services/tts";

global.fetch = jest.fn();

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
      })
    ).rejects.toThrow("Choose a text-to-speech provider");
  });
});
