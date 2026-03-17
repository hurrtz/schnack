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
});

describe("supportsLocalTtsLanguage", () => {
  it("currently supports English and German", () => {
    expect(supportsLocalTtsLanguage("en")).toBe(true);
    expect(supportsLocalTtsLanguage("de")).toBe(true);
  });
});
