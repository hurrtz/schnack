import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getProviderModelName, PROVIDER_LABELS } from "../constants/models";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Message } from "../types";
import { formatTokenCount, formatUsd } from "../utils/usageStats";

interface ChatBubbleProps {
  message: Message;
  onCopy?: (message: Message) => void;
  onShare?: (message: Message) => void;
  onRepeat?: (message: Message) => void;
  selectable?: boolean;
  showUsageStats?: boolean;
}

export function ChatBubble({
  message,
  onCopy,
  onShare,
  onRepeat,
  selectable = false,
  showUsageStats = false,
}: ChatBubbleProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLocalization();
  const isUser = message.role === "user";
  const providerLabel = message.provider
    ? PROVIDER_LABELS[message.provider]
    : null;
  const modelLabel =
    message.provider && message.model
      ? getProviderModelName(message.provider, message.model)
      : message.model;
  const usage = !isUser && showUsageStats ? message.usage : undefined;

  const bubbleContent = (
    <>
      {!isUser && message.model && (
        <View
          style={[
            styles.modelChip,
            {
              backgroundColor: colors.accentSoft,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.providerLabel, { color: colors.accent }]}>
            {providerLabel}
          </Text>
          <Text style={[styles.modelLabel, { color: colors.textSecondary }]}>
            {modelLabel}
          </Text>
        </View>
      )}
      <Text
        selectable={selectable}
        style={[styles.content, { color: isUser ? "#F5FBFF" : colors.text }]}
      >
        {message.content}
      </Text>
      {usage ? (
        <View
          style={[
            styles.usageCard,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.usageText, { color: colors.textSecondary }]}>
            {t("estimatedUsageInline", {
              prompt: formatTokenCount(usage.promptTokens),
              completion: formatTokenCount(usage.completionTokens),
              total: formatTokenCount(usage.totalTokens),
            })}
          </Text>
          {usage.totalCostUsd !== null ? (
            <Text style={[styles.usageTextStrong, { color: colors.text }]}>
              {t("estimatedCost", {
                cost: formatUsd(usage.totalCostUsd),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {selectable && (onCopy || onShare || onRepeat) ? (
        <View style={styles.actionRow}>
          {onRepeat ? (
            <TouchableOpacity
              style={[
                styles.iconAction,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onRepeat(message)}
              activeOpacity={0.88}
              accessibilityLabel={t("repeatReply")}
            >
              <Feather name="volume-2" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onCopy ? (
            <TouchableOpacity
              style={[
                styles.iconAction,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onCopy(message)}
              activeOpacity={0.88}
              accessibilityLabel={t("copy")}
            >
              <Feather name="copy" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onShare ? (
            <TouchableOpacity
              style={[
                styles.iconAction,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onShare(message)}
              activeOpacity={0.88}
              accessibilityLabel={t("share")}
            >
              <Feather name="share-2" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperAssistant,
      ]}
    >
      {onCopy && !selectable ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onLongPress={() => onCopy(message)}
          delayLongPress={220}
        >
          {isUser ? (
            <LinearGradient
              colors={[colors.accentGradientStart, colors.accentGradientEnd]}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.bubble,
                styles.bubbleUser,
                {
                  borderColor: "rgba(255, 255, 255, 0.14)",
                  shadowColor: colors.glowStrong,
                },
              ]}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.bubble,
                styles.bubbleAssistant,
                {
                  backgroundColor: colors.bubbleAssistant,
                  borderColor: colors.border,
                  shadowColor: isDark ? "#000000" : colors.glow,
                },
              ]}
            >
              {bubbleContent}
            </View>
          )}
        </TouchableOpacity>
      ) : isUser ? (
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            styles.bubbleUser,
            {
              borderColor: "rgba(255, 255, 255, 0.14)",
              shadowColor: colors.glowStrong,
            },
          ]}
        >
          {bubbleContent}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.bubbleAssistant,
            {
              backgroundColor: colors.bubbleAssistant,
              borderColor: colors.border,
              shadowColor: isDark ? "#000000" : colors.glow,
            },
          ]}
        >
          {bubbleContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 5 },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  bubbleUser: {
    borderBottomRightRadius: 8,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 8,
  },
  modelChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  providerLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  modelLabel: {
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  usageCard: {
    alignSelf: "stretch",
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  usageText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.mono,
  },
  usageTextStrong: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.mono,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
