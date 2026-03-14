import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import { normalizeMetering, resampleLevels } from "../utils/audioVisualization";

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
}: WaveformProps) {
  const { colors } = useTheme();
  const normalized = normalizeMetering(metering);
  const resolvedLevels = levels?.length
    ? resampleLevels(levels, barCount)
    : Array.from({ length: barCount }, (_, index) => {
        const midpoint = Math.max(1, (barCount - 1) / 2);
        const distance = Math.abs(index - midpoint) / midpoint;
        const focus = 1 - distance * 0.42;

        return Math.min(1, normalized * focus);
      });

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
          color={barColor ? (isActive ? barColor : (barColorInactive || barColor)) : colors.accent}
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
});
