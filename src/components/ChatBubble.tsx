import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.bubbleUser }]
            : [
                styles.bubbleAssistant,
                { backgroundColor: colors.bubbleAssistant },
              ],
        ]}
      >
        {!isUser && message.model && (
          <Text style={[styles.modelLabel, { color: colors.textSecondary }]}>
            {message.model}
          </Text>
        )}
        <Text style={[styles.content, { color: colors.text }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 3, paddingHorizontal: 16 },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 12 },
  bubbleUser: { borderBottomRightRadius: 2 },
  bubbleAssistant: { borderBottomLeftRadius: 2 },
  modelLabel: { fontSize: 10, marginBottom: 2 },
  content: { fontSize: 14, lineHeight: 20 },
});
