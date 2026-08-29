import {
  RUNTIME_PROVIDER_MANIFEST,
  RUNTIME_PROVIDER_ORDER,
} from "../../../src/constants/providers/runtimeManifest";
import type { Provider } from "../../../src/types";

function modelIds(models: readonly { id: string }[]) {
  return models.map((model) => model.id);
}

describe("runtime provider manifest integrity", () => {
  it("keeps provider ids, order, and manifest entries aligned", () => {
    expect(Object.keys(RUNTIME_PROVIDER_MANIFEST)).toEqual(
      expect.arrayContaining(RUNTIME_PROVIDER_ORDER),
    );
    expect(Object.keys(RUNTIME_PROVIDER_MANIFEST)).toHaveLength(
      RUNTIME_PROVIDER_ORDER.length,
    );

    for (const provider of RUNTIME_PROVIDER_ORDER) {
      expect(RUNTIME_PROVIDER_MANIFEST[provider].appProvider).toBe(provider);
    }
  });

  it.each(RUNTIME_PROVIDER_ORDER)(
    "keeps %s LLM support callable and internally consistent",
    (provider) => {
      const llm = RUNTIME_PROVIDER_MANIFEST[provider].llm;

      if (llm.support === "none") {
        expect(llm.transport).toBe("none");
        expect(llm.models).toEqual([]);
        return;
      }

      expect(llm.transport).not.toBe("none");
      expect(llm.models.length).toBeGreaterThan(0);
      expect(modelIds(llm.models)).toContain(llm.defaultModel);
      expect(llm.fallbackModelIds.length).toBeGreaterThan(0);
      expect(llm.fallbackModelIds).toEqual(
        expect.arrayContaining([llm.defaultModel]),
      );
      expect(
        llm.fallbackModelIds.every((model) =>
          modelIds(llm.models).includes(model),
        ),
      ).toBe(true);
    },
  );

  it.each(RUNTIME_PROVIDER_ORDER)(
    "keeps %s STT support callable and internally consistent",
    (provider) => {
      const stt = RUNTIME_PROVIDER_MANIFEST[provider].stt;

      if (stt.support === "none") {
        expect(stt.transport).toBe("none");
        expect(stt.models).toEqual([]);
        return;
      }

      expect(stt.transport).not.toBe("none");
      expect(stt.endpoint ?? stt.endpointBase).toBeTruthy();
      expect(stt.defaultModel).toBeTruthy();
      expect(modelIds(stt.models)).toContain(stt.defaultModel);
      expect(stt.fallbackModelIds).toEqual(
        expect.arrayContaining([stt.defaultModel]),
      );
      expect(
        stt.fallbackModelIds?.every((model) =>
          modelIds(stt.models).includes(model),
        ),
      ).toBe(true);
      expect(stt.languages?.length).toBeGreaterThan(0);
    },
  );

  it.each(RUNTIME_PROVIDER_ORDER)(
    "keeps %s TTS support callable and internally consistent",
    (provider) => {
      const tts = RUNTIME_PROVIDER_MANIFEST[provider].tts;

      if (tts.support === "none") {
        expect(tts.transport).toBe("none");
        expect(tts.models).toEqual([]);
        return;
      }

      expect(tts.transport).not.toBe("none");
      expect(tts.endpoint ?? tts.endpointBase).toBeTruthy();
      expect(tts.defaultModel).toBeTruthy();
      expect(modelIds(tts.models)).toContain(tts.defaultModel);
      expect(tts.fallbackModelIds).toEqual(
        expect.arrayContaining([tts.defaultModel]),
      );
      expect(
        tts.fallbackModelIds?.every((model) =>
          modelIds(tts.models).includes(model),
        ),
      ).toBe(true);
      expect(tts.languages?.length).toBeGreaterThan(0);

      if (tts.transport === "binary") {
        expect(tts.requestFormat).toBeTruthy();
      }

      if (tts.requiresVoice && !tts.voiceDirectory) {
        expect(tts.defaultVoice).toBeTruthy();
      }
    },
  );

  it("does not offer incomplete OpenAI Realtime models in the picker", () => {
    const openai = RUNTIME_PROVIDER_MANIFEST.openai.llm;
    expect(modelIds(openai.models)).not.toEqual(
      expect.arrayContaining(["gpt-realtime-2.1", "gpt-realtime-2.1-mini"]),
    );
    if (openai.support === "provider") {
      expect(openai.realtimeModelIds).toEqual([
        "gpt-realtime-2.1",
        "gpt-realtime-2.1-mini",
      ]);
    }
  });

  it("does not expose duplicate runtime model ids within a capability", () => {
    for (const provider of RUNTIME_PROVIDER_ORDER as readonly Provider[]) {
      const manifest = RUNTIME_PROVIDER_MANIFEST[provider];

      for (const models of [
        manifest.llm.models,
        manifest.stt.models,
        manifest.tts.models,
      ]) {
        const ids = modelIds(models);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
