import React, { useRef, useEffect } from "react";
import {
  FlatList,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ChatBubble } from "./ChatBubble";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Message } from "../types";

interface ChatTranscriptProps {
  messages: Message[];
  onTap?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  onCopyMessage?: (message: Message) => void;
}

export function ChatTranscript({
  messages,
  onTap,
  emptyTitle = "Your conversation appears here",
  emptyDescription = "Press and hold the voice control, then speak naturally. schnack will keep the thread and speak back.",
  contentContainerStyle,
  scrollEnabled = true,
  onCopyMessage,
}: ChatTranscriptProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ChatBubble message={item} onCopy={onCopyMessage} />
      )}
      contentContainerStyle={[
        styles.list,
        messages.length === 0 ? styles.listEmpty : null,
        contentContainerStyle,
      ]}
      ListEmptyComponent={
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.accentSoft, borderColor: colors.border },
            ]}
          >
            <Feather name="mic" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {emptyTitle}
          </Text>
          <Text
            style={[styles.emptyDescription, { color: colors.textSecondary }]}
          >
            {emptyDescription}
          </Text>
        </View>
      }
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      onTouchStart={onTap}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 10, paddingBottom: 24 },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: fonts.display,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
