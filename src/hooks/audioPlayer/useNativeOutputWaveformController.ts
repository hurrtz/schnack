import { Dispatch, MutableRefObject, SetStateAction, useCallback, useRef } from "react";

import {
  analyzeNativeAudioFile,
  type NativeWaveformAnalysis,
  startNativeOutputWaveformPlayback,
  stopNativeOutputWaveformPlayback,
} from "../../services/nativeWaveform";
import { WaveformVisualizationVariant } from "../../types";
import {
  OSCILLOSCOPE_SAMPLE_COUNT,
  averageLevels,
  averageSampleMagnitude,
  buildFallbackSpeechLevels,
  getTrailingWaveformWindow,
  levelToMetering,
} from "../../utils/audioVisualization";
import { logWaveformDebug } from "../../utils/waveformDebug";

import {
  OSCILLOSCOPE_TICK_INTERVAL_MS,
  VISUAL_UPDATE_INTERVAL_MS,
} from "./shared";
import { type NativeAudioQueueContext } from "./types";

interface UseNativeOutputWaveformControllerParams {
  nativeAudioQueueContextsRef: MutableRefObject<
    Map<string, NativeAudioQueueContext>
  >;
  nativeAudioQueuePendingCountRef: MutableRefObject<number>;
  nativeAudioQueuePlayingRef: MutableRefObject<boolean>;
  setMeteringData: Dispatch<SetStateAction<number>>;
  setNativeAudioQueuePlaying: Dispatch<SetStateAction<boolean>>;
  setWaveformData: Dispatch<SetStateAction<number[]>>;
  setWaveformVariant: Dispatch<SetStateAction<WaveformVisualizationVariant>>;
  supportsNativeOutputWaveform: boolean;
  usingNativeAudioQueue: boolean;
}

export function useNativeOutputWaveformController({
  nativeAudioQueueContextsRef,
  nativeAudioQueuePendingCountRef,
  nativeAudioQueuePlayingRef,
  setMeteringData,
  setNativeAudioQueuePlaying,
  setWaveformData,
  setWaveformVariant,
  supportsNativeOutputWaveform,
  usingNativeAudioQueue,
}: UseNativeOutputWaveformControllerParams) {
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeOutputWaveformIntervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeOutputWaveformItemIdRef = useRef<string | null>(null);
  const nativeOutputWaveformStartedAtRef = useRef<number | null>(null);
  const waveformAnalysisCacheRef = useRef<
    Map<string, Promise<NativeWaveformAnalysis | null>>
  >(new Map());

  const stopNativeMetering = useCallback(() => {
    if (nativeIntervalRef.current) {
      clearInterval(nativeIntervalRef.current);
      nativeIntervalRef.current = null;
    }
  }, []);

  const stopNativeOutputWaveform = useCallback(() => {
    if (usingNativeAudioQueue) {
      logWaveformDebug("output-waveform-stop-requested", {
        itemId: nativeOutputWaveformItemIdRef.current ?? null,
        usingNativeAudioQueue,
        supportsNativeOutputWaveform,
      });
      void stopNativeOutputWaveformPlayback(
        nativeOutputWaveformItemIdRef.current ?? null,
      );
    }

    if (nativeOutputWaveformIntervalRef.current) {
      clearInterval(nativeOutputWaveformIntervalRef.current);
      nativeOutputWaveformIntervalRef.current = null;
    }

    nativeOutputWaveformItemIdRef.current = null;
    nativeOutputWaveformStartedAtRef.current = null;
    setWaveformVariant("bars");
  }, [setWaveformVariant, supportsNativeOutputWaveform, usingNativeAudioQueue]);

  const clearNativeAudioQueueState = useCallback(() => {
    nativeAudioQueueContextsRef.current.clear();
    nativeAudioQueuePendingCountRef.current = 0;
    nativeAudioQueuePlayingRef.current = false;
    waveformAnalysisCacheRef.current.clear();
    setNativeAudioQueuePlaying(false);
    stopNativeOutputWaveform();
  }, [
    nativeAudioQueueContextsRef,
    nativeAudioQueuePendingCountRef,
    nativeAudioQueuePlayingRef,
    setNativeAudioQueuePlaying,
    stopNativeOutputWaveform,
  ]);

  const startNativeMetering = useCallback(() => {
    stopNativeMetering();
    setWaveformVariant("bars");

    const baseTime = Date.now() / 1000;
    nativeIntervalRef.current = setInterval(() => {
      const levels = buildFallbackSpeechLevels(baseTime + Date.now() / 700);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, VISUAL_UPDATE_INTERVAL_MS);
  }, [
    setMeteringData,
    setWaveformData,
    setWaveformVariant,
    stopNativeMetering,
  ]);

  const getWaveformAnalysis = useCallback((uri: string) => {
    const cached = waveformAnalysisCacheRef.current.get(uri);
    if (cached) {
      return cached;
    }

    const next = analyzeNativeAudioFile({
      uri,
      sampleCount: 960,
    }).catch(() => null);

    waveformAnalysisCacheRef.current.set(uri, next);
    return next;
  }, []);

  const startNativeOutputWaveform = useCallback(
    (itemId: string, analysis: NativeWaveformAnalysis) => {
      if (!analysis.samples.length || analysis.durationMs <= 0) {
        logWaveformDebug("output-waveform-skipped", {
          itemId,
          reason: "empty-analysis",
          durationMs: analysis.durationMs,
          sampleCount: analysis.samples.length,
        });
        return;
      }

      logWaveformDebug("output-waveform-primed", {
        itemId,
        durationMs: analysis.durationMs,
        sampleCount: analysis.samples.length,
        usingNativeAudioQueue,
        supportsNativeOutputWaveform,
      });
      stopNativeOutputWaveform();
      nativeOutputWaveformItemIdRef.current = itemId;
      nativeOutputWaveformStartedAtRef.current = Date.now();
      setWaveformVariant("oscilloscope");
      void startNativeOutputWaveformPlayback({
        itemId,
        samples: analysis.samples,
        durationMs: analysis.durationMs,
      });

      const tick = () => {
        if (nativeOutputWaveformItemIdRef.current !== itemId) {
          return;
        }

        const startedAt = nativeOutputWaveformStartedAtRef.current ?? Date.now();
        const progress = Math.min(
          1,
          Math.max(0, (Date.now() - startedAt) / Math.max(1, analysis.durationMs)),
        );
        const samples = getTrailingWaveformWindow(
          analysis.samples,
          progress,
          OSCILLOSCOPE_SAMPLE_COUNT,
        );

        setWaveformData(samples);
        setMeteringData(levelToMetering(averageSampleMagnitude(samples)));
      };

      tick();
      nativeOutputWaveformIntervalRef.current = setInterval(
        tick,
        OSCILLOSCOPE_TICK_INTERVAL_MS,
      );
    },
    [
      getWaveformAnalysis,
      setMeteringData,
      setWaveformData,
      setWaveformVariant,
      stopNativeOutputWaveform,
      supportsNativeOutputWaveform,
      usingNativeAudioQueue,
    ],
  );

  return {
    clearNativeAudioQueueState,
    getWaveformAnalysis,
    nativeOutputWaveformItemIdRef,
    nativeOutputWaveformStartedAtRef,
    startNativeMetering,
    startNativeOutputWaveform,
    stopNativeMetering,
    stopNativeOutputWaveform,
  };
}
