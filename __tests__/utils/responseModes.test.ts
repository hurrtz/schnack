import {
  getAvailableResponseModes,
  getProviderValidationModel,
} from "../../src/utils/responseModes";
import { DEFAULT_SETTINGS } from "../../src/types";

describe("response mode selectors", () => {
  it("returns only response modes backed by configured provider keys", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      apiKeys: {
        ...DEFAULT_SETTINGS.apiKeys,
        groq: "gsk_test",
        openai: "sk-test",
      },
    };

    expect(getAvailableResponseModes(settings)).toEqual(["quick", "deep"]);
  });

  it("prefers the active response mode model when validating a provider", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      activeResponseMode: "quick" as const,
      responseModes: {
        ...DEFAULT_SETTINGS.responseModes,
        quick: {
          provider: "openai" as const,
          model: "gpt-5-mini-2025-08-07",
        },
        deep: {
          provider: "openai" as const,
          model: "gpt-5.4",
        },
      },
      providerModels: {
        ...DEFAULT_SETTINGS.providerModels,
        openai: "gpt-4.1",
      },
    };

    expect(getProviderValidationModel(settings, "openai")).toBe(
      "gpt-5-mini-2025-08-07",
    );
  });
});
