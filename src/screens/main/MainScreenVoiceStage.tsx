import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { WaveformCircle } from "../../components/WaveformCircle";
import { Colors } from "../../theme/colors";
import {
  InputMode,
  VoiceVisualPhase,
  WaveformVisualizationVariant,
} from "../../types";

import { styles } from "./styles";

interface MainScreenVoiceStageProps {
  colors: Colors;
  inputMode: InputMode;
  isActive: boolean;
  metering: number;
  onOpenStatusDetails: () => void;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  providerLabel: string;
  signalLevels: number[] | undefined;
  signalWaveformVariant: WaveformVisualizationVariant;
  statusDetail: string;
  statusIndicatorTone: string;
  statusTitle: string;
  visualPhase: VoiceVisualPhase;
}

function getStatusIndicatorColor(statusIndicatorTone: string, colors: Colors) {
  switch (statusIndicatorTone) {
    case "danger":
      return colors.danger;
    case "accent":
      return colors.accent;
    case "muted":
      return colors.textMuted;
    case "success":
      return colors.success;
    default:
      return colors.accentWarm;
  }
}

export function MainScreenVoiceStage({
  colors,
  inputMode,
  isActive,
  metering,
  onOpenStatusDetails,
  onPress,
  onPressIn,
  onPressOut,
  providerLabel,
  signalLevels,
  signalWaveformVariant,
  statusDetail,
  statusIndicatorTone,
  statusTitle,
  visualPhase,
}: MainScreenVoiceStageProps) {
  return (
    <View style={styles.stageBlock}>
      <View
        style={[styles.stageHalo, { backgroundColor: colors.glowStrong }]}
      />
      <WaveformCircle
        metering={metering}
        levels={signalLevels}
        isActive={isActive}
        phase={visualPhase}
        providerLabel={providerLabel}
        waveformVariant={signalWaveformVariant}
        inputMode={inputMode}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      />
      <View
        style={[
          styles.statusStrip,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
        ]}
      >
        <View style={styles.statusStripCopy}>
          <View style={styles.statusStripLead}>
            <View
              style={[
                styles.statusStripDot,
                {
                  backgroundColor: getStatusIndicatorColor(
                    statusIndicatorTone,
                    colors,
                  ),
                },
              ]}
            />
            <Text style={[styles.statusStripTitle, { color: colors.text }]}>
              {statusTitle}
            </Text>
          </View>
          <Text
            style={[styles.statusStripDetail, { color: colors.textSecondary }]}
          >
            {statusDetail}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.statusStripInfoButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenStatusDetails}
          activeOpacity={0.85}
        >
          <Feather name="info" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
