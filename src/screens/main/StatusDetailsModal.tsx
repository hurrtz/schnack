import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../../theme/colors";

import { TranslateFn } from "./shared";
import { styles } from "./styles";

interface StatusDetailsModalProps {
  colors: Colors;
  fallbackTtsStatusLabel: string | null;
  isActive: boolean;
  messageCountLabel: string | null;
  onClose: () => void;
  routeModelLabel: string;
  statusDetail: string;
  statusTitle: string;
  sttStatusLabel: string;
  t: TranslateFn;
  ttsStatusLabel: string;
  visible: boolean;
}

export function StatusDetailsModal({
  colors,
  fallbackTtsStatusLabel,
  isActive,
  messageCountLabel,
  onClose,
  routeModelLabel,
  statusDetail,
  statusTitle,
  sttStatusLabel,
  t,
  ttsStatusLabel,
  visible,
}: StatusDetailsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.statusDetailsOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <View
          style={[
            styles.statusDetailsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.glow,
            },
          ]}
        >
          <View style={styles.statusDetailsHeader}>
            <View style={styles.statusDetailsHeaderCopy}>
              <Text style={[styles.statusDetailsTitle, { color: colors.text }]}>
                {t("currentSetup")}
              </Text>
              <Text
                style={[
                  styles.statusDetailsSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                {statusDetail}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.menuIconButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statusDetailsBadges}>
            <View
              style={[
                styles.livePill,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: isActive
                      ? colors.success
                      : colors.accentWarm,
                  },
                ]}
              />
              <Text
                style={[styles.livePillText, { color: colors.textSecondary }]}
              >
                {statusTitle}
              </Text>
            </View>
            {messageCountLabel ? (
              <View
                style={[
                  styles.statusDetailsBadge,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusDetailsBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {messageCountLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statusDetailsList}>
            <View
              style={[
                styles.statusDetailsItem,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusDetailsItemLabel,
                  { color: colors.textMuted },
                ]}
              >
                {t("speechInputRoute", { route: sttStatusLabel })}
              </Text>
            </View>
            <View
              style={[
                styles.statusDetailsItem,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusDetailsItemLabel,
                  { color: colors.textMuted },
                ]}
              >
                {t("replyModelRoute", { route: routeModelLabel })}
              </Text>
            </View>
            <View
              style={[
                styles.statusDetailsItem,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusDetailsItemLabel,
                  { color: colors.textMuted },
                ]}
              >
                {t("voiceOutputRoute", { route: ttsStatusLabel })}
              </Text>
            </View>
            {fallbackTtsStatusLabel ? (
              <View
                style={[
                  styles.statusDetailsItem,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusDetailsItemLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  {t("fallbackVoiceOutputRoute", {
                    route: fallbackTtsStatusLabel,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
