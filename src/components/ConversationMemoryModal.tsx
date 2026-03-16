import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";

interface ConversationMemoryModalProps {
  visible: boolean;
  title: string;
  summary?: string;
  summarizedMessageCount?: number;
  onCopy: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function ConversationMemoryModal({
  visible,
  title,
  summary,
  summarizedMessageCount,
  onCopy,
  onClear,
  onClose,
}: ConversationMemoryModalProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const trimmedSummary = summary?.trim() ?? "";
  const hasSummary = trimmedSummary.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 24, 36),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.glow,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                {t("memory")}
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("memoryModalTitle")}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.85}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t("memoryModalDescription")}
          </Text>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              {hasSummary
                ? t("summarizedTurnsCount", {
                    count: summarizedMessageCount ?? 0,
                  })
                : t("memorySummary")}
            </Text>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              {hasSummary ? trimmedSummary : t("memorySummaryEmpty")}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  opacity: hasSummary ? 1 : 0.45,
                },
              ]}
              onPress={onCopy}
              activeOpacity={0.88}
              disabled={!hasSummary}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>
                {t("copyMemory")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  opacity: hasSummary ? 1 : 0.45,
                },
              ]}
              onPress={onClear}
              activeOpacity={0.88}
              disabled={!hasSummary}
            >
              <Text style={[styles.actionText, { color: colors.danger }]}>
                {t("forgetMemory")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 40,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  summaryCard: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
});
