import React, { useEffect } from "react";
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
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Waveform } from "./Waveform";
import { InputMode, VoiceVisualPhase } from "../types";
import { normalizeMetering } from "../utils/audioVisualization";

interface WaveformCircleProps {
  metering: number;
  levels?: number[];
  isActive: boolean;
  phase: VoiceVisualPhase;
  providerLabel: string;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

function ProcessingDot({
  delay,
  color,
}: {
  delay: number;
  color: string;
}) {
  const opacity = useSharedValue(0.32);
  const scale = useSharedValue(0.76);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.ease) }),
          withTiming(0.32, { duration: 560, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 320, easing: Easing.out(Easing.ease) }),
          withTiming(0.76, { duration: 560, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [delay, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.processingDot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

function ProcessingIndicator({
  phase,
  providerLabel,
}: {
  phase: VoiceVisualPhase;
  providerLabel: string;
}) {
  const isThinking = phase === "thinking";

  return (
    <View style={styles.processingWrap}>
      <View style={styles.processingDots}>
        <ProcessingDot delay={0} color="rgba(255, 255, 255, 0.96)" />
        <ProcessingDot delay={170} color="rgba(255, 255, 255, 0.9)" />
        <ProcessingDot delay={340} color="rgba(255, 255, 255, 0.84)" />
      </View>
      <Text style={styles.processingLabel}>
        {isThinking ? "Waiting for reply" : "Parsing your voice"}
      </Text>
      {isThinking ? (
        <Text style={styles.processingSubLabel}>{providerLabel}</Text>
      ) : null}
    </View>
  );
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

export function WaveformCircle({
  metering,
  levels,
  isActive,
  phase,
  providerLabel,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const { colors } = useTheme();
  const intensity = normalizeMetering(metering);
  const isProcessing = phase === "transcribing" || phase === "thinking";
  const isSpeaking = phase === "speaking";
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);
  const energy = useSharedValue(intensity);

  useEffect(() => {
    orbit.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [orbit]);

  useEffect(() => {
    energy.value = withTiming(intensity, {
      duration: 120,
      easing: Easing.out(Easing.ease),
    });
  }, [energy, intensity]);

  useEffect(() => {
    const highPoint =
      phase === "idle"
        ? 0.38
        : phase === "speaking"
          ? 1
          : phase === "recording"
            ? 0.86
            : 0.68;
    const duration =
      phase === "idle"
        ? 2600
        : phase === "speaking"
          ? 1180
          : phase === "recording"
            ? 1380
            : 1820;

    pulse.value = withRepeat(
      withSequence(
        withTiming(highPoint, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );
  }, [phase, pulse]);

  const interactionHint =
    phase === "recording"
      ? "Listening"
      : phase === "transcribing"
        ? "Parsing"
        : phase === "thinking"
          ? "Thinking"
          : phase === "speaking"
            ? "Speaking"
            : inputMode === "push-to-talk"
              ? "Hold to speak"
              : "Tap to speak";
  const ringColor = isProcessing ? colors.accentWarm : colors.accent;
  const gradientColors: [string, string, string] = isProcessing
    ? [colors.accentWarm, colors.accentGradientStart, colors.accentGradientEnd]
    : [
        colors.accentGradientStart,
        colors.accentGradientEnd,
        colors.accentGradientEnd,
      ];

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: 0.38 + pulse.value * 0.15,
    transform: [{ scale: 0.98 + pulse.value * 0.03 + energy.value * 0.03 }],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    opacity: 0.52 + pulse.value * 0.12,
    transform: [{ scale: 0.995 + pulse.value * 0.025 + energy.value * 0.02 }],
  }));

  const circleShellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.992 + pulse.value * 0.028 + energy.value * 0.025 }],
  }));

  const topAuraStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + pulse.value * 0.14 + energy.value * 0.12,
    transform: [
      { translateX: interpolate(orbit.value, [0, 1], [-12, 12]) },
      { translateY: interpolate(orbit.value, [0, 1], [6, -8]) },
      { scale: 1 + pulse.value * 0.08 + energy.value * 0.08 },
    ],
  }));

  const bottomAuraStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.1 + energy.value * 0.12,
    transform: [
      { translateX: interpolate(orbit.value, [0, 1], [10, -10]) },
      { translateY: interpolate(orbit.value, [0, 1], [-8, 10]) },
      { scale: 1.04 + pulse.value * 0.06 + energy.value * 0.06 },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + pulse.value * 0.08,
    transform: [
      { translateX: interpolate(orbit.value, [0, 1], [-20, 16]) },
      { rotate: `${interpolate(orbit.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(orbit.value, [0, 1], [0, -2]) }],
  }));

  const waveformStyle = useAnimatedStyle(() => ({
    opacity: 0.88 + energy.value * 0.12,
    transform: [{ translateY: -2 - energy.value * 4 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingOuter,
          { borderColor: isProcessing ? colors.borderStrong : colors.border },
          outerRingStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingInner,
          { borderColor: isProcessing ? colors.accentSoft : colors.borderStrong },
          innerRingStyle,
        ]}
      />
      <RippleRing delay={0} color={ringColor} isActive={isActive} intensity={intensity} />
      <RippleRing delay={500} color={ringColor} isActive={isActive} intensity={intensity} />
      <RippleRing delay={1000} color={ringColor} isActive={isActive} intensity={intensity} />
      <Animated.View style={circleShellStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
          onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
          onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
        >
          <LinearGradient
            colors={gradientColors}
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
            <Animated.View style={[styles.coreAura, styles.coreAuraTop, topAuraStyle]}>
              <LinearGradient
                colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraFill}
              />
            </Animated.View>
            <Animated.View style={[styles.coreAura, styles.coreAuraBottom, bottomAuraStyle]}>
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraFill}
              />
            </Animated.View>
            <Animated.View style={[styles.sheen, sheenStyle]}>
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.24)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraFill}
              />
            </Animated.View>
            <View
              style={[
                styles.innerFrame,
                { borderColor: "rgba(255, 255, 255, 0.22)" },
              ]}
            />
            <Animated.View
              style={[
                styles.innerBadge,
                { backgroundColor: "rgba(7, 17, 31, 0.18)" },
                badgeStyle,
              ]}
            >
              <Text style={styles.innerBadgeText}>{interactionHint}</Text>
            </Animated.View>
            {isProcessing ? (
              <ProcessingIndicator phase={phase} providerLabel={providerLabel} />
            ) : (
              <Animated.View style={[styles.waveformWrap, waveformStyle]}>
                <Waveform
                  metering={metering}
                  levels={levels}
                  maxHeight={isSpeaking ? 60 : 66}
                  barCount={19}
                  barWidth={4}
                  barGap={2}
                  barColor="rgba(255, 255, 255, 0.96)"
                  barColorInactive="rgba(255, 255, 255, 0.46)"
                  isActive={isActive}
                />
              </Animated.View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
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
  processingWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  waveformWrap: {
    marginTop: 18,
  },
  coreAura: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
  },
  coreAuraTop: {
    top: -18,
    left: -6,
    width: 126,
    height: 126,
  },
  coreAuraBottom: {
    right: -18,
    bottom: -16,
    width: 138,
    height: 138,
  },
  auraFill: {
    flex: 1,
  },
  sheen: {
    position: "absolute",
    top: 24,
    left: 26,
    width: 136,
    height: 136,
    borderRadius: 32,
    overflow: "hidden",
  },
  processingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  processingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  processingLabel: {
    color: "#F6FBFF",
    fontSize: 16,
    textAlign: "center",
    fontFamily: fonts.display,
  },
  processingSubLabel: {
    marginTop: 6,
    color: "rgba(246, 251, 255, 0.82)",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
});
