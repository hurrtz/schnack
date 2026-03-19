import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  View,
  Text,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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

interface WaveformBarProps {
  metering: number;
  levels?: number[];
  isActive: boolean;
  phase: VoiceVisualPhase;
  waveformVariant?: WaveformVisualizationVariant;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformBar({
  metering,
  levels,
  isActive,
  phase,
  waveformVariant = "bars",
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformBarProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLocalization();
  const isRecording = phase === "recording";
  const isProcessing = phase === "transcribing" || phase === "thinking";
  const nativeWaveformChannel =
    Platform.OS === "ios" &&
    waveformVariant === "oscilloscope"
      ? phase === "speaking" && supportsNativeOutputWaveformPlayback()
          ? "output"
          : null
      : null;
  const buttonGradientColors: [string, string, string] = isRecording
    ? isDark
      ? ["#FF978C", colors.danger, "#D74C5A"]
      : ["#F29186", colors.danger, "#C94756"]
    : [colors.accentGradientStart, colors.accentGradientEnd, colors.accentGradientEnd];
  const micButtonBorderColor = isRecording
    ? "rgba(255, 255, 255, 0.28)"
    : "rgba(255, 255, 255, 0.22)";

  const content = (
    <View style={styles.contentRow}>
      <LinearGradient
        colors={buttonGradientColors}
        locations={[0, 0.58, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={styles.micButton}
      >
        <View
          style={[
            styles.micButtonFrame,
            { borderColor: micButtonBorderColor },
          ]}
        />
        <Feather name="mic" size={18} color="rgba(255, 255, 255, 0.96)" />
      </LinearGradient>
      {isProcessing ? (
        <Text
          style={[
          styles.processingText,
            { color: isActive ? "#F6FBFF" : colors.textSecondary },
          ]}
        >
          {phase === "thinking" ? t("waitingOnModel") : t("convertingSpeech")}
        </Text>
      ) : (
        <View style={styles.waveformWrap}>
          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <Feather name="mic" size={18} color="rgba(255, 255, 255, 0.94)" />
            </View>
          ) : nativeWaveformChannel ? (
            <NativeWaveformView
              channel={nativeWaveformChannel}
              active={isActive}
              lineColor={isActive ? "rgba(255, 255, 255, 0.95)" : colors.accent}
              baselineColor={
                isActive ? "rgba(255, 255, 255, 0.14)" : colors.borderStrong
              }
              lineWidth={1.9}
              style={styles.nativeWaveform}
            />
          ) : (
            <Waveform
              metering={metering}
              levels={levels}
              maxHeight={waveformVariant === "oscilloscope" ? 32 : 26}
              barCount={waveformVariant === "oscilloscope" ? 64 : 28}
              barWidth={waveformVariant === "oscilloscope" ? 1.5 : 2}
              barGap={waveformVariant === "oscilloscope" ? 0.4 : 1}
              barColor={isActive ? "rgba(255, 255, 255, 0.95)" : colors.accent}
              barColorInactive={
                isActive ? "rgba(255, 255, 255, 0.55)" : colors.textMuted
              }
              isActive={isActive}
              variant={waveformVariant}
            />
          )}
        </View>
      )}
    </View>
  );

  const activeGradientColors: [string, string, string] = isRecording
    ? isDark
      ? ["#FF978C", colors.danger, "#D74C5A"]
      : ["#F29186", colors.danger, "#C94756"]
    : [
        colors.accentGradientStart,
        colors.accentGradientEnd,
        colors.accentGradientEnd,
      ];
  const glowShadow = {
    shadowColor: isActive
      ? isRecording
        ? isDark
          ? "rgba(255, 122, 112, 0.34)"
          : "rgba(231, 104, 91, 0.28)"
        : colors.glow
      : "transparent",
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: isActive ? 1 : 0,
    shadowRadius: isActive ? 8 : 0,
    elevation: isActive ? 4 : 0,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={styles.touchable}
    >
      {isActive ? (
        <LinearGradient
          colors={activeGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bar, glowShadow]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bar,
            glowShadow,
            {
              borderColor: colors.border,
              borderWidth: 1,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: "100%",
  },
  bar: {
    minHeight: 58,
    borderRadius: 20,
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  waveformWrap: {
    flex: 1,
    minHeight: 28,
    justifyContent: "center",
  },
  nativeWaveform: {
    width: "100%",
    height: 32,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "rgba(12, 20, 33, 0.18)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  micButtonFrame: {
    position: "absolute",
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 18,
    borderWidth: 1,
  },
  recordingIndicator: {
    flex: 1,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  processingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
});
