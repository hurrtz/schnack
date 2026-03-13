import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act } from "@testing-library/react-native";
import { useSettings } from "../../src/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe("useSettings", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns default settings when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("loads saved settings from AsyncStorage", async () => {
    const saved = { ...DEFAULT_SETTINGS, lastProvider: "anthropic" as const };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(saved));
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.settings.lastProvider).toBe("anthropic");
  });

  it("persists settings on update", async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => { result.current.updateSettings({ lastProvider: "anthropic" }); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("@voxai/settings", expect.stringContaining('"lastProvider":"anthropic"'));
  });
});
