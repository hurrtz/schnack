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
import { InputMode, VoiceVisualPhase } from "../types";

interface WaveformBarProps {
  metering: number;
  levels?: number[];
  isActive: boolean;
  phase: VoiceVisualPhase;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformBar({
  metering,
  levels,
  isActive,
  phase,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformBarProps) {
  const { colors } = useTheme();
  const isProcessing = phase === "transcribing" || phase === "thinking";
  const hint =
    phase === "recording"
      ? "Listening"
      : phase === "transcribing"
        ? "Parsing"
        : phase === "thinking"
          ? "Thinking"
          : phase === "speaking"
            ? "Speaking"
            : inputMode === "push-to-talk"
              ? "Hold"
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
      {isProcessing ? (
        <Text
          style={[
            styles.processingText,
            { color: isActive ? "#F6FBFF" : colors.textSecondary },
          ]}
        >
          {phase === "thinking" ? "Waiting on model" : "Converting speech"}
        </Text>
      ) : (
        <View style={styles.waveformWrap}>
          <Waveform
            metering={metering}
            levels={levels}
            maxHeight={26}
            barCount={28}
            barWidth={2}
            barGap={1}
            barColor={isActive ? "rgba(255, 255, 255, 0.95)" : colors.accent}
            barColorInactive={
              isActive ? "rgba(255, 255, 255, 0.55)" : colors.textMuted
            }
            isActive={isActive}
          />
        </View>
      )}
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
      style={styles.touchable}
    >
      {isActive ? (
        <LinearGradient
          colors={
            isProcessing
              ? [colors.accentWarm, colors.accentGradientStart, colors.accentGradientEnd]
              : [
                  colors.accentGradientStart,
                  colors.accentGradientEnd,
                  colors.accentGradientEnd,
                ]
          }
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
  touchable: {
    width: "100%",
  },
  bar: {
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
  waveformWrap: {
    flex: 1,
    minHeight: 28,
    justifyContent: "center",
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
  processingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
});
