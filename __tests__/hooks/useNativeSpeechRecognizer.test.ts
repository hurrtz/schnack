import React from "react";
import { act, renderHook } from "@testing-library/react-native";

import { LocalizationProvider } from "../../src/i18n";
import { useNativeSpeechRecognizer } from "../../src/hooks/useNativeSpeechRecognizer";
import {
  cancelNativeWaveformRecording,
  isNativeWaveformAvailable,
  startNativeWaveformRecording,
  stopNativeWaveformRecording,
  subscribeToNativeWaveform,
} from "../../src/services/nativeWaveform";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

const speechListeners = new Map<string, Set<(event: any) => void>>();
const nativeWaveformListeners = new Set<(event: any) => void>();

function emitSpeechEvent(event: string, payload: any) {
  speechListeners.get(event)?.forEach((listener) => listener(payload));
}

function emitNativeWaveformEvent(event: any) {
  nativeWaveformListeners.forEach((listener) => listener(event));
}

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    addListener: jest.fn(),
    isRecognitionAvailable: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));

jest.mock("../../src/services/nativeWaveform", () => ({
  cancelNativeWaveformRecording: jest.fn(),
  isNativeWaveformAvailable: jest.fn(),
  startNativeWaveformRecording: jest.fn(),
  stopNativeWaveformRecording: jest.fn(),
  subscribeToNativeWaveform: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LocalizationProvider, { language: "en" }, children);

describe("useNativeSpeechRecognizer", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    speechListeners.clear();
    nativeWaveformListeners.clear();
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000);
    (ExpoSpeechRecognitionModule.addListener as jest.Mock).mockImplementation(
      (event: string, listener: (payload: any) => void) => {
        const listeners = speechListeners.get(event) ?? new Set();
        listeners.add(listener);
        speechListeners.set(event, listeners);
        return {
          remove: () => {
            listeners.delete(listener);
          },
        };
      },
    );
    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(
      true,
    );
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue(
      { granted: true },
    );
    (ExpoSpeechRecognitionModule.start as jest.Mock).mockImplementation(() => undefined);
    (ExpoSpeechRecognitionModule.stop as jest.Mock).mockImplementation(() => undefined);
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockImplementation(() => undefined);
    (isNativeWaveformAvailable as jest.Mock).mockReturnValue(true);
    (startNativeWaveformRecording as jest.Mock).mockResolvedValue({
      uri: "file://capture.wav",
    });
    (stopNativeWaveformRecording as jest.Mock).mockResolvedValue({
      uri: "file://capture.wav",
    });
    (cancelNativeWaveformRecording as jest.Mock).mockResolvedValue(true);
    (subscribeToNativeWaveform as jest.Mock).mockImplementation(
      (listener: (event: any) => void) => {
        nativeWaveformListeners.add(listener);
        return () => {
          nativeWaveformListeners.delete(listener);
        };
      },
    );
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it("starts native waveform recording on iOS", async () => {
    const { result } = renderHook(() => useNativeSpeechRecognizer(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startRecognition();
    });

    expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalled();
    expect(startNativeWaveformRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^native-stt-/),
      }),
    );
    expect(result.current.isRecording).toBe(true);
    expect(result.current.waveformVariant).toBe("oscilloscope");
  });

  it("aborts an active native recording session", async () => {
    const { result } = renderHook(() => useNativeSpeechRecognizer(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startRecognition();
    });

    const sessionId =
      (startNativeWaveformRecording as jest.Mock).mock.calls[0][0].sessionId;

    await act(async () => {
      await result.current.abortRecognition();
    });

    expect(cancelNativeWaveformRecording).toHaveBeenCalledWith(
      sessionId,
    );
    expect(result.current.isRecording).toBe(false);
  });

  it("stops native recording and returns the recorded transcript", async () => {
    const { result } = renderHook(() => useNativeSpeechRecognizer(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startRecognition();
    });

    dateNowSpy.mockReturnValue(2_000);

    let transcriptPromise: Promise<string | null>;
    await act(async () => {
      transcriptPromise = result.current.stopRecognition();
      await Promise.resolve();
      await Promise.resolve();
      emitSpeechEvent("result", {
        results: [{ transcript: "Hello native world" }],
        isFinal: true,
      });
      emitSpeechEvent("end", {});
    });

    await expect(transcriptPromise!).resolves.toBe("Hello native world");
    expect(stopNativeWaveformRecording).toHaveBeenCalledWith(
      (startNativeWaveformRecording as jest.Mock).mock.calls[0][0].sessionId,
    );
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        audioSource: {
          uri: "file://capture.wav",
        },
      }),
    );
    expect(result.current.isRecording).toBe(false);
  });

  it("surfaces native waveform recorder errors and resets recording state", async () => {
    const { result } = renderHook(() => useNativeSpeechRecognizer(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startRecognition();
    });

    const sessionId =
      (startNativeWaveformRecording as jest.Mock).mock.calls[0][0].sessionId;

    await act(async () => {
      emitNativeWaveformEvent({
        type: "error",
        sessionId,
        message: "Recorder write failed",
      });
    });

    expect(cancelNativeWaveformRecording).toHaveBeenCalledWith(
      sessionId,
    );
    expect(result.current.lastError).toBe("Recorder write failed");
    expect(result.current.isRecording).toBe(false);
  });
});
