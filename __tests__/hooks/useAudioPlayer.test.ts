import { act, renderHook } from "@testing-library/react-native";
import {
  clearSpeechDiagnostics,
  getSpeechDiagnostics,
} from "../../src/services/speech/diagnostics";

const mockPlayer = {
  id: "player-1",
  currentTime: 0,
  isAudioSamplingSupported: false,
  pause: jest.fn(),
  remove: jest.fn(),
  replace: jest.fn(),
  play: jest.fn(),
};

let mockStatus: any;

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioSampleListener: jest.fn(),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

import { useAudioPlayer } from "../../src/hooks/useAudioPlayer";

describe("useAudioPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSpeechDiagnostics();
    mockStatus = {
      id: "player-1",
      currentTime: 0,
      playbackState: "idle",
      timeControlStatus: "paused",
      reasonForWaitingToPlay: "",
      mute: false,
      duration: 0,
      playing: false,
      loop: false,
      didJustFinish: false,
      isBuffering: false,
      isLoaded: true,
      playbackRate: 1,
      shouldCorrectPitch: true,
    };
  });

  it("advances queued clips when playback becomes idle", async () => {
    const { result, rerender } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.enqueueAudio("first.mp3");
      await Promise.resolve();
    });

    expect(mockPlayer.replace).toHaveBeenNthCalledWith(1, "first.mp3");
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockStatus = {
        ...mockStatus,
        playing: true,
        playbackState: "playing",
        timeControlStatus: "playing",
      };
      rerender(undefined);
      await Promise.resolve();
    });

    await act(async () => {
      result.current.enqueueAudio("second.mp3");
      await Promise.resolve();
    });

    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockStatus = {
        ...mockStatus,
        playing: false,
        playbackState: "idle",
        timeControlStatus: "paused",
      };
      rerender(undefined);
      await Promise.resolve();
    });

    expect(mockPlayer.replace).toHaveBeenNthCalledWith(2, "second.mp3");
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it("keeps request diagnostics attached to playback events", async () => {
    const { result, rerender } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.enqueueAudio("preview.wav", {
        requestId: "preview-1",
        source: "preview",
      });
      await Promise.resolve();
    });

    await act(async () => {
      mockStatus = {
        ...mockStatus,
        playing: true,
        playbackState: "playing",
        timeControlStatus: "playing",
      };
      rerender(undefined);
      await Promise.resolve();
    });

    await act(async () => {
      mockStatus = {
        ...mockStatus,
        playing: false,
        playbackState: "idle",
        timeControlStatus: "paused",
      };
      rerender(undefined);
      await Promise.resolve();
    });

    const diagnostics = getSpeechDiagnostics().filter(
      (event) => event.requestId === "preview-1",
    );

    expect(diagnostics.map((event) => event.stage)).toEqual([
      "playback-finished",
      "playback-started",
      "playback-enqueued",
    ]);
    expect(diagnostics.every((event) => event.source === "preview")).toBe(true);
  });
});
