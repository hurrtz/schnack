import React from "react";
import {
  View,
  TouchableOpacity,
  GestureResponderEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Waveform } from "./Waveform";
import { styles } from "./WaveformCircle.styles";
import { NativeWaveformView } from "./NativeWaveformView";
import {
  InputMode,
  VoiceVisualPhase,
  WaveformVisualizationVariant,
} from "../types";
import { RippleRing } from "./waveform/RippleRing";
import { useWaveformCircleAnimations } from "./waveform/useWaveformCircleAnimations";
import { useWaveformCircleState } from "./waveform/useWaveformCircleState";

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

export function WaveformCircle({
  metering,
  levels,
  isActive,
  phase,
  providerLabel: _providerLabel,
  waveformVariant = "bars",
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const state = useWaveformCircleState({
    inputMode,
    isActive,
    metering,
    phase,
    waveformVariant,
  });
  const animations = useWaveformCircleAnimations({
    gradientColors: state.gradientColors,
    intensity: state.intensity,
    isRecording: state.isRecording,
    isSpeaking: state.isSpeaking,
    phase: state.phase,
    shouldAnimate: state.shouldAnimate,
    usesPreciseWaveform: state.usesPreciseWaveform,
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingOuter,
          { borderColor: state.ringBorderColor },
          animations.outerRingStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.staticRing,
          styles.staticRingInner,
          { borderColor: state.innerRingBorderColor },
          animations.innerRingStyle,
        ]}
      />
      <RippleRing
        delay={0}
        color={state.ringColor}
        isActive={state.shouldAnimate && state.isRecording}
        intensity={state.intensity}
      />
      <RippleRing
        delay={500}
        color={state.ringColor}
        isActive={state.shouldAnimate && state.isRecording}
        intensity={state.intensity}
      />
      <RippleRing
        delay={1000}
        color={state.ringColor}
        isActive={state.shouldAnimate && state.isRecording}
        intensity={state.intensity}
      />
      <Animated.View style={animations.circleShellStyle}>
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
                shadowColor: state.shellShadowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isActive ? 1 : 0.55,
                shadowRadius: isActive ? 28 : 18,
                elevation: isActive ? 14 : 8,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.backgroundGradient, animations.backgroundGradientStyle]}
            >
              <LinearGradient
                colors={state.gradientColors}
                locations={[0, 0.58, 1]}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={styles.backgroundGradientFill}
              />
            </Animated.View>
            {animations.previousGradientColors ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.backgroundGradient,
                  animations.backgroundGradientStyle,
                  animations.previousBackgroundGradientStyle,
                ]}
              >
                <LinearGradient
                  colors={animations.previousGradientColors}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0.12, y: 0 }}
                  end={{ x: 0.88, y: 1 }}
                  style={styles.backgroundGradientFill}
                />
              </Animated.View>
            ) : null}
            <Animated.View
              style={[styles.coreAura, styles.coreAuraTop, animations.topAuraStyle]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraFill}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.coreAura,
                styles.coreAuraBottom,
                animations.bottomAuraStyle,
              ]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraFill}
              />
            </Animated.View>
            <Animated.View style={[styles.sheen, animations.sheenStyle]}>
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0)",
                  "rgba(255,255,255,0.24)",
                  "rgba(255,255,255,0)",
                ]}
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
                  animations.activityGradientOverlayStyle,
                ]}
              >
                <LinearGradient
                  colors={state.activityOverlayColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordingGradientOverlayFill}
                />
              </Animated.View>
            ) : null}
            <View
              style={[
                styles.innerFrame,
                { borderColor: state.innerFrameBorderColor },
              ]}
            />
            {state.showsStaticControlState ? (
              <Animated.View style={[styles.micIconWrap, animations.controlIconStyle]}>
                <Feather
                  name={state.controlIconName}
                  size={state.controlIconSize}
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
                  animations.waveformStyle,
                ]}
              >
                {state.nativeWaveformChannel ? (
                  <NativeWaveformView
                    channel={state.nativeWaveformChannel}
                    active={isActive}
                    lineColor="rgba(255, 255, 255, 0.95)"
                    baselineColor="rgba(255, 255, 255, 0.14)"
                    lineWidth={state.nativeWaveformChannel === "output" ? 1.8 : 1.9}
                    renderStyle={
                      state.nativeWaveformChannel === "output"
                        ? "envelope"
                        : "automatic"
                    }
                    style={[
                      styles.nativeWaveform,
                      state.nativeWaveformChannel === "output"
                        ? styles.nativeWaveformOutput
                        : styles.nativeWaveformInput,
                    ]}
                  />
                ) : (
                  <Waveform
                    metering={metering}
                    levels={levels}
                    maxHeight={
                      state.showsOutputBars
                        ? 62
                        : waveformVariant === "oscilloscope"
                          ? 86
                          : state.isSpeaking
                            ? 60
                            : 66
                    }
                    barCount={
                      state.showsOutputBars
                        ? 22
                        : waveformVariant === "oscilloscope"
                          ? 78
                          : 19
                    }
                    barWidth={
                      state.showsOutputBars
                        ? 4.5
                        : waveformVariant === "oscilloscope"
                          ? 1.75
                          : 4
                    }
                    barGap={
                      state.showsOutputBars
                        ? 2.2
                        : waveformVariant === "oscilloscope"
                          ? 0.45
                          : 2
                    }
                    barColor="rgba(255, 255, 255, 0.96)"
                    barColorInactive="rgba(255, 255, 255, 0.46)"
                    isActive={isActive}
                    variant={state.showsOutputBars ? "bars" : waveformVariant}
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
