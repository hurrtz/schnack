import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import { PROVIDER_LABELS } from "../constants/models";
import {
  Conversation,
  ConversationMeta,
  Message,
  Provider,
  UsageEstimate,
} from "../types";

const META_KEY = "@schnackai/conversations";
const conversationKey = (id: string) => `@schnackai/conversation/${id}`;

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

function compareConversationMeta(
  left: ConversationMeta,
  right: ConversationMeta,
) {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function sortConversationMeta(conversations: ConversationMeta[]) {
  return [...conversations].sort(compareConversationMeta);
}

function normalizeConversationMeta(meta: ConversationMeta) {
  return {
    ...meta,
    lastProvider: meta.lastProvider ?? null,
    pinned: meta.pinned ?? false,
  };
}

function normalizeConversationTitle(title: string, fallback: string) {
  const trimmed = title.trim();

  if (!trimmed) {
    return fallback;
  }

  return truncateTitle(trimmed, 60);
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const activeConversationRef = useRef<Conversation | null>(null);
  const setActiveConversationValue = useCallback(
    (conversation: Conversation | null) => {
      activeConversationRef.current = conversation;
      setActiveConversation(conversation);
    },
    [],
  );

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
          const normalizedMeta = normalizeConversationMeta(meta);

          if (normalizedMeta.lastModel && normalizedMeta.lastProvider) {
            return normalizedMeta;
          }

          const conversationRaw = await AsyncStorage.getItem(
            conversationKey(meta.id),
          );

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
            lastProvider:
              inferredState.lastProvider ?? normalizedMeta.lastProvider,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const sortedMetas = sortConversationMeta(normalizedMetas);
      setConversations(sortedMetas);

      if (JSON.stringify(sortedMetas) !== JSON.stringify(storedMetas)) {
        AsyncStorage.setItem(META_KEY, JSON.stringify(sortedMetas));
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeConversation || conversations.length === 0) {
      return;
    }

    const existsInMeta = conversations.some(
      (conversation) => conversation.id === activeConversation.id,
    );

    if (!existsInMeta) {
      setActiveConversationValue(null);
    }
  }, [activeConversation, conversations, setActiveConversationValue]);

  const saveConversation = useCallback((conv: Conversation) => {
    AsyncStorage.setItem(conversationKey(conv.id), JSON.stringify(conv));
  }, []);

  const persistConversationMeta = useCallback((metas: ConversationMeta[]) => {
    const sortedMetas = sortConversationMeta(
      metas.map(normalizeConversationMeta),
    );
    AsyncStorage.setItem(META_KEY, JSON.stringify(sortedMetas));
    return sortedMetas;
  }, []);

  const createConversation = useCallback(
    (
      firstMessage: string,
      initialModel: string | null = null,
      initialProvider: Provider | null = null,
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
        pinned: false,
      };
      setConversations((prev) => {
        return persistConversationMeta([meta, ...prev]);
      });
      saveConversation(conv);
      setActiveConversationValue(conv);
    },
    [persistConversationMeta, saveConversation, setActiveConversationValue],
  );

  const selectConversation = useCallback(
    async (id: string) => {
      const raw = await AsyncStorage.getItem(conversationKey(id));
      if (raw) {
        setActiveConversationValue(JSON.parse(raw));
      }
    },
    [setActiveConversationValue],
  );

  const getConversationById = useCallback(async (id: string) => {
    if (activeConversationRef.current?.id === id) {
      return activeConversationRef.current;
    }

    const raw = await AsyncStorage.getItem(conversationKey(id));
    return raw ? (JSON.parse(raw) as Conversation) : null;
  }, []);

  const addMessage = useCallback(
    (msg: Omit<Message, "id" | "timestamp">) => {
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
            : m,
        );
        return persistConversationMeta(next);
      });
    },
    [persistConversationMeta, saveConversation, setActiveConversationValue],
  );

  const updateConversationContextSummary = useCallback(
    (
      contextSummary: string,
      summarizedMessageCount: number,
      usage?: UsageEstimate,
      usageModel?: string | null,
      usageProvider?: Provider | null,
    ) => {
      const currentConversation = activeConversationRef.current;

      if (!currentConversation) {
        return;
      }

      const lastMessage =
        currentConversation.messages[currentConversation.messages.length - 1];

      const updated: Conversation = {
        ...currentConversation,
        contextSummary: contextSummary.trim(),
        summarizedMessageCount,
        usageEvents: usage
          ? [
              ...(currentConversation.usageEvents ?? []),
              {
                id: uuid.v4() as string,
                kind: "context-summary",
                model: usageModel ?? lastMessage?.model ?? null,
                provider: usageProvider ?? lastMessage?.provider ?? null,
                timestamp: new Date().toISOString(),
                usage,
              },
            ]
          : currentConversation.usageEvents,
      };

      setActiveConversationValue(updated);
      saveConversation(updated);
    },
    [saveConversation, setActiveConversationValue],
  );

  const clearConversationMemory = useCallback(
    async (id: string) => {
      const currentConversation =
        activeConversationRef.current?.id === id
          ? activeConversationRef.current
          : await getConversationById(id);

      if (!currentConversation) {
        return null;
      }

      const updatedConversation: Conversation = {
        ...currentConversation,
      };

      delete updatedConversation.contextSummary;
      delete updatedConversation.summarizedMessageCount;

      saveConversation(updatedConversation);

      if (activeConversationRef.current?.id === id) {
        setActiveConversationValue(updatedConversation);
      }

      return updatedConversation;
    },
    [getConversationById, saveConversation, setActiveConversationValue],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      AsyncStorage.removeItem(conversationKey(id));
      setConversations((prev) => {
        return persistConversationMeta(prev.filter((c) => c.id !== id));
      });
      if (
        activeConversation?.id === id ||
        activeConversationRef.current?.id === id
      ) {
        setActiveConversationValue(null);
      }
    },
    [
      activeConversation?.id,
      persistConversationMeta,
      setActiveConversationValue,
    ],
  );

  const renameConversation = useCallback(
    async (id: string, nextTitle: string) => {
      const currentConversation =
        activeConversationRef.current?.id === id
          ? activeConversationRef.current
          : await getConversationById(id);

      if (!currentConversation) {
        return;
      }

      const title = normalizeConversationTitle(
        nextTitle,
        currentConversation.title,
      );
      const updatedConversation: Conversation = {
        ...currentConversation,
        title,
      };

      saveConversation(updatedConversation);

      if (activeConversationRef.current?.id === id) {
        setActiveConversationValue(updatedConversation);
      }

      setConversations((prev) =>
        persistConversationMeta(
          prev.map((conversation) =>
            conversation.id === id
              ? {
                  ...conversation,
                  title,
                }
              : conversation,
          ),
        ),
      );
    },
    [
      getConversationById,
      persistConversationMeta,
      saveConversation,
      setActiveConversationValue,
    ],
  );

  const toggleConversationPinned = useCallback(
    (id: string) => {
      let nextPinned = false;

      setConversations((prev) =>
        persistConversationMeta(
          prev.map((conversation) => {
            if (conversation.id !== id) {
              return conversation;
            }

            nextPinned = !conversation.pinned;
            return {
              ...conversation,
              pinned: nextPinned,
            };
          }),
        ),
      );

      return nextPinned;
    },
    [persistConversationMeta],
  );

  const searchConversations = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return conversations;
      }

      const matches = await Promise.all(
        conversations.map(async (conversationMeta) => {
          const providerLabel = conversationMeta.lastProvider
            ? PROVIDER_LABELS[conversationMeta.lastProvider]
            : "";
          const metadataHaystack = [
            conversationMeta.title,
            conversationMeta.lastModel ?? "",
            providerLabel,
          ]
            .join(" ")
            .toLowerCase();

          if (metadataHaystack.includes(normalizedQuery)) {
            return conversationMeta;
          }

          const conversation = await getConversationById(conversationMeta.id);

          if (!conversation) {
            return null;
          }

          const conversationHaystack = [
            conversation.contextSummary ?? "",
            ...conversation.messages.map((message) => message.content),
          ]
            .join(" ")
            .toLowerCase();

          return conversationHaystack.includes(normalizedQuery)
            ? conversationMeta
            : null;
        }),
      );

      return sortConversationMeta(
        matches.filter(
          (conversation): conversation is ConversationMeta =>
            conversation !== null,
        ),
      );
    },
    [conversations, getConversationById],
  );

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
    clearConversationMemory,
    renameConversation,
    toggleConversationPinned,
    searchConversations,
    deleteConversation,
    clearActiveConversation,
  };
}
