import { type MutableRefObject, useCallback, useEffect, useState } from "react";
import {
  useAudioSampleListener,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { WaveformVisualizationVariant } from "../../types";
import {
  EMPTY_VISUAL_LEVELS,
  averageLevels,
  averageSampleMagnitude,
  blendWaveformSamples,
  buildFallbackSpeechLevels,
  buildSampleWaveform,
  levelToMetering,
} from "../../utils/audioVisualization";
import {
  VISUAL_UPDATE_INTERVAL_MS,
} from "./shared";

export function usePlaybackVisualState(params: {
  player: AudioPlayer;
  status: AudioStatus;
  nativeSpeaking: boolean;
  nativeSpeakingRef: MutableRefObject<boolean>;
  nativeAudioQueuePlaying: boolean;
  usingNativeAudioQueue: boolean;
}) {
  const {
    player,
    status,
    nativeSpeaking,
    nativeSpeakingRef,
    nativeAudioQueuePlaying,
    usingNativeAudioQueue,
  } = params;
  const [meteringData, setMeteringData] = useState(-160);
  const [waveformData, setWaveformData] = useState(EMPTY_VISUAL_LEVELS);
  const [waveformVariant, setWaveformVariant] =
    useState<WaveformVisualizationVariant>("bars");

  const resetVisualState = useCallback(() => {
    setMeteringData(-160);
    setWaveformData(EMPTY_VISUAL_LEVELS);
    setWaveformVariant("bars");
  }, []);

  useAudioSampleListener(player, (sample) => {
    if (usingNativeAudioQueue || nativeSpeakingRef.current) {
      return;
    }

    const samples = buildSampleWaveform(sample.channels);

    setWaveformVariant("oscilloscope");
    setWaveformData((previous) => blendWaveformSamples(previous, samples, 0.16));
    setMeteringData(levelToMetering(averageSampleMagnitude(samples)));
  });

  useEffect(() => {
    const clipPlaybackActive = usingNativeAudioQueue
      ? nativeAudioQueuePlaying
      : status.playing;

    if (nativeSpeaking) {
      return;
    }

    if (!clipPlaybackActive) {
      resetVisualState();
      return;
    }

    if (
      (!usingNativeAudioQueue && player.isAudioSamplingSupported) ||
      (usingNativeAudioQueue && waveformVariant === "oscilloscope")
    ) {
      return;
    }

    setWaveformVariant("bars");
    const baseTime = player.currentTime;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const levels = buildFallbackSpeechLevels(baseTime + elapsed);
      setWaveformData(levels);
      setMeteringData(levelToMetering(averageLevels(levels)));
    }, VISUAL_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [
    nativeSpeaking,
    nativeAudioQueuePlaying,
    player.currentTime,
    player.id,
    player.isAudioSamplingSupported,
    resetVisualState,
    status.playing,
    usingNativeAudioQueue,
    waveformVariant,
  ]);

  return {
    meteringData,
    resetVisualState,
    setMeteringData,
    setWaveformData,
    setWaveformVariant,
    waveformData,
    waveformVariant,
  };
}
