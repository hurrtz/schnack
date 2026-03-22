import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  EdgeInsets,
} from "react-native-safe-area-context";

import { ChatTranscript } from "../../components/ChatTranscript";
import { WaveformBar } from "../../components/WaveformBar";
import { Colors } from "../../theme/colors";
import {
  InputMode,
  Message,
  VoiceVisualPhase,
  WaveformVisualizationVariant,
} from "../../types";
import { ReplayPhase } from "../../hooks/useVoicePipeline";

import { ConversationMenu } from "./ConversationMenu";
import { TranslateFn } from "./shared";
import { styles } from "./styles";
import { ConversationUsageDisplayData } from "./usageSelectors";

interface TranscriptModalProps {
  activeConversationTitle: string;
  activeReplayMessageId: string | null;
  colors: Colors;
  conversationMenuVisible: boolean;
  insets: EdgeInsets;
  isActive: boolean;
  metering: number;
  messages: Message[];
  onClose: () => void;
  onCloseConversationMenu: () => void;
  onCopyMessage: (message: Message) => void;
  onCopyThread: () => void;
  onManageMemory: () => void;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onRepeatMessage: (message: Message) => void;
  onShareMessage: (message: Message) => void;
  onShareThread: () => void;
  replayPhase: ReplayPhase;
  settingsShowUsageStats: boolean;
  signalLevels: number[] | undefined;
  signalWaveformVariant: WaveformVisualizationVariant;
  t: TranslateFn;
  toggleConversationMenu: () => void;
  usageDisplay: ConversationUsageDisplayData | null;
  visualPhase: VoiceVisualPhase;
  visible: boolean;
  waveformInputMode: InputMode;
}

export function TranscriptModal({
  activeConversationTitle,
  activeReplayMessageId,
  colors,
  conversationMenuVisible,
  insets,
  isActive,
  metering,
  messages,
  onClose,
  onCloseConversationMenu,
  onCopyMessage,
  onCopyThread,
  onManageMemory,
  onPress,
  onPressIn,
  onPressOut,
  onRepeatMessage,
  onShareMessage,
  onShareThread,
  replayPhase,
  settingsShowUsageStats,
  signalLevels,
  signalWaveformVariant,
  t,
  toggleConversationMenu,
  usageDisplay,
  visualPhase,
  visible,
  waveformInputMode,
}: TranscriptModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[
          styles.transcriptModal,
          { backgroundColor: colors.background },
        ]}
        edges={["left", "right", "bottom"]}
      >
        <LinearGradient
          colors={[
            colors.background,
            colors.backgroundSecondary,
            colors.background,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.expandedLayout,
            { paddingTop: Math.max(insets.top, 16) },
          ]}
        >
          <View style={styles.expandedTopBar}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("conversation")}
            </Text>
            <TouchableOpacity
              style={[
                styles.menuIconButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.expandedStageBar}>
            <WaveformBar
              metering={metering}
              levels={signalLevels}
              isActive={isActive}
              phase={visualPhase}
              waveformVariant={signalWaveformVariant}
              inputMode={waveformInputMode}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={onPress}
            />
          </View>

          <View
            style={[
              styles.expandedTranscriptDrawer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
            ]}
          >
            <View style={styles.expandedTranscriptHeader}>
              <Text
                numberOfLines={1}
                style={[styles.expandedTranscriptTitle, { color: colors.text }]}
              >
                {activeConversationTitle}
              </Text>
              <TouchableOpacity
                style={[
                  styles.menuIconButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={toggleConversationMenu}
                activeOpacity={0.85}
              >
                <Feather
                  name="more-horizontal"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <ConversationMenu
              visible={conversationMenuVisible}
              colors={colors}
              t={t}
              onClose={onCloseConversationMenu}
              onManageMemory={onManageMemory}
              onCopyThread={onCopyThread}
              onShareThread={onShareThread}
            />

            <Text
              style={[
                styles.expandedTranscriptHint,
                { color: colors.textSecondary },
              ]}
            >
              {t("transcriptSelectionHint")}
            </Text>

            {usageDisplay ? (
              <View
                style={[
                  styles.usageSummaryCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.usageSummaryHeader}>
                  <Text style={[styles.usageSummaryTitle, { color: colors.text }]}>
                    {t("estimatedUsageTitle")}
                  </Text>
                  <Text
                    style={[
                      styles.usageSummaryMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {usageDisplay.countsLabel}
                  </Text>
                  <Text
                    style={[
                      styles.usageSummaryNote,
                      { color: colors.textMuted },
                    ]}
                  >
                    {usageDisplay.noteLabel}
                  </Text>
                </View>
                <View style={styles.usageSummaryRow}>
                  <Text
                    style={[
                      styles.usageSummaryMetric,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {usageDisplay.promptTokensLabel}
                  </Text>
                  <Text
                    style={[
                      styles.usageSummaryMetric,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {usageDisplay.replyTokensLabel}
                  </Text>
                </View>
                <View style={styles.usageSummaryRow}>
                  <Text
                    style={[
                      styles.usageSummaryMetricStrong,
                      { color: colors.text },
                    ]}
                  >
                    {usageDisplay.totalTokensLabel}
                  </Text>
                  {usageDisplay.totalCostLabel ? (
                    <Text
                      style={[
                        styles.usageSummaryMetricStrong,
                        { color: colors.text },
                      ]}
                    >
                      {usageDisplay.totalCostLabel}
                    </Text>
                  ) : null}
                </View>
                {usageDisplay.routes.length > 0 ? (
                  <View style={styles.usageRouteList}>
                    {usageDisplay.routes.map((route) => (
                      <View key={route.key} style={styles.usageRouteRow}>
                        <Text
                          style={[
                            styles.usageRouteLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {route.label}
                        </Text>
                        <Text
                          style={[
                            styles.usageRouteValue,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {route.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <ChatTranscript
              messages={messages}
              emptyTitle={t("noConversationYet")}
              emptyDescription={t("expandedTranscriptEmptyDescription")}
              contentContainerStyle={styles.expandedTranscriptContent}
              showUsageStats={settingsShowUsageStats}
              activeRepeatMessageId={activeReplayMessageId}
              repeatPlaybackStatus={replayPhase}
              onCopyMessage={onCopyMessage}
              onShareMessage={onShareMessage}
              onRepeatMessage={onRepeatMessage}
              messageSelectionEnabled
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
