import { useEffect, useRef, useState } from "react";
import type React from "react";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { VoiceVisualPhase } from "../../types";

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

export function useWaveformCircleAnimations(params: {
  gradientColors: [string, string, string];
  intensity: number;
  isRecording: boolean;
  isSpeaking: boolean;
  phase: VoiceVisualPhase;
  shouldAnimate: boolean;
  usesPreciseWaveform: boolean;
}) {
  const {
    gradientColors,
    intensity,
    isRecording,
    isSpeaking,
    phase,
    shouldAnimate,
    usesPreciseWaveform,
  } = params;
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
  const gradientColorKey = gradientColors.join("|");

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(orbit);
      orbit.value = 0;
      return;
    }

    orbit.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
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
        }),
      ),
      -1,
      false,
    );
  }, [phase, pulse, shouldAnimate]);

  useEffect(() => {
    if (!previousGradientKeyRef.current || !previousGradientColorsRef.current) {
      previousGradientKeyRef.current = gradientColorKey;
      previousGradientColorsRef.current = gradientColors;
      return;
    }

    if (previousGradientKeyRef.current === gradientColorKey) {
      return;
    }

    const outgoingColors = previousGradientColorsRef.current;
    previousGradientKeyRef.current = gradientColorKey;
    previousGradientColorsRef.current = gradientColors;

    if (!outgoingColors) {
      return;
    }

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
    opacity: usesPreciseWaveform
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
    opacity: usesPreciseWaveform
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
    opacity: usesPreciseWaveform
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

  const controlIconStyle = useAnimatedStyle(
    () => ({
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
            isRecording && shouldAnimate ? -1 - energy.value * 2 : 0,
        } as const,
      ],
    }),
    [phase],
  );

  return {
    activityGradientOverlayStyle,
    backgroundGradientStyle,
    bottomAuraStyle,
    circleShellStyle,
    controlIconStyle,
    outerRingStyle,
    innerRingStyle,
    previousBackgroundGradientStyle,
    previousGradientColors,
    sheenStyle,
    topAuraStyle,
    waveformStyle,
  };
}
