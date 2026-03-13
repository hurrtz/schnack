import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import { Conversation, ConversationMeta, Message } from "../types";

const META_KEY = "@voxai/conversations";
const conversationKey = (id: string) => `@voxai/conversation/${id}`;

function truncateTitle(text: string, max = 40): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(META_KEY).then((raw) => {
      if (raw) setConversations(JSON.parse(raw));
    });
  }, []);

  const saveMeta = useCallback((metas: ConversationMeta[]) => {
    setConversations(metas);
    AsyncStorage.setItem(META_KEY, JSON.stringify(metas));
  }, []);

  const saveConversation = useCallback((conv: Conversation) => {
    AsyncStorage.setItem(conversationKey(conv.id), JSON.stringify(conv));
  }, []);

  const createConversation = useCallback((firstMessage: string) => {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: uuid.v4() as string,
      title: truncateTitle(firstMessage),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const meta: ConversationMeta = { id: conv.id, title: conv.title, updatedAt: now, lastModel: null };
    saveMeta([meta, ...conversations]);
    saveConversation(conv);
    setActiveConversation(conv);
  }, [conversations, saveMeta, saveConversation]);

  const selectConversation = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(conversationKey(id));
    if (raw) setActiveConversation(JSON.parse(raw));
  }, []);

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    if (!activeConversation) return;
    const message: Message = {
      ...msg,
      id: uuid.v4() as string,
      timestamp: new Date().toISOString(),
    };
    const updated: Conversation = {
      ...activeConversation,
      updatedAt: message.timestamp,
      messages: [...activeConversation.messages, message],
    };
    setActiveConversation(updated);
    saveConversation(updated);
    const lastModel = msg.role === "assistant" ? msg.model : undefined;
    setConversations((prev) => {
      const next = prev.map((m) =>
        m.id === updated.id
          ? { ...m, updatedAt: updated.updatedAt, ...(lastModel !== undefined ? { lastModel } : {}) }
          : m
      );
      AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeConversation, saveConversation]);

  const deleteConversation = useCallback((id: string) => {
    AsyncStorage.removeItem(conversationKey(id));
    const next = conversations.filter((c) => c.id !== id);
    saveMeta(next);
    if (activeConversation?.id === id) setActiveConversation(null);
  }, [conversations, activeConversation, saveMeta]);

  const clearActiveConversation = useCallback(() => { setActiveConversation(null); }, []);

  return {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    addMessage,
    deleteConversation,
    clearActiveConversation,
  };
}
