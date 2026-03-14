import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";

interface WaveformProps {
  metering: number; // -160 to 0
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
  // Normalize metering from [-160, 0] to [0, 1]
  const normalized = Math.max(0, (metering + 160) / 160);

  const bars = Array.from({ length: barCount }, (_, i) => {
    // Create variation per bar using simple deterministic pattern
    const variation = Math.sin(i * 0.7 + Date.now() * 0.001) * 0.3 + 0.7;
    const height = Math.max(
      4,
      normalized * maxHeight * variation
    );
    return height;
  });

  return (
    <View
      style={[
        styles.container,
        horizontal ? styles.horizontal : styles.vertical,
      ]}
    >
      {bars.map((height, i) => (
        <AnimatedBar
          key={i}
          height={height}
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
  width,
  color,
  gap,
}: {
  height: number;
  width: number;
  color: string;
  gap: number;
}) {
  const style = useAnimatedStyle(() => ({
    height: withSpring(height, { damping: 15, stiffness: 200 }),
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
