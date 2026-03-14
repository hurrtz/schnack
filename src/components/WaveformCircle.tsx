import React from "react";
import { View, TouchableOpacity, StyleSheet, GestureResponderEvent } from "react-native";
import Animated, { useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";

interface WaveformCircleProps {
  metering: number;
  isActive: boolean;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

function RippleRing({ delay, color, isActive, intensity }: { delay: number; color: string; isActive: boolean; intensity: number }) {
  const duration = 2500 - intensity * 1300;
  const peakOpacity = 0.1 + intensity * 0.25;
  const animatedStyle = useAnimatedStyle(() => {
    if (!isActive) return { opacity: 0, transform: [{ scale: 0.8 }] };
    return {
      opacity: withDelay(delay, withRepeat(withSequence(withTiming(peakOpacity, { duration: 0, easing: Easing.linear }), withTiming(0, { duration, easing: Easing.out(Easing.ease) })), -1)),
      transform: [{ scale: withDelay(delay, withRepeat(withSequence(withTiming(0.7, { duration: 0, easing: Easing.linear }), withTiming(1.4, { duration, easing: Easing.out(Easing.ease) })), -1)) }],
    };
  });
  return <Animated.View style={[{ position: "absolute", width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderColor: color }, animatedStyle]} />;
}

export function WaveformCircle({ metering, isActive, inputMode, onPressIn, onPressOut, onPress }: WaveformCircleProps) {
  const { colors } = useTheme();
  const intensity = Math.max(0, (metering + 160) / 160);
  return (
    <View style={styles.container}>
      <RippleRing delay={0} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={500} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={1000} color={colors.accent} isActive={isActive} intensity={intensity} />
      <TouchableOpacity activeOpacity={0.8}
        onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
        onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
        onPress={inputMode === "toggle-to-talk" ? onPress : undefined}>
        <LinearGradient colors={[colors.accentGradientStart, colors.accentGradientEnd]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={[styles.circle, { shadowColor: colors.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: isActive ? 1 : 0.5, shadowRadius: isActive ? 25 : 15, elevation: isActive ? 12 : 6 }]}>
          <Waveform metering={metering} maxHeight={60} barCount={16} barColor="rgba(255, 255, 255, 0.9)" barColorInactive="rgba(255, 255, 255, 0.5)" isActive={isActive} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  circle: { width: 170, height: 170, borderRadius: 85, alignItems: "center", justifyContent: "center" },
});
