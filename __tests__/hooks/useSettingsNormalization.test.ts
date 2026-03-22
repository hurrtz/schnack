import { renderHook, waitFor } from "@testing-library/react-native";

import { useSettingsNormalization } from "../../src/components/settings/useSettingsNormalization";
import { DEFAULT_SETTINGS } from "../../src/types";

describe("useSettingsNormalization", () => {
  it("batches settings repair updates into one patch", async () => {
    const onUpdate = jest.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      sttProvider: "anthropic",
      ttsProvider: "anthropic",
      providerSttModels: {
        ...DEFAULT_SETTINGS.providerSttModels,
        openai: "invalid-stt-model",
      },
      providerTtsModels: {
        ...DEFAULT_SETTINGS.providerTtsModels,
        openai: "invalid-tts-model",
      },
      providerTtsVoices: {
        ...DEFAULT_SETTINGS.providerTtsVoices,
        openai: "invalid-voice",
      },
      localTtsVoices: {
        ...DEFAULT_SETTINGS.localTtsVoices,
        en: "",
      },
      responseModes: {
        quick: { provider: "anthropic", model: "claude-sonnet-4-6" },
        normal: { provider: "anthropic", model: "claude-sonnet-4-6" },
        deep: { provider: "anthropic", model: "claude-sonnet-4-6" },
      },
    };

    renderHook(() =>
      useSettingsNormalization({
        visible: true,
        settings,
        enabledProviders: ["openai"],
        enabledSttProviders: ["openai"],
        enabledTtsProviders: ["openai"],
        language: "en",
        onUpdate,
      }),
    );

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sttProvider: "openai",
        ttsProvider: "openai",
        providerSttModels: expect.objectContaining({
          openai: "gpt-4o-transcribe",
        }),
        providerTtsModels: expect.objectContaining({
          openai: "gpt-4o-mini-tts",
        }),
        providerTtsVoices: expect.objectContaining({
          openai: "alloy",
        }),
        localTtsVoices: expect.objectContaining({
          en: "af_heart",
        }),
        responseModes: {
          quick: { provider: "openai", model: "gpt-5.4" },
          normal: { provider: "openai", model: "gpt-5.4" },
          deep: { provider: "openai", model: "gpt-5.4" },
        },
      }),
    );
  });
});
