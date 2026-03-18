import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useLocalTtsPacks } from "../../src/hooks/useLocalTtsPacks";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("../../src/services/localTts", () => ({
  installLocalTtsPack: jest.fn(),
  getLocalTtsInstallStatus: jest.fn(),
}));

const { installLocalTtsPack, getLocalTtsInstallStatus } = jest.requireMock(
  "../../src/services/localTts",
) as {
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

  it("keeps a downloaded pack available when verification fails", async () => {
    getLocalTtsInstallStatus
      .mockResolvedValueOnce({
        supported: true,
        downloaded: false,
        verified: false,
        installed: false,
        verificationError: null,
      })
      .mockResolvedValueOnce({
        supported: true,
        downloaded: true,
        verified: false,
        installed: true,
        verificationError: "The local voice pack failed verification.",
      })
      .mockResolvedValueOnce({
        supported: true,
        downloaded: true,
        verified: false,
        installed: true,
        verificationError: "The local voice pack failed verification.",
      });
    installLocalTtsPack.mockImplementation(
      async ({ onProgress }: { onProgress?: (progress: number) => void }) => {
        onProgress?.(1);
      },
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

    expect(installError).toBeNull();
    await waitFor(() => {
      expect(result.current.packStates.en).toEqual({
        supported: true,
        downloaded: true,
        verified: false,
        installed: true,
        downloading: false,
        progress: 0,
        error: "The local voice pack failed verification.",
      });
    });
  });

  it("marks the pack as installed after a verified download", async () => {
    getLocalTtsInstallStatus
      .mockResolvedValueOnce({
        supported: true,
        downloaded: false,
        verified: false,
        installed: false,
        verificationError: null,
      })
      .mockResolvedValueOnce({
        supported: true,
        downloaded: true,
        verified: true,
        installed: true,
        verificationError: null,
      })
      .mockResolvedValueOnce({
        supported: true,
        downloaded: true,
        verified: true,
        installed: true,
        verificationError: null,
      });
    installLocalTtsPack.mockImplementation(
      async ({ onProgress }: { onProgress?: (progress: number) => void }) => {
        onProgress?.(1);
      },
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
        downloaded: true,
        verified: true,
        installed: true,
        downloading: false,
        progress: 0,
        error: null,
      });
    });
  });

  it("surfaces a downloaded but broken pack as downloaded but unverified", async () => {
    getLocalTtsInstallStatus.mockResolvedValue({
      supported: true,
      downloaded: true,
      verified: false,
      installed: true,
      verificationError: "The local voice pack failed verification.",
    });

    const { result } = renderHook(() => useLocalTtsPacks(settings));

    await waitFor(() => {
      expect(result.current.packStates.en).toEqual({
        supported: true,
        downloaded: true,
        verified: false,
        installed: true,
        downloading: false,
        progress: 0,
        error: "The local voice pack failed verification.",
      });
    });
  });
});
