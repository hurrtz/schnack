import React from "react";
import { TouchableOpacity, StyleSheet, GestureResponderEvent } from "react-native";
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

export function WaveformBar({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformBarProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={[
        styles.bar,
        {
          borderColor: isActive ? colors.accent : colors.border,
          backgroundColor: isActive ? colors.accentSoft : colors.surface,
        },
      ]}
    >
      <Waveform
        metering={metering}
        maxHeight={24}
        barCount={24}
        barWidth={2}
        barGap={1}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
