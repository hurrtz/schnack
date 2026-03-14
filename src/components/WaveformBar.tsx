import React from "react";
import { TouchableOpacity, StyleSheet, GestureResponderEvent, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
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

  const content = (
    <Waveform metering={metering} maxHeight={24} barCount={24} barWidth={2} barGap={1}
      barColor={isActive ? "rgba(255, 255, 255, 0.9)" : undefined} isActive={isActive} />
  );

  const glowShadow = {
    shadowColor: isActive ? colors.glow : "transparent",
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: isActive ? 1 : 0,
    shadowRadius: isActive ? 8 : 0,
    elevation: isActive ? 4 : 0,
  };

  return (
    <TouchableOpacity activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={{ flex: 1 }}>
      {isActive ? (
        <LinearGradient colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.bar, glowShadow]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.bar, glowShadow, { borderColor: colors.border, borderWidth: 2, backgroundColor: colors.surface }]}>
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
