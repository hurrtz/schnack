import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";

interface WaveformCircleProps {
  metering: number;
  isActive: boolean; // recording or playing
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformCircle({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={[
        styles.circle,
        {
          borderColor: isActive ? colors.accent : colors.border,
          backgroundColor: isActive ? colors.accentSoft : "transparent",
        },
      ]}
    >
      <Waveform metering={metering} maxHeight={60} barCount={16} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
