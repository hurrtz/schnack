import React, { useRef, useEffect } from "react";
import { FlatList, StyleSheet } from "react-native";
import { ChatBubble } from "./ChatBubble";
import { Message } from "../types";

interface ChatTranscriptProps {
  messages: Message[];
  onTap?: () => void;
}

export function ChatTranscript({ messages, onTap }: ChatTranscriptProps) {
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
      renderItem={({ item }) => <ChatBubble message={item} />}
      contentContainerStyle={styles.list}
      onTouchStart={onTap}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8 },
});
