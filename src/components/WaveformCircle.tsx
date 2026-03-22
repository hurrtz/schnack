import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  View,
  TouchableOpacity,
  GestureResponderEvent,
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
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { styles } from "./WaveformCircle.styles";
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
  useEffect(() => {
    isActiveSV.value = isActive;
  }, [isActive, isActiveSV]);
  useEffect(() => {
    intensitySV.value = intensity;
  }, [intensity, intensitySV]);

  const duration = useDerivedValue(() => 2500 - intensitySV.value * 1300);
  const peakOpacity = useDerivedValue(() => 0.1 + intensitySV.value * 0.25);

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActiveSV.value) {
      return { opacity: 0, transform: [{ scale: 0.8 }] };
    }

    return {
      opacity: withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(peakOpacity.value, {
              duration: 0,
              easing: Easing.linear,
            }),
            withTiming(0, {
              duration: duration.value,
              easing: Easing.out(Easing.ease),
            }),
          ),
          -1,
        ),
      ),
      transform: [
        {
          scale: withDelay(
            delay,
            withRepeat(
              withSequence(
                withTiming(0.7, { duration: 0, easing: Easing.linear }),
                withTiming(1.4, {
                  duration: duration.value,
                  easing: Easing.out(Easing.ease),
                }),
              ),
              -1,
            ),
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.rippleRing, { borderColor: color }, animatedStyle]}
    />
  );
}

