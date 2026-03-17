import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useLocalTtsPacks } from "../../src/hooks/useLocalTtsPacks";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("../../src/services/localTts", () => ({
  installLocalTtsPack: jest.fn(),
  getLocalTtsInstallStatus: jest.fn(),
}));

const {
  installLocalTtsPack,
  getLocalTtsInstallStatus,
} = jest.requireMock("../../src/services/localTts") as {
  installLocalTtsPack: jest.Mock;
  getLocalTtsInstallStatus: jest.Mock;
};

describe("useLocalTtsPacks", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    ttsListenLanguages: ["en"] as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears the downloading state when install verification fails", async () => {
    getLocalTtsInstallStatus.mockResolvedValue({
      supported: true,
      installed: false,
    });
    installLocalTtsPack.mockImplementation(
      async ({ onProgress }: { onProgress?: (progress: number) => void }) => {
        onProgress?.(1);
      }
    );

    const { result } = renderHook(() => useLocalTtsPacks(settings));

    await waitFor(() => {
      expect(result.current.packStates.en?.installed).toBe(false);
    });

    let installError: Error | null = null;
    await act(async () => {
      try {
        await result.current.installLanguagePack("en");
      } catch (error) {
        installError = error as Error;
      }
    });

    expect(installError?.message).toContain("could not be verified");
    await waitFor(() => {
      expect(result.current.packStates.en).toEqual({
        supported: true,
        installed: false,
        downloading: false,
        progress: 0,
      });
    });
  });

  it("marks the pack as installed after a verified download", async () => {
    getLocalTtsInstallStatus
      .mockResolvedValueOnce({
        supported: true,
        installed: false,
      })
      .mockResolvedValueOnce({
        supported: true,
        installed: true,
      })
      .mockResolvedValueOnce({
        supported: true,
        installed: true,
      });
    installLocalTtsPack.mockImplementation(
      async ({ onProgress }: { onProgress?: (progress: number) => void }) => {
        onProgress?.(1);
      }
    );

    const { result } = renderHook(() => useLocalTtsPacks(settings));

    await waitFor(() => {
      expect(result.current.packStates.en?.installed).toBe(false);
    });

    await act(async () => {
      await result.current.installLanguagePack("en");
    });

    await waitFor(() => {
      expect(result.current.packStates.en).toEqual({
        supported: true,
        installed: true,
        downloading: false,
        progress: 0,
      });
    });
  });
});
