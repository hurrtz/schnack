import React from "react";
import { View, StyleSheet, PixelRatio } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import {
  normalizeMetering,
  resampleLevels,
  resampleWaveformSamples,
} from "../utils/audioVisualization";
import { WaveformVisualizationVariant } from "../types";

type WaveformPoint = {
  x: number;
  y: number;
};

const PIXEL_RATIO = PixelRatio.get() || 1;

function snapToPixel(value: number) {
  return Math.round(value * PIXEL_RATIO) / PIXEL_RATIO;
}

function formatSvgNumber(value: number) {
  return value.toFixed(2);
}

function smoothOscilloscopeSamples(samples: number[]) {
  if (samples.length <= 2) {
    return samples;
  }

  const once = samples.map((sample, index) => {
    const previous = samples[index - 1] ?? sample;
    const next = samples[index + 1] ?? sample;

    return previous * 0.18 + sample * 0.64 + next * 0.18;
  });

  return once.map((sample, index) => {
    const previous = once[index - 1] ?? sample;
    const next = once[index + 1] ?? sample;

    return previous * 0.12 + sample * 0.76 + next * 0.12;
  });
}

function buildOscilloscopePath(points: WaveformPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`;
  }

  let path = `M ${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;

    path += ` Q ${formatSvgNumber(current.x)} ${formatSvgNumber(
      current.y
    )} ${formatSvgNumber(controlX)} ${formatSvgNumber(controlY)}`;
  }

  const penultimatePoint = points[points.length - 2];
  const lastPoint = points[points.length - 1];

  path += ` Q ${formatSvgNumber(penultimatePoint.x)} ${formatSvgNumber(
    penultimatePoint.y
  )} ${formatSvgNumber(lastPoint.x)} ${formatSvgNumber(lastPoint.y)}`;

  return path;
}

interface WaveformProps {
  metering: number; // -160 to 0
  levels?: number[];
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  maxHeight: number;
  horizontal?: boolean;
  barColor?: string;
  barColorInactive?: string;
  isActive?: boolean;
  variant?: WaveformVisualizationVariant;
}

export function Waveform({
  metering,
  levels,
  barCount = 20,
  barWidth = 3,
  barGap = 2,
  maxHeight,
  horizontal = false,
  barColor,
  barColorInactive,
  isActive = true,
  variant = "bars",
}: WaveformProps) {
  const { colors } = useTheme();
  const normalized = normalizeMetering(metering);
  const resolvedLevels = levels?.length
    ? variant === "oscilloscope"
      ? resampleWaveformSamples(levels, barCount)
      : resampleLevels(levels, barCount)
    : Array.from({ length: barCount }, (_, index) => {
        const midpoint = Math.max(1, (barCount - 1) / 2);
        const distance = Math.abs(index - midpoint) / midpoint;
        const focus = 1 - distance * 0.42;

        return Math.min(1, normalized * focus);
      });

  const resolvedColor = barColor
    ? isActive
      ? barColor
      : barColorInactive || barColor
    : colors.accent;

  if (variant === "oscilloscope") {
    const width = barCount * barWidth + Math.max(0, barCount - 1) * barGap;
    const midY = maxHeight / 2;
    const amplitude = Math.max(6, maxHeight * 0.42);
    const displayLevels = smoothOscilloscopeSamples(resolvedLevels);
    const points = displayLevels.map((sample, index) => ({
      x: snapToPixel(index * (barWidth + barGap) + barWidth / 2),
      y: snapToPixel(midY - sample * amplitude),
    }));
    const path = buildOscilloscopePath(points);

    return (
      <View
        style={[
          styles.container,
          styles.oscilloscopeContainer,
          { width, height: maxHeight },
        ]}
      >
        <Svg width={width} height={maxHeight}>
          <Line
            x1={0}
            y1={midY}
            x2={width}
            y2={midY}
            stroke={isActive ? "rgba(255, 255, 255, 0.12)" : colors.borderStrong}
            strokeWidth={1}
          />
          <Path
            d={path}
            fill="none"
            stroke={resolvedColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={Math.max(3.8, barWidth * 2.5)}
            opacity={isActive ? 0.14 : 0.08}
          />
          <Path
            d={path}
            fill="none"
            stroke={resolvedColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={Math.max(2.25, barWidth * 1.55)}
            opacity={isActive ? 0.98 : 0.64}
          />
        </Svg>
      </View>
    );
  }

  const bars = resolvedLevels.map((level, index) => {
    const midpoint = Math.max(1, (barCount - 1) / 2);
    const distance = Math.abs(index - midpoint) / midpoint;
    const focus = 0.78 + (1 - distance) * 0.22;
    const restingLevel = isActive ? 0.02 : 0.08;
    const shapedLevel = restingLevel + level * (isActive ? 0.98 : 0.34);

    return {
      height: Math.max(3, shapedLevel * maxHeight * focus),
      opacity: isActive ? 0.5 + level * 0.5 : 0.24 + level * 0.36,
    };
  });

  return (
    <View
      style={[
        styles.container,
        horizontal ? styles.horizontal : styles.vertical,
      ]}
    >
      {bars.map((bar, i) => (
        <AnimatedBar
          key={i}
          height={bar.height}
          opacity={bar.opacity}
          width={barWidth}
          color={resolvedColor}
          gap={barGap}
        />
      ))}
    </View>
  );
}

function AnimatedBar({
  height,
  opacity,
  width,
  color,
  gap,
}: {
  height: number;
  opacity: number;
  width: number;
  color: string;
  gap: number;
}) {
  const style = useAnimatedStyle(() => ({
    height: withSpring(height, { damping: 15, stiffness: 200 }),
    opacity: withTiming(opacity, { duration: 140 }),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          backgroundColor: color,
          borderRadius: width / 2,
          marginHorizontal: gap / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  vertical: {
    flexDirection: "row",
  },
  horizontal: {
    flexDirection: "row",
  },
  oscilloscopeContainer: {
    overflow: "hidden",
  },
});
