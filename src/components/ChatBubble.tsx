import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PROVIDER_LABELS } from "../constants/models";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
  onCopy?: (message: Message) => void;
  selectable?: boolean;
}

export function ChatBubble({
  message,
  onCopy,
  selectable = false,
}: ChatBubbleProps) {
  const { colors, isDark } = useTheme();
  const isUser = message.role === "user";
  const providerLabel = message.provider
    ? PROVIDER_LABELS[message.provider]
    : null;

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
            {message.model}
          </Text>
        </View>
      )}
      <Text
        selectable={selectable}
        style={[
          styles.content,
          { color: isUser ? "#F5FBFF" : colors.text },
        ]}
      >
        {message.content}
      </Text>
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
  wrapper: { marginVertical: 5, paddingHorizontal: 18 },
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
});
