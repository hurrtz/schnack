import React, { useEffect, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  View,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  Text,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Waveform } from "./Waveform";
import { NativeWaveformView } from "./NativeWaveformView";
import { supportsNativeOutputWaveformPlayback } from "../services/nativeWaveform";
import {
  InputMode,
  VoiceVisualPhase,
  WaveformVisualizationVariant,
} from "../types";
import { normalizeMetering } from "../utils/audioVisualization";

interface WaveformCircleProps {
  metering: number;
  levels?: number[];
  isActive: boolean;
  phase: VoiceVisualPhase;
  providerLabel: string;
  waveformVariant?: WaveformVisualizationVariant;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

function ProcessingDot({
  delay,
  color,
  isAnimating,
}: {
  delay: number;
  color: string;
  isAnimating: boolean;
}) {
  const opacity = useSharedValue(0.32);
  const scale = useSharedValue(0.76);

  useEffect(() => {
    if (!isAnimating) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0.32;
      scale.value = 0.76;
      return;
    }

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
  }, [delay, isAnimating, opacity, scale]);

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
  isAnimating,
}: {
  phase: VoiceVisualPhase;
  providerLabel: string;
  isAnimating: boolean;
}) {
  const isThinking = phase === "thinking";
  const { t } = useLocalization();

  return (
    <View style={styles.processingWrap}>
      <View style={styles.processingDots}>
        <ProcessingDot
          delay={0}
          color="rgba(255, 255, 255, 0.96)"
          isAnimating={isAnimating}
        />
        <ProcessingDot
          delay={170}
          color="rgba(255, 255, 255, 0.9)"
          isAnimating={isAnimating}
        />
        <ProcessingDot
          delay={340}
          color="rgba(255, 255, 255, 0.84)"
          isAnimating={isAnimating}
        />
      </View>
      <Text style={styles.processingLabel}>
        {isThinking ? t("waitingForReply") : t("parsingYourVoice")}
      </Text>
      {isThinking ? (
        <Text style={styles.processingSubLabel}>{providerLabel}</Text>
      ) : null}
    </View>
  );
}

