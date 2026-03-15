import {
  getEnabledProviders,
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../../src/utils/providerCapabilities";
import { DEFAULT_SETTINGS } from "../../src/types";

describe("provider capability selectors", () => {
  it("filters enabled providers by configured API keys", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      apiKeys: {
        ...DEFAULT_SETTINGS.apiKeys,
        gemini: "AIza-test",
        groq: "gsk_test",
        mistral: "mistral_test",
        together: "together_test",
        xai: "xai-test",
      },
    };

    expect(getEnabledProviders(settings)).toEqual([
      "gemini",
      "xai",
      "groq",
      "mistral",
      "together",
    ]);
    expect(getEnabledSttProviders(settings)).toEqual([
      "gemini",
      "groq",
      "mistral",
      "together",
    ]);
    expect(getEnabledTtsProviders(settings)).toEqual([
      "gemini",
      "xai",
      "together",
    ]);
  });

  it("keeps OpenAI available for both STT and TTS when configured", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      apiKeys: {
        ...DEFAULT_SETTINGS.apiKeys,
        openai: "sk-test",
        anthropic: "sk-ant-test",
      },
    };

    expect(getEnabledSttProviders(settings)).toEqual(["openai"]);
    expect(getEnabledTtsProviders(settings)).toEqual(["openai"]);
  });
});