function clearPreviousGradient(
  token: number,
  gradientTransitionTokenRef: React.MutableRefObject<number>,
  setPreviousGradientColors: React.Dispatch<
    React.SetStateAction<[string, string, string] | null>
  >,
) {
  if (gradientTransitionTokenRef.current !== token) {
    return;
  }

  setPreviousGradientColors(null);
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
  const isBlockingPhase =
    phase === "transcribing" ||
    phase === "thinking" ||
    phase === "synthesizing";
  const isSpeaking = phase === "speaking";
  const showsStaticControlState =
    phase === "idle" || isRecording || isBlockingPhase;
  const showsOutputBars = isSpeaking && waveformVariant === "oscilloscope";
  const usesPreciseWaveform =
    waveformVariant === "oscilloscope" &&
    !showsStaticControlState &&
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
  const [previousGradientColors, setPreviousGradientColors] = useState<
    [string, string, string] | null
  >(null);
  const previousGradientKeyRef = useRef<string | null>(null);
  const previousGradientColorsRef = useRef<[string, string, string] | null>(null);
  const gradientTransitionTokenRef = useRef(0);
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);
  const spin = useSharedValue(0);
  const energy = useSharedValue(intensity);
  const backgroundGradientFade = useSharedValue(0);
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
    if (!shouldAnimate) {
      cancelAnimation(spin);
      spin.value = 0;
      return;
    }

    spin.value = withRepeat(
      withTiming(1, {
        duration: isRecording ? 2800 : isSpeaking ? 3600 : 4400,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [isRecording, isSpeaking, shouldAnimate, spin]);

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

  const processingGradientColors: [string, string, string] = isDark
    ? ["#FFD27D", "#F39A58", "#E06A5C"]
    : ["#FFE4A6", "#F5AF70", "#E88A74"];
  const speakingGradientColors: [string, string, string] = isDark
    ? ["#9AF4B8", "#42C97B", "#247E5D"]
    : ["#BDF7CB", "#63D88D", "#2D9B6F"];
  const activityOverlayColors: [string, string, string, string, string] =
    isRecording
      ? [
          "rgba(255,255,255,0)",
          "rgba(255, 235, 229, 0.16)",
          "rgba(255, 198, 182, 0.34)",
          "rgba(255, 235, 229, 0.12)",
          "rgba(255,255,255,0)",
        ]
      : isSpeaking
        ? [
            "rgba(255,255,255,0)",
            "rgba(228, 255, 236, 0.14)",
            "rgba(122, 233, 165, 0.28)",
            "rgba(94, 201, 138, 0.18)",
            "rgba(255,255,255,0)",
          ]
        : [
            "rgba(255,255,255,0)",
            "rgba(255, 243, 209, 0.14)",
            "rgba(255, 194, 121, 0.28)",
            "rgba(255, 166, 104, 0.18)",
            "rgba(255,255,255,0)",
          ];
  const ringColor = isRecording
    ? colors.danger
    : isSpeaking
      ? "#54D685"
    : isBlockingPhase
      ? "#F1A457"
      : colors.accent;
  const gradientColors: [string, string, string] = isRecording
    ? isDark
      ? ["#FF978C", colors.danger, "#D74C5A"]
      : ["#F29186", colors.danger, "#C94756"]
    : isSpeaking
      ? speakingGradientColors
    : isBlockingPhase
      ? processingGradientColors
      : [
        colors.accentGradientStart,
        colors.accentGradientEnd,
        colors.accentGradientEnd,
      ];
  const gradientColorKey = gradientColors.join("|");
  const ringBorderColor = isRecording
    ? "rgba(255, 122, 112, 0.2)"
    : isSpeaking
      ? isDark
        ? "rgba(132, 236, 170, 0.24)"
        : "rgba(84, 214, 133, 0.22)"
    : isBlockingPhase
      ? isDark
        ? "rgba(255, 196, 124, 0.22)"
        : "rgba(241, 164, 87, 0.2)"
      : colors.border;
  const innerRingBorderColor = isRecording
    ? "rgba(255, 122, 112, 0.28)"
    : isSpeaking
      ? isDark
        ? "rgba(162, 244, 190, 0.28)"
        : "rgba(84, 214, 133, 0.26)"
    : isBlockingPhase
      ? isDark
        ? "rgba(255, 212, 146, 0.28)"
        : "rgba(241, 164, 87, 0.24)"
      : colors.borderStrong;
  const innerFrameBorderColor = isRecording
    ? "rgba(255, 255, 255, 0.28)"
    : isSpeaking
      ? isDark
        ? "rgba(255, 255, 255, 0.24)"
        : "rgba(255, 255, 255, 0.28)"
    : isBlockingPhase
      ? isDark
        ? "rgba(255, 244, 224, 0.22)"
        : "rgba(255, 250, 240, 0.3)"
    : "rgba(255, 255, 255, 0.22)";
  const shellShadowColor = isRecording
    ? isDark
      ? "rgba(255, 122, 112, 0.42)"
      : "rgba(231, 104, 91, 0.34)"
    : isSpeaking
      ? isDark
        ? "rgba(66, 201, 123, 0.36)"
        : "rgba(76, 194, 120, 0.28)"
    : isBlockingPhase
      ? isDark
        ? "rgba(241, 164, 87, 0.34)"
        : "rgba(235, 153, 74, 0.26)"
    : colors.glowStrong;
  const controlIconName: React.ComponentProps<typeof Feather>["name"] =
    phase === "idle"
      ? "mic"
      : phase === "recording"
        ? "square"
        : phase === "transcribing"
          ? "type"
          : phase === "thinking"
            ? "cpu"
            : "volume-2";
  const controlIconSize =
    phase === "idle"
      ? 40
      : phase === "thinking"
        ? 24
        : phase === "transcribing"
          ? 26
          : phase === "synthesizing"
            ? 24
          : 28;

  useEffect(() => {
    if (!previousGradientKeyRef.current || !previousGradientColorsRef.current) {
      previousGradientKeyRef.current = gradientColorKey;
      previousGradientColorsRef.current = gradientColors;
      return;
    }

    if (previousGradientKeyRef.current === gradientColorKey) return;

    const outgoingColors = previousGradientColorsRef.current;
    previousGradientKeyRef.current = gradientColorKey;
    previousGradientColorsRef.current = gradientColors;

    if (!outgoingColors) return;

    gradientTransitionTokenRef.current += 1;
    const token = gradientTransitionTokenRef.current;
    setPreviousGradientColors(outgoingColors);
    backgroundGradientFade.value = 1;
    backgroundGradientFade.value = withTiming(
      0,
      {
        duration: 420,
        easing: Easing.inOut(Easing.ease),
      },
      (finished) => {
        if (finished) {
          runOnJS(clearPreviousGradient)(
            token,
            gradientTransitionTokenRef,
            setPreviousGradientColors,
          );
        }
      },
    );
  }, [
    backgroundGradientFade,
    gradientColorKey,
    gradientColors,
    previousGradientColorsRef,
    previousGradientKeyRef,
  ]);

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform
      ? 0.34
      : phase === "idle"
        ? 0.38 + pulse.value * 0.15
      : isRecording
        ? 0.4 + pulse.value * 0.18 + energy.value * 0.08
      : isSpeaking
        ? 0.34 + pulse.value * 0.14 + energy.value * 0.08
      : 0.32 + pulse.value * 0.12,
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : phase === "idle"
            ? 0.98 + pulse.value * 0.03 + energy.value * 0.03
          : isRecording
            ? 0.975 + pulse.value * 0.04 + energy.value * 0.055
          : isSpeaking
            ? 0.982 + pulse.value * 0.03 + energy.value * 0.04
          : 0.986 + pulse.value * 0.025,
      } as const,
    ],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    opacity: usesPreciseWaveform
      ? 0.46
      : phase === "idle"
        ? 0.52 + pulse.value * 0.12
      : isRecording
        ? 0.56 + pulse.value * 0.12 + energy.value * 0.1
      : isSpeaking
        ? 0.46 + pulse.value * 0.1 + energy.value * 0.08
      : 0.44 + pulse.value * 0.1,
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : phase === "idle"
            ? 0.995 + pulse.value * 0.025 + energy.value * 0.02
          : isRecording
            ? 0.99 + pulse.value * 0.03 + energy.value * 0.045
          : isSpeaking
            ? 0.992 + pulse.value * 0.028 + energy.value * 0.03
          : 0.994 + pulse.value * 0.02,
      } as const,
    ],
  }));

  const circleShellStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: usesPreciseWaveform
          ? 1
          : phase === "idle"
            ? 0.992 + pulse.value * 0.028 + energy.value * 0.025
          : isRecording
            ? 0.992 + pulse.value * 0.032 + energy.value * 0.075
          : isSpeaking
            ? 0.994 + pulse.value * 0.026 + energy.value * 0.04
          : 0.994 + pulse.value * 0.018,
      } as const,
    ],
  }));

  const backgroundGradientStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate:
          phase !== "idle" && shouldAnimate ? `${spin.value * 360}deg` : "0deg",
      } as const,
      {
        scale:
          phase !== "idle" && shouldAnimate
            ? isRecording
              ? 1.18 + pulse.value * 0.03 + energy.value * 0.03
              : isSpeaking
                ? 1.16 + pulse.value * 0.025 + energy.value * 0.025
                : 1.15 + pulse.value * 0.02
            : 1.08,
      } as const,
    ],
  }));

  const previousBackgroundGradientStyle = useAnimatedStyle(() => ({
    opacity: backgroundGradientFade.value,
  }));

  const activityGradientOverlayStyle = useAnimatedStyle(() => ({
    opacity:
      phase !== "idle" && shouldAnimate
        ? isRecording
          ? 0.24 + pulse.value * 0.08 + energy.value * 0.14
          : isSpeaking
            ? 0.2 + pulse.value * 0.06 + energy.value * 0.08
            : 0.18 + pulse.value * 0.06
        : 0,
    transform: [
      { rotate: `${spin.value * 360}deg` } as const,
      {
        scale:
          phase !== "idle" && shouldAnimate
            ? isRecording
              ? 1.02 + pulse.value * 0.02 + energy.value * 0.03
              : isSpeaking
                ? 1.015 + pulse.value * 0.018 + energy.value * 0.02
                : 1.014 + pulse.value * 0.016
            : 1,
      } as const,
    ],
  }));

  const topAuraStyle = useAnimatedStyle(() => ({
    opacity:
      usesPreciseWaveform
        ? 0.08
      : phase === "idle"
        ? 0.16 + pulse.value * 0.14 + energy.value * 0.12
      : isSpeaking
        ? 0.14 + pulse.value * 0.1 + energy.value * 0.1
      : isRecording
        ? 0.16 + pulse.value * 0.14 + energy.value * 0.12
      : 0.12 + pulse.value * 0.08,
    transform: [
      {
        translateX: usesPreciseWaveform
          ? 0
          : interpolate(orbit.value, [0, 1], [-12, 12]),
      } as const,
      {
        translateY: usesPreciseWaveform
          ? 0
          : interpolate(orbit.value, [0, 1], [6, -8]),
      } as const,
      {
        scale: usesPreciseWaveform
          ? 1
          : 1 + pulse.value * 0.06 + energy.value * 0.06,
      } as const,
    ] as any,
  }));

  const bottomAuraStyle = useAnimatedStyle(() => ({
    opacity:
      usesPreciseWaveform
        ? 0.1
      : phase === "idle"
        ? 0.18 + pulse.value * 0.1 + energy.value * 0.12
      : isSpeaking
        ? 0.15 + pulse.value * 0.08 + energy.value * 0.1
      : isRecording
        ? 0.18 + pulse.value * 0.1 + energy.value * 0.12
      : 0.13 + pulse.value * 0.07,
    transform: [
      {
        translateX: usesPreciseWaveform
          ? 0
          : interpolate(orbit.value, [0, 1], [10, -10]),
      } as const,
      {
        translateY: usesPreciseWaveform
          ? 0
          : interpolate(orbit.value, [0, 1], [-8, 10]),
      } as const,
      {
        scale: usesPreciseWaveform
          ? 1
          : 1.03 + pulse.value * 0.05 + energy.value * 0.05,
      } as const,
    ] as any,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity:
      usesPreciseWaveform
        ? 0.06
      : phase === "idle"
        ? 0.16 + pulse.value * 0.08
      : isSpeaking
        ? 0.13 + pulse.value * 0.06
      : 0.11 + pulse.value * 0.05,
    transform: [
      {
        translateX: usesPreciseWaveform
          ? 0
          : interpolate(orbit.value, [0, 1], [-20, 16]),
      } as const,
      {
        rotate: usesPreciseWaveform
          ? "0deg"
          : `${interpolate(orbit.value, [0, 1], [-8, 8])}deg`,
      } as const,
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

  const controlIconStyle = useAnimatedStyle(() => ({
    opacity: phase === "idle" ? 0.96 : 0.92,
    transform: [
      {
        scale:
          isRecording && shouldAnimate
            ? 0.96 + pulse.value * 0.04 + energy.value * 0.1
            : 1,
      } as const,
      {
        translateY:
          isRecording && shouldAnimate
            ? -1 - energy.value * 2
            : 0,
      } as const,
    ],
  }), [phase]);

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
        isActive={shouldAnimate && isRecording}
        intensity={intensity}
      />
      <RippleRing
        delay={500}
        color={ringColor}
        isActive={shouldAnimate && isRecording}
        intensity={intensity}
      />
      <RippleRing
        delay={1000}
        color={ringColor}
        isActive={shouldAnimate && isRecording}
        intensity={intensity}
      />
      <Animated.View style={circleShellStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
          onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
          onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
        >
          <View
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
            <Animated.View
              pointerEvents="none"
              style={[styles.backgroundGradient, backgroundGradientStyle]}
            >
              <LinearGradient
                colors={gradientColors}
                locations={[0, 0.58, 1]}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={styles.backgroundGradientFill}
              />
            </Animated.View>
            {previousGradientColors ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.backgroundGradient,
                  backgroundGradientStyle,
                  previousBackgroundGradientStyle,
                ]}
              >
                <LinearGradient
                  colors={previousGradientColors}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0.12, y: 0 }}
                  end={{ x: 0.88, y: 1 }}
                  style={styles.backgroundGradientFill}
                />
              </Animated.View>
            ) : null}
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
            {phase !== "idle" ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.recordingGradientOverlay,
                  activityGradientOverlayStyle,
                ]}
              >
                <LinearGradient
                  colors={activityOverlayColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordingGradientOverlayFill}
                />
              </Animated.View>
            ) : null}
            <View
              style={[
                styles.innerFrame,
                { borderColor: innerFrameBorderColor },
              ]}
            />
            {showsStaticControlState ? (
              <Animated.View style={[styles.micIconWrap, controlIconStyle]}>
                <Feather
                  name={controlIconName}
                  size={controlIconSize}
                  color="rgba(255, 255, 255, 0.96)"
                />
              </Animated.View>
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
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
