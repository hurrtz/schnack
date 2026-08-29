import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { RUNTIME_PROVIDER_IDS } from "../../src/constants/providers/runtimeState";
import { mergeSettings } from "../../src/hooks/settings/mergeStoredSettings";
import {
  loadStoredApiKeys,
  loadStoredSettingsSnapshot,
  persistNormalizedPublicSettings,
} from "../../src/hooks/settings/storage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

describe("settings storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("limits concurrent SecureStore reads while loading every provider key", async () => {
    let activeReads = 0;
    let maximumConcurrentReads = 0;

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        activeReads += 1;
        maximumConcurrentReads = Math.max(
          maximumConcurrentReads,
          activeReads,
        );
        await Promise.resolve();
        activeReads -= 1;
        return key.endsWith(".xai") ? " xai-key " : null;
      },
    );

    const apiKeys = await loadStoredApiKeys();

    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(
      RUNTIME_PROVIDER_IDS.length,
    );
    expect(maximumConcurrentReads).toBe(3);
    expect(apiKeys.xai).toBe("xai-key");
  });

  it("keeps successfully loaded keys when one SecureStore read fails", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key.endsWith(".anthropic")) {
          throw new Error("Keychain unavailable");
        }

        if (key.endsWith(".openai")) {
          return "openai-key";
        }

        if (key.endsWith(".xai")) {
          return "xai-key";
        }

        return null;
      },
    );

    await expect(loadStoredApiKeys()).resolves.toEqual(
      expect.objectContaining({
        anthropic: "",
        openai: "openai-key",
        xai: "xai-key",
      }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[settings-storage] failed to load API key for anthropic",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it("persists the legacy Grok key under xAI after loading it", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) =>
        key === "mrbroccoli.provider_key.grok" ? " legacy-xai-key " : null,
    );

    const apiKeys = await loadStoredApiKeys();

    expect(apiKeys.xai).toBe("legacy-xai-key");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "mrbroccoli.provider_key.xai",
      "legacy-xai-key",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "mrbroccoli.provider_key.grok",
    );
  });

  it("hydrates SecureStore keys when public settings JSON is corrupt without rewriting it", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("{not-json");
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => (key.endsWith(".openai") ? "openai-key" : null),
    );

    const snapshot = await loadStoredSettingsSnapshot();

    expect(snapshot.storedSettings).toBeUndefined();
    expect(snapshot.publicSettingsCorrupt).toBe(true);
    expect(snapshot.apiKeys.openai).toBe("openai-key");

    const normalized = mergeSettings(snapshot.storedSettings, snapshot.apiKeys);
    expect(normalized.apiKeys.openai).toBe("openai-key");

    await persistNormalizedPublicSettings(snapshot.storedSettings, normalized);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[settings-storage] failed to parse stored settings",
      expect.any(SyntaxError),
    );

    consoleError.mockRestore();
  });
});
