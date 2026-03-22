import { DEFAULT_SETTINGS } from "../../src/types";
import {
  getNormalizedLocalTtsVoices,
  getNormalizedProviderTtsVoices,
  getNormalizedResponseModes,
  getNormalizedSttProvider,
} from "../../src/components/settings/settingsRules";

describe("settingsRules", () => {
  it("repairs an invalid provider STT selection", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      sttMode: "provider" as const,
      sttProvider: "openai" as const,
    };

    expect(getNormalizedSttProvider(settings, ["groq"])).toBe("groq");
  });

  it("repairs response modes that point to disabled providers", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      responseModes: {
        quick: { provider: "openai" as const, model: "gpt-5.4" },
        normal: { provider: "openai" as const, model: "gpt-5.4" },
        deep: { provider: "openai" as const, model: "gpt-5.4" },
      },
      providerModels: {
        ...DEFAULT_SETTINGS.providerModels,
        groq: "llama-3.3-70b-versatile",
      },
    };

    const next = getNormalizedResponseModes(settings, ["groq"]);

    expect(next).toEqual({
      quick: { provider: "groq", model: "llama-3.3-70b-versatile" },
      normal: { provider: "groq", model: "llama-3.3-70b-versatile" },
      deep: { provider: "groq", model: "llama-3.3-70b-versatile" },
    });
  });

  it("repairs invalid provider and local voice selections", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      providerTtsVoices: {
        ...DEFAULT_SETTINGS.providerTtsVoices,
        openai: "not-a-real-voice",
      },
      localTtsVoices: {
        ...DEFAULT_SETTINGS.localTtsVoices,
        en: "not-a-real-local-voice",
      },
      ttsListenLanguages: ["en"] as const,
    };

    const nextProviderVoices = getNormalizedProviderTtsVoices(
      settings,
      ["openai"],
      "en",
    );
    const nextLocalVoices = getNormalizedLocalTtsVoices(settings);

    expect(nextProviderVoices?.openai).toBe("alloy");
    expect(nextLocalVoices?.en).not.toBe("not-a-real-local-voice");
  });
});