function RippleRing({
  delay,
  color,
  isActive,
  intensity,
}: {
  delay: number;
  color: string;
  isActive: boolean;
  intensity: number;
}) {
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
  waveformVariant = "bars",
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const { colors, isDark } = useTheme();
  const intensity = normalizeMetering(metering);
  const isRecording = phase === "recording";
  const isProcessing = phase === "transcribing" || phase === "thinking";
  const isSpeaking = phase === "speaking";
  const showsStaticMicState = phase === "idle" || isRecording;
  const showsOutputBars = isSpeaking && waveformVariant === "oscilloscope";
  const usesPreciseWaveform =
    waveformVariant === "oscilloscope" &&
    !isProcessing &&
    !showsStaticMicState &&
    !showsOutputBars;
  const nativeWaveformChannel =
    Platform.OS === "ios" &&
    waveformVariant === "oscilloscope"
      ? phase === "speaking" &&
        supportsNativeOutputWaveformPlayback() &&
        !showsOutputBars
          ? "output"
          : null
      : null;
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);
  const energy = useSharedValue(intensity);
  const shouldAnimate = appState === "active" && isActive;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(orbit);
      orbit.value = 0;
      return;
    }

    orbit.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [orbit, shouldAnimate]);

  useEffect(() => {
    energy.value = withTiming(shouldAnimate ? intensity : 0, {
      duration: 120,
      easing: Easing.out(Easing.ease),
    });
  }, [energy, intensity, shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }

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
  }, [phase, pulse, shouldAnimate]);

  const ringColor = isRecording ? colors.danger : colors.accent;
  const gradientColors: [string, string, string] = isRecording
    ? isDark
      ? ["#FF978C", colors.danger, "#D74C5A"]
      : ["#F29186", colors.danger, "#C94756"]
    : [
        colors.accentGradientStart,
        colors.accentGradientEnd,
        colors.accentGradientEnd,
      ];
  const ringBorderColor = isRecording
    ? "rgba(255, 122, 112, 0.2)"
    : isProcessing
      ? colors.borderStrong
      : colors.border;
  const innerRingBorderColor = isRecording
    ? "rgba(255, 122, 112, 0.28)"
    : isProcessing
      ? colors.accentSoft
      : colors.borderStrong;
  const innerFrameBorderColor = isRecording
    ? "rgba(255, 255, 255, 0.28)"
    : "rgba(255, 255, 255, 0.22)";
  const shellShadowColor = isRecording
    ? isDark
      ? "rgba(255, 122, 112, 0.42)"
      : "rgba(231, 104, 91, 0.34)"
    : colors.glowStrong;

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 0.34 : 0.38 + pulse.value * 0.15,
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : 0.98 + pulse.value * 0.03 + energy.value * 0.03,
      } as const,
    ],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 0.46 : 0.52 + pulse.value * 0.12,
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : 0.995 + pulse.value * 0.025 + energy.value * 0.02,
      } as const,
    ],
  }));

  const circleShellStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : 0.992 + pulse.value * 0.028 + energy.value * 0.025,
      } as const,
    ],
  }));

  const topAuraStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 0.08 : 0.16 + pulse.value * 0.14 + energy.value * 0.12,
    transform: [
      { translateX: usesPreciseWaveform ? 0 : interpolate(orbit.value, [0, 1], [-12, 12]) } as const,
      { translateY: usesPreciseWaveform ? 0 : interpolate(orbit.value, [0, 1], [6, -8]) } as const,
      { scale: usesPreciseWaveform ? 1 : 1 + pulse.value * 0.08 + energy.value * 0.08 } as const,
    ] as any,
  }));

  const bottomAuraStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 0.1 : 0.18 + pulse.value * 0.1 + energy.value * 0.12,
    transform: [
      { translateX: usesPreciseWaveform ? 0 : interpolate(orbit.value, [0, 1], [10, -10]) } as const,
      { translateY: usesPreciseWaveform ? 0 : interpolate(orbit.value, [0, 1], [-8, 10]) } as const,
      { scale: usesPreciseWaveform ? 1 : 1.04 + pulse.value * 0.06 + energy.value * 0.06 } as const,
    ] as any,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 0.06 : 0.16 + pulse.value * 0.08,
    transform: [
      { translateX: usesPreciseWaveform ? 0 : interpolate(orbit.value, [0, 1], [-20, 16]) } as const,
      { rotate: usesPreciseWaveform ? "0deg" : `${interpolate(orbit.value, [0, 1], [-8, 8])}deg` } as const,
    ] as any,
  }));

  const waveformStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform ? 1 : 0.88 + energy.value * 0.12,
    transform: [
      {
        translateY: usesPreciseWaveform ? 0 : -2 - energy.value * 4,
      } as const,
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingOuter,
          { borderColor: ringBorderColor },
          outerRingStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingInner,
          { borderColor: innerRingBorderColor },
          innerRingStyle,
        ]}
      />
      <RippleRing
        delay={0}
        color={ringColor}
        isActive={shouldAnimate}
        intensity={intensity}
      />
      <RippleRing
        delay={500}
        color={ringColor}
        isActive={shouldAnimate}
        intensity={intensity}
      />
      <RippleRing
        delay={1000}
        color={ringColor}
        isActive={shouldAnimate}
        intensity={intensity}
      />
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
                shadowColor: shellShadowColor,
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
                { borderColor: innerFrameBorderColor },
              ]}
            />
            {isProcessing ? (
              <ProcessingIndicator
                phase={phase}
                providerLabel={providerLabel}
                isAnimating={shouldAnimate}
              />
            ) : showsStaticMicState ? (
              <View style={styles.micIconWrap}>
                <Feather name="mic" size={40} color="rgba(255, 255, 255, 0.96)" />
              </View>
            ) : (
              <Animated.View
                style={[
                  styles.waveformWrap,
                  waveformVariant === "oscilloscope"
                    ? styles.waveformWrapOscilloscope
                    : null,
                  waveformStyle,
                ]}
              >
                {nativeWaveformChannel ? (
                  <NativeWaveformView
                    channel={nativeWaveformChannel}
                    active={isActive}
                    lineColor="rgba(255, 255, 255, 0.95)"
                    baselineColor="rgba(255, 255, 255, 0.14)"
                    lineWidth={nativeWaveformChannel === "output" ? 1.8 : 1.9}
                    renderStyle={
                      nativeWaveformChannel === "output" ? "envelope" : "automatic"
                    }
                    style={[
                      styles.nativeWaveform,
                      nativeWaveformChannel === "output"
                        ? styles.nativeWaveformOutput
                        : styles.nativeWaveformInput,
                    ]}
                  />
                ) : (
                  <Waveform
                    metering={metering}
                    levels={levels}
                    maxHeight={
                      showsOutputBars
                        ? 62
                        : waveformVariant === "oscilloscope"
                          ? 86
                          : isSpeaking
                            ? 60
                            : 66
                    }
                    barCount={
                      showsOutputBars
                        ? 22
                        : waveformVariant === "oscilloscope"
                          ? 78
                          : 19
                    }
                    barWidth={
                      showsOutputBars
                        ? 4.5
                        : waveformVariant === "oscilloscope"
                          ? 1.75
                          : 4
                    }
                    barGap={
                      showsOutputBars
                        ? 2.2
                        : waveformVariant === "oscilloscope"
                          ? 0.45
                          : 2
                    }
                    barColor="rgba(255, 255, 255, 0.96)"
                    barColorInactive="rgba(255, 255, 255, 0.46)"
                    isActive={isActive}
                    variant={showsOutputBars ? "bars" : waveformVariant}
                  />
                )}
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
  processingWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  micIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  waveformWrap: {
    marginTop: 18,
  },
  waveformWrapOscilloscope: {
    marginTop: 0,
  },
  nativeWaveform: {
    alignSelf: "center",
  },
  nativeWaveformInput: {
    width: 164,
    height: 36,
  },
  nativeWaveformOutput: {
    width: 156,
    height: 32,
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
