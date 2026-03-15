import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import { Conversation, ConversationMeta, Message, Provider } from "../types";

const META_KEY = "@schnack/conversations";
const conversationKey = (id: string) => `@schnack/conversation/${id}`;

function truncateTitle(text: string, max = 40): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

function inferLastAssistantState(messages: Message[]) {
  let lastModel: string | null = null;
  let lastProvider: Provider | null = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];

    if (!lastModel && candidate.model) {
      lastModel = candidate.model;
    }

    if (!lastProvider && candidate.provider) {
      lastProvider = candidate.provider;
    }

    if (lastModel && lastProvider) {
      break;
    }
  }

  return { lastModel, lastProvider };
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
          const normalizedMeta: ConversationMeta = {
            ...meta,
            lastProvider: meta.lastProvider ?? null,
          };

          if (normalizedMeta.lastModel && normalizedMeta.lastProvider) {
            return normalizedMeta;
          }

          const conversationRaw = await AsyncStorage.getItem(conversationKey(meta.id));

          if (!conversationRaw) {
            return normalizedMeta;
          }

          const conversation = JSON.parse(conversationRaw) as Conversation;
          const inferredState = inferLastAssistantState(conversation.messages);

          if (!inferredState.lastModel && !inferredState.lastProvider) {
            return normalizedMeta;
          }

          return {
            ...normalizedMeta,
            updatedAt: conversation.updatedAt,
            lastModel: inferredState.lastModel ?? normalizedMeta.lastModel,
            lastProvider: inferredState.lastProvider ?? normalizedMeta.lastProvider,
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

  const createConversation = useCallback((
    firstMessage: string,
    initialModel: string | null = null,
    initialProvider: Provider | null = null
  ) => {
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
      lastProvider: initialProvider,
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

  const getConversationById = useCallback(async (id: string) => {
    if (activeConversationRef.current?.id === id) {
      return activeConversationRef.current;
    }

    const raw = await AsyncStorage.getItem(conversationKey(id));
    return raw ? (JSON.parse(raw) as Conversation) : null;
  }, []);

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
    const lastProvider = msg.provider ?? undefined;
    setConversations((prev) => {
      const next = prev.map((m) =>
        m.id === updated.id
          ? {
              ...m,
              updatedAt: updated.updatedAt,
              ...(lastModel !== undefined ? { lastModel } : {}),
              ...(lastProvider !== undefined ? { lastProvider } : {}),
            }
          : m
      );
      AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      return next;
    });
  }, [saveConversation, setActiveConversationValue]);

  const updateConversationContextSummary = useCallback(
    (contextSummary: string, summarizedMessageCount: number) => {
      const currentConversation = activeConversationRef.current;

      if (!currentConversation) {
        return;
      }

      const updated: Conversation = {
        ...currentConversation,
        contextSummary: contextSummary.trim(),
        summarizedMessageCount,
      };

      setActiveConversationValue(updated);
      saveConversation(updated);
    },
    [saveConversation, setActiveConversationValue]
  );

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
    getConversationById,
    addMessage,
    updateConversationContextSummary,
    deleteConversation,
    clearActiveConversation,
  };
}
