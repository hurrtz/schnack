import { useState, useEffect, useCallback, useRef } from "react";
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

function inferLastModel(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.model) {
      return candidate.model;
    }
  }

  return null;
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const activeConversationRef = useRef<Conversation | null>(null);
  const setActiveConversationValue = useCallback((conversation: Conversation | null) => {
    activeConversationRef.current = conversation;
    setActiveConversation(conversation);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConversations = async () => {
      const raw = await AsyncStorage.getItem(META_KEY);

      if (!raw || cancelled) {
        return;
      }

      const storedMetas = JSON.parse(raw) as ConversationMeta[];
      const normalizedMetas = await Promise.all(
        storedMetas.map(async (meta) => {
          if (meta.lastModel) {
            return meta;
          }

          const conversationRaw = await AsyncStorage.getItem(conversationKey(meta.id));

          if (!conversationRaw) {
            return meta;
          }

          const conversation = JSON.parse(conversationRaw) as Conversation;
          const inferredLastModel = inferLastModel(conversation.messages);

          if (!inferredLastModel) {
            return meta;
          }

          return {
            ...meta,
            updatedAt: conversation.updatedAt,
            lastModel: inferredLastModel,
          };
        })
      );

      if (cancelled) {
        return;
      }

      setConversations(normalizedMetas);

      if (JSON.stringify(normalizedMetas) !== JSON.stringify(storedMetas)) {
        AsyncStorage.setItem(META_KEY, JSON.stringify(normalizedMetas));
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    const existsInMeta = conversations.some(
      (conversation) => conversation.id === activeConversation.id
    );

    if (!existsInMeta) {
      setActiveConversationValue(null);
    }
  }, [activeConversation, conversations, setActiveConversationValue]);

  const saveConversation = useCallback((conv: Conversation) => {
    AsyncStorage.setItem(conversationKey(conv.id), JSON.stringify(conv));
  }, []);

  const createConversation = useCallback((firstMessage: string, initialModel: string | null = null) => {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: uuid.v4() as string,
      title: truncateTitle(firstMessage),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const meta: ConversationMeta = {
      id: conv.id,
      title: conv.title,
      updatedAt: now,
      lastModel: initialModel,
    };
    setConversations((prev) => {
      const next = [meta, ...prev];
      AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      return next;
    });
    saveConversation(conv);
    setActiveConversationValue(conv);
  }, [saveConversation, setActiveConversationValue]);

  const selectConversation = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(conversationKey(id));
    if (raw) {
      setActiveConversationValue(JSON.parse(raw));
    }
  }, [setActiveConversationValue]);

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const currentConversation = activeConversationRef.current;

    if (!currentConversation) return;

    const message: Message = {
      ...msg,
      id: uuid.v4() as string,
      timestamp: new Date().toISOString(),
    };
    const updated: Conversation = {
      ...currentConversation,
      updatedAt: message.timestamp,
      messages: [...currentConversation.messages, message],
    };
    setActiveConversationValue(updated);
    saveConversation(updated);
    const lastModel = msg.model ?? undefined;
    setConversations((prev) => {
      const next = prev.map((m) =>
        m.id === updated.id
          ? { ...m, updatedAt: updated.updatedAt, ...(lastModel !== undefined ? { lastModel } : {}) }
          : m
      );
      AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      return next;
    });
  }, [saveConversation, setActiveConversationValue]);

  const deleteConversation = useCallback((id: string) => {
    AsyncStorage.removeItem(conversationKey(id));
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      return next;
    });
    if (activeConversation?.id === id || activeConversationRef.current?.id === id) {
      setActiveConversationValue(null);
    }
  }, [activeConversation?.id, setActiveConversationValue]);

  const clearActiveConversation = useCallback(() => {
    setActiveConversationValue(null);
  }, [setActiveConversationValue]);

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
