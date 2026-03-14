import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  View,
  Text,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";

interface WaveformBarProps {
  metering: number;
  isActive: boolean;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformBar({ metering, isActive, inputMode, onPressIn, onPressOut, onPress }: WaveformBarProps) {
  const { colors } = useTheme();
  const hint =
    inputMode === "push-to-talk"
      ? isActive
        ? "Listening"
        : "Hold"
      : isActive
        ? "Stop"
        : "Tap";

  const content = (
    <View style={styles.contentRow}>
      <View
        style={[
          styles.stateBadge,
          {
            backgroundColor: isActive
              ? "rgba(255, 255, 255, 0.16)"
              : colors.accentSoft,
            borderColor: isActive ? "rgba(255, 255, 255, 0.18)" : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.stateBadgeText,
            { color: isActive ? "#F6FBFF" : colors.accent },
          ]}
        >
          {hint}
        </Text>
      </View>
      <Waveform
        metering={metering}
        maxHeight={26}
        barCount={28}
        barWidth={2}
        barGap={1}
        barColor={isActive ? "rgba(255, 255, 255, 0.95)" : colors.accent}
        barColorInactive={isActive ? "rgba(255, 255, 255, 0.55)" : colors.textMuted}
        isActive={isActive}
      />
    </View>
  );

  const glowShadow = {
    shadowColor: isActive ? colors.glow : "transparent",
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: isActive ? 1 : 0,
    shadowRadius: isActive ? 8 : 0,
    elevation: isActive ? 4 : 0,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={{ flex: 1 }}
    >
      {isActive ? (
        <LinearGradient
          colors={[
            colors.accentGradientStart,
            colors.accentGradientEnd,
            colors.accentGradientEnd,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bar, glowShadow]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bar,
            glowShadow,
            {
              borderColor: colors.border,
              borderWidth: 1,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stateBadge: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  stateBadgeText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
});
