import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { renderHook, act } from "@testing-library/react-native";
import { useSettings } from "../../src/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

async function flushSettingsLoad() {
  await act(async () => {});
}

describe("useSettings", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns default settings when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("loads saved settings from AsyncStorage", async () => {
    const saved = { ...DEFAULT_SETTINGS, lastProvider: "anthropic" as const };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(saved));
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, string | null> = {
        "schnack.provider_key.openai": "sk-openai",
        "schnack.provider_key.anthropic": "sk-anthropic",
        "schnack.provider_key.gemini": "AIza-test",
        "schnack.provider_key.nvidia": "nvapi-test",
      };

      return Promise.resolve(values[key] ?? null);
    });
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();
    expect(result.current.settings.lastProvider).toBe("anthropic");
    expect(result.current.settings.apiKeys).toEqual({
      openai: "sk-openai",
      anthropic: "sk-anthropic",
      gemini: "AIza-test",
      cohere: "",
      deepseek: "",
      groq: "",
      mistral: "",
      nvidia: "nvapi-test",
      together: "",
      xai: "",
    });
  });

  it("migrates legacy ttsPlayback into replyPlayback", async () => {
    const legacyStored: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete legacyStored.replyPlayback;
    legacyStored.ttsPlayback = "wait";
    delete legacyStored.providerTtsVoices;
    legacyStored.ttsVoice = "shimmer";

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(legacyStored)
    );

    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();

    expect(result.current.settings.replyPlayback).toBe("wait");
    expect(result.current.settings.providerTtsVoices.openai).toBe("shimmer");
    expect(result.current.settings.providerTtsVoices.gemini).toBe(
      DEFAULT_SETTINGS.providerTtsVoices.gemini
    );
  });

  it("persists settings on update", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();
    await act(async () => { result.current.updateSettings({ lastProvider: "anthropic" }); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@schnack/settings",
      expect.stringContaining('"lastProvider":"anthropic"')
    );
  });

  it("persists provider model selections", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();

    await act(async () => {
      result.current.updateProviderModel("groq", "openai/gpt-oss-120b");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@schnack/settings",
      expect.stringContaining('"groq":"openai/gpt-oss-120b"')
    );
    expect(result.current.settings.providerModels.groq).toBe("openai/gpt-oss-120b");
  });

  it("persists provider TTS voice selections", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();

    await act(async () => {
      result.current.updateProviderTtsVoice("gemini", "Aoede");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@schnack/settings",
      expect.stringContaining('"gemini":"Aoede"')
    );
    expect(result.current.settings.providerTtsVoices.gemini).toBe("Aoede");
  });

  it("persists provider api keys in SecureStore", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();

    await act(async () => {
      result.current.updateApiKey("gemini", "AIza-live-key");
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "schnack.provider_key.gemini",
      "AIza-live-key"
    );
    expect(result.current.settings.apiKeys.gemini).toBe("AIza-live-key");
  });

  it("removes provider api keys when cleared", async () => {
    const { result } = renderHook(() => useSettings());
    await flushSettingsLoad();

    await act(async () => {
      result.current.updateApiKey("nvidia", "");
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "schnack.provider_key.nvidia"
    );
  });
});
