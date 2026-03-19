const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const clampSigned = (value: number) => Math.min(1, Math.max(-1, value));

export const VISUAL_LEVEL_COUNT = 24;
export const EMPTY_VISUAL_LEVELS = Array.from(
  { length: VISUAL_LEVEL_COUNT },
  () => 0
);
export const OSCILLOSCOPE_SAMPLE_COUNT = 96;
export const EMPTY_OSCILLOSCOPE_SAMPLES = Array.from(
  { length: OSCILLOSCOPE_SAMPLE_COUNT },
  () => 0
);
export const INPUT_WAVEFORM_REFERENCE_FLOOR = 0.11;

export function normalizeMetering(metering: number) {
  return Math.pow(clamp((metering + 56) / 56), 1.15);
}

export function levelToMetering(level: number) {
  if (level <= 0.0001) {
    return -160;
  }

  return clamp(20 * Math.log10(level), -160, 0);
}

export function averageLevels(levels: number[]) {
  if (!levels.length) {
    return 0;
  }

  return levels.reduce((sum, level) => sum + level, 0) / levels.length;
}

export function averageSampleMagnitude(samples: number[]) {
  if (!samples.length) {
    return 0;
  }

  return (
    samples.reduce((sum, sample) => sum + Math.abs(sample), 0) / samples.length
  );
}

export function peakSampleMagnitude(samples: number[]) {
  if (!samples.length) {
    return 0;
  }

  return samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
}

export function smoothLevels(levels: number[]) {
  return levels.map((level, index) => {
    const previous = levels[index - 1] ?? level;
    const next = levels[index + 1] ?? level;

    return clamp(level * 0.6 + previous * 0.2 + next * 0.2);
  });
}

export function blendLevels(
  previous: number[],
  next: number[],
  smoothing = 0.34
) {
  return next.map((level, index) =>
    clamp((previous[index] ?? 0) * smoothing + level * (1 - smoothing))
  );
}

export function decayLevels(levels: number[], decay = 0.72) {
  return levels.map((level) => {
    const next = level * decay;
    return next < 0.014 ? 0 : next;
  });
}

export function appendMeterHistory(
  previous: number[],
  metering: number,
  count = VISUAL_LEVEL_COUNT
) {
  const seeded = previous.length
    ? previous
    : Array.from({ length: count }, () => 0);
  const next = [...seeded.slice(-(count - 1)), normalizeMetering(metering)];

  return smoothLevels(next);
}

export function buildSampleLevels(
  channels: { frames: number[] }[],
  count = VISUAL_LEVEL_COUNT
) {
  const frameCount = channels[0]?.frames.length ?? 0;

  if (!frameCount) {
    return EMPTY_VISUAL_LEVELS.slice(0, count);
  }

  const chunkSize = Math.max(1, Math.floor(frameCount / count));
  const levels = Array.from({ length: count }, (_, index) => {
    const start = index * chunkSize;
    const end = index === count - 1 ? frameCount : Math.min(frameCount, start + chunkSize);

    let sumSquares = 0;
    let samples = 0;

    for (const channel of channels) {
      for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
        const frame = channel.frames[frameIndex] ?? 0;
        sumSquares += frame * frame;
        samples += 1;
      }
    }

    if (!samples) {
      return 0;
    }

    const rms = Math.sqrt(sumSquares / samples);
    return clamp(Math.pow(rms * 3.1, 0.82));
  });

  return smoothLevels(levels);
}

export function buildSampleWaveform(
  channels: { frames: number[] }[],
  count = OSCILLOSCOPE_SAMPLE_COUNT
) {
  const frameCount = channels[0]?.frames.length ?? 0;

  if (!frameCount) {
    return EMPTY_OSCILLOSCOPE_SAMPLES.slice(0, count);
  }

  const chunkSize = Math.max(1, Math.floor(frameCount / count));

  return Array.from({ length: count }, (_, index) => {
    const start = index * chunkSize;
    const end =
      index === count - 1
        ? frameCount
        : Math.min(frameCount, start + chunkSize);

    let peakSample = 0;

    for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
      let combined = 0;

      for (const channel of channels) {
        combined += channel.frames[frameIndex] ?? 0;
      }

      const sample = combined / Math.max(1, channels.length);

      if (Math.abs(sample) > Math.abs(peakSample)) {
        peakSample = sample;
      }
    }

    return clampSigned(peakSample * 1.55);
  });
}

