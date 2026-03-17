import {
  resolveTtsListenLanguage,
  supportsLocalTtsLanguage,
} from "../../src/utils/ttsRouting";

describe("resolveTtsListenLanguage", () => {
  it("uses the only selected language", () => {
    expect(
      resolveTtsListenLanguage({
        text: "Hello world",
        preferredLanguages: ["en"],
        appLanguage: "en",
      })
    ).toBe("en");
  });

  it("prefers German when German markers are present", () => {
    expect(
      resolveTtsListenLanguage({
        text: "Ich glaube, das ist die richtige Antwort.",
        preferredLanguages: ["en", "de"],
        appLanguage: "en",
      })
    ).toBe("de");
  });

  it("prefers Japanese when the text uses Japanese script", () => {
    expect(
      resolveTtsListenLanguage({
        text: "こんにちは、元気ですか",
        preferredLanguages: ["en", "ja"],
        appLanguage: "en",
      })
    ).toBe("ja");
  });

  it("prefers Simplified Chinese when Han script markers are present", () => {
    expect(
      resolveTtsListenLanguage({
        text: "你好，这是一个本地语音测试。",
        preferredLanguages: ["en", "zh"],
        appLanguage: "en",
      })
    ).toBe("zh");
  });

  it("prefers Hindi when Devanagari text is present", () => {
    expect(
      resolveTtsListenLanguage({
        text: "यह एक छोटा स्थानीय आवाज़ परीक्षण है।",
        preferredLanguages: ["en", "hi"],
        appLanguage: "en",
      })
    ).toBe("hi");
  });

  it("prefers Portuguese when Portuguese markers are present", () => {
    expect(
      resolveTtsListenLanguage({
        text: "Você não precisa responder agora, mas eu não concordo com isso.",
        preferredLanguages: ["es", "pt"],
        appLanguage: "en",
      })
    ).toBe("pt");
  });
});

describe("supportsLocalTtsLanguage", () => {
  it("currently supports every configured local language except Japanese", () => {
    expect(supportsLocalTtsLanguage("en")).toBe(true);
    expect(supportsLocalTtsLanguage("de")).toBe(true);
    expect(supportsLocalTtsLanguage("zh")).toBe(true);
    expect(supportsLocalTtsLanguage("es")).toBe(true);
    expect(supportsLocalTtsLanguage("pt")).toBe(true);
    expect(supportsLocalTtsLanguage("hi")).toBe(true);
    expect(supportsLocalTtsLanguage("fr")).toBe(true);
    expect(supportsLocalTtsLanguage("it")).toBe(true);
    expect(supportsLocalTtsLanguage("ja")).toBe(false);
  });
});
