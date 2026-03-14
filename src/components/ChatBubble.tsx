import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  const bubbleContent = (
    <>
      {!isUser && message.model && (
        <Text style={[styles.modelLabel, { color: colors.accent }]}>{message.model}</Text>
      )}
      <Text style={[styles.content, { color: colors.text }]}>{message.content}</Text>
    </>
  );

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {isUser ? (
        <LinearGradient
          colors={["rgba(74, 158, 255, 0.25)", "rgba(74, 158, 255, 0.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleUser, { shadowColor: "rgba(74, 158, 255, 0.3)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3 }]}
        >
          {bubbleContent}
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.surfaceElevated, shadowColor: "rgba(0, 0, 0, 0.4)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 }]}>
          {bubbleContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 3, paddingHorizontal: 16 },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  modelLabel: { fontSize: 10, fontWeight: "500", letterSpacing: 0.5, marginBottom: 3 },
  content: { fontSize: 14, lineHeight: 20 },
});
