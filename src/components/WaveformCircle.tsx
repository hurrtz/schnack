import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  Text,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
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
  const isActiveSV = useSharedValue(isActive);
  const intensitySV = useSharedValue(intensity);
  useEffect(() => { isActiveSV.value = isActive; }, [isActive]);
  useEffect(() => { intensitySV.value = intensity; }, [intensity]);

  const duration = useDerivedValue(() => 2500 - intensitySV.value * 1300);
  const peakOpacity = useDerivedValue(() => 0.1 + intensitySV.value * 0.25);

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActiveSV.value) return { opacity: 0, transform: [{ scale: 0.8 }] };
    return {
      opacity: withDelay(delay, withRepeat(withSequence(withTiming(peakOpacity.value, { duration: 0, easing: Easing.linear }), withTiming(0, { duration: duration.value, easing: Easing.out(Easing.ease) })), -1)),
      transform: [{ scale: withDelay(delay, withRepeat(withSequence(withTiming(0.7, { duration: 0, easing: Easing.linear }), withTiming(1.4, { duration: duration.value, easing: Easing.out(Easing.ease) })), -1)) }],
    };
  });
  return <Animated.View style={[{ position: "absolute", width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderColor: color }, animatedStyle]} />;
}

export function WaveformCircle({ metering, isActive, inputMode, onPressIn, onPressOut, onPress }: WaveformCircleProps) {
  const { colors } = useTheme();
  const intensity = Math.max(0, (metering + 160) / 160);
  const interactionHint =
    inputMode === "push-to-talk"
      ? isActive
        ? "Listening"
        : "Hold to speak"
      : isActive
        ? "Tap to stop"
        : "Tap to speak";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.staticRing,
          styles.staticRingOuter,
          { borderColor: colors.border },
        ]}
      />
      <View
        style={[
          styles.staticRing,
          styles.staticRingInner,
          { borderColor: colors.borderStrong },
        ]}
      />
      <RippleRing delay={0} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={500} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={1000} color={colors.accent} isActive={isActive} intensity={intensity} />
      <TouchableOpacity
        activeOpacity={0.88}
        onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
        onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
        onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      >
        <LinearGradient
          colors={[
            colors.accentGradientStart,
            colors.accentGradientEnd,
            colors.accentGradientEnd,
          ]}
          locations={[0, 0.58, 1]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
          style={[
            styles.circle,
            {
              shadowColor: colors.glowStrong,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isActive ? 1 : 0.55,
              shadowRadius: isActive ? 28 : 18,
              elevation: isActive ? 14 : 8,
            },
          ]}
        >
          <View
            style={[
              styles.innerFrame,
              { borderColor: "rgba(255, 255, 255, 0.22)" },
            ]}
          />
          <View
            style={[
              styles.innerBadge,
              { backgroundColor: "rgba(7, 17, 31, 0.16)" },
            ]}
          >
            <Text style={styles.innerBadgeText}>{interactionHint}</Text>
          </View>
          <Waveform
            metering={metering}
            maxHeight={62}
            barCount={18}
            barWidth={4}
            barGap={2}
            barColor="rgba(255, 255, 255, 0.95)"
            barColorInactive="rgba(255, 255, 255, 0.55)"
            isActive={isActive}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  staticRing: {
    position: "absolute",
    borderWidth: 1,
    opacity: 0.7,
  },
  staticRingOuter: {
    width: 244,
    height: 244,
    borderRadius: 122,
  },
  staticRingInner: {
    width: 208,
    height: 208,
    borderRadius: 104,
  },
  circle: {
    width: 188,
    height: 188,
    borderRadius: 94,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  innerFrame: {
    position: "absolute",
    top: 14,
    right: 14,
    bottom: 14,
    left: 14,
    borderRadius: 80,
    borderWidth: 1,
  },
  innerBadge: {
    position: "absolute",
    top: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  innerBadgeText: {
    color: "#F6FBFF",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
});