export function buildFallbackSpeechLevels(
  time: number,
  count = VISUAL_LEVEL_COUNT
) {
  const levels = Array.from({ length: count }, (_, index) => {
    const position = index / Math.max(1, count - 1);
    const focus = 0.72 + (1 - Math.abs(position - 0.5) * 1.7) * 0.28;
    const carrier =
      Math.abs(Math.sin(time * 8.4 + index * 0.38)) * 0.6 +
      Math.abs(Math.sin(time * 5.7 + index * 0.17)) * 0.4;
    const envelope = 0.28 + Math.abs(Math.sin(time * 1.65 + index * 0.08)) * 0.72;

    return clamp(carrier * envelope * focus);
  });

  return smoothLevels(levels);
}

export function resampleLevels(levels: number[], count: number) {
  if (!levels.length) {
    return Array.from({ length: count }, () => 0);
  }

  if (levels.length === count) {
    return levels;
  }

  return Array.from({ length: count }, (_, index) => {
    const position = (index / Math.max(1, count - 1)) * (levels.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(levels.length - 1, leftIndex + 1);
    const blend = position - leftIndex;

    return clamp(
      (levels[leftIndex] ?? 0) * (1 - blend) + (levels[rightIndex] ?? 0) * blend
    );
  });
}

export function blendWaveformSamples(
  previous: number[],
  next: number[],
  smoothing = 0.18
) {
  return next.map((sample, index) =>
    clampSigned(
      (previous[index] ?? 0) * smoothing + sample * (1 - smoothing)
    )
  );
}

export function enhanceInputWaveformSamples(
  samples: number[],
  previousReference = INPUT_WAVEFORM_REFERENCE_FLOOR
) {
  if (!samples.length) {
    return {
      samples: EMPTY_OSCILLOSCOPE_SAMPLES.slice(),
      referenceLevel: Math.max(
        INPUT_WAVEFORM_REFERENCE_FLOOR,
        previousReference * 0.9
      ),
    };
  }

  const peak = peakSampleMagnitude(samples);
  const averageMagnitude = averageSampleMagnitude(samples);
  const isNearSilence = peak < 0.012 && averageMagnitude < 0.004;
  const detectedLevel = isNearSilence
    ? 0
    : Math.max(peak, averageMagnitude * 2.6);
  const nextReferenceLevel = isNearSilence
    ? Math.max(INPUT_WAVEFORM_REFERENCE_FLOOR, previousReference * 0.9)
    : detectedLevel > previousReference
      ? detectedLevel
      : Math.max(
          INPUT_WAVEFORM_REFERENCE_FLOOR,
          previousReference * 0.82 + detectedLevel * 0.18
        );
  const gain = isNearSilence
    ? 1
    : clamp(0.88 / Math.max(INPUT_WAVEFORM_REFERENCE_FLOOR, nextReferenceLevel), 1.8, 12);

  const boostedSamples = samples.map((sample) => {
    const direction = Math.sign(sample);
    const magnitude = Math.abs(sample);

    if (magnitude < 0.0025) {
      return 0;
    }

    const shapedMagnitude = Math.pow(magnitude, 0.88);
    return clampSigned(direction * shapedMagnitude * gain);
  });

  return {
    samples: boostedSamples,
    referenceLevel: nextReferenceLevel,
  };
}

export function resampleWaveformSamples(samples: number[], count: number) {
  if (!samples.length) {
    return Array.from({ length: count }, () => 0);
  }

  if (samples.length === count) {
    return samples.map((sample) => clampSigned(sample));
  }

  return Array.from({ length: count }, (_, index) => {
    const position = (index / Math.max(1, count - 1)) * (samples.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const blend = position - leftIndex;

    return clampSigned(
      (samples[leftIndex] ?? 0) * (1 - blend) +
        (samples[rightIndex] ?? 0) * blend
    );
  });
}

export function getTrailingWaveformWindow(
  samples: number[],
  progress: number,
  count = OSCILLOSCOPE_SAMPLE_COUNT
) {
  if (!samples.length) {
    return EMPTY_OSCILLOSCOPE_SAMPLES.slice(0, count);
  }

  const normalizedProgress = clamp(progress);
  const currentIndex = Math.round(normalizedProgress * (samples.length - 1));
  const slice = samples.slice(Math.max(0, currentIndex - count + 1), currentIndex + 1);

  return [
    ...Array.from({ length: Math.max(0, count - slice.length) }, () => 0),
    ...slice,
  ];
}
