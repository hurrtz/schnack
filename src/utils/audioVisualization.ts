const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const VISUAL_LEVEL_COUNT = 24;
export const EMPTY_VISUAL_LEVELS = Array.from(
  { length: VISUAL_LEVEL_COUNT },
  () => 0
);

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
