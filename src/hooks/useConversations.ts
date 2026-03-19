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

function inferConversationState(messages: Message[]) {
  let lastModel: string | null = null;
  let lastProvider: Provider | null = null;
  const providers: Provider[] = [];
  const seenProviders = new Set<Provider>();
  const providerModels: Partial<Record<Provider, string[]>> = {};
  const seenProviderModels = new Map<Provider, Set<string>>();

  for (const message of messages) {
    if (message.provider && !seenProviders.has(message.provider)) {
      seenProviders.add(message.provider);
      providers.push(message.provider);
    }

    if (message.provider && message.model) {
      const seenModels = seenProviderModels.get(message.provider) ?? new Set<string>();
      if (!seenModels.has(message.model)) {
        seenModels.add(message.model);
        seenProviderModels.set(message.provider, seenModels);
        providerModels[message.provider] = [
          ...(providerModels[message.provider] ?? []),
          message.model,
        ];
      }
    }
  }

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

  return {
    lastModel,
    lastProvider,
    providers,
    providerModels,
    messageCount: messages.length,
  };
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

function normalizeConversationMeta(meta: Partial<ConversationMeta>) {
  return {
    ...meta,
    id: meta.id ?? "",
    title: meta.title ?? "",
    createdAt: meta.createdAt ?? meta.updatedAt ?? new Date(0).toISOString(),
    updatedAt: meta.updatedAt ?? new Date(0).toISOString(),
    messageCount: meta.messageCount ?? 0,
    providers:
      meta.providers ??
      (meta.lastProvider ? [meta.lastProvider] : []),
    providerModels: meta.providerModels ?? {},
    lastModel: meta.lastModel ?? null,
    lastProvider: meta.lastProvider ?? null,
    pinned: meta.pinned ?? false,
  };
}

function conversationMetaNeedsHydration(meta: Partial<ConversationMeta>) {
  return (
    !meta.createdAt ||
    typeof meta.messageCount !== "number" ||
    !Array.isArray(meta.providers) ||
    typeof meta.providerModels !== "object" ||
    meta.providerModels === null
  );
}

function normalizeConversationTitle(title: string, fallback: string) {
  const trimmed = title.trim();

  if (!trimmed) {
    return fallback;
  }

  return truncateTitle(trimmed, 60);
}

function buildConversationMetaFromConversation(
  conversation: Conversation,
  existingMeta?: ConversationMeta | null,
): ConversationMeta {
  const inferredState = inferConversationState(conversation.messages);

  return normalizeConversationMeta({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: inferredState.messageCount,
    providers:
      inferredState.providers.length > 0
        ? inferredState.providers
        : existingMeta?.providers ?? [],
    providerModels:
      Object.keys(inferredState.providerModels).length > 0
        ? inferredState.providerModels
        : existingMeta?.providerModels ?? {},
    lastModel: inferredState.lastModel ?? existingMeta?.lastModel ?? null,
    lastProvider: inferredState.lastProvider ?? existingMeta?.lastProvider ?? null,
    pinned: existingMeta?.pinned ?? false,
  });
}

export interface ActiveConversationSnapshot {
  conversation: Conversation | null;
  meta: ConversationMeta | null;
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

  const hydrateConversationMetas = useCallback(
    async (metas: ConversationMeta[]) => {
      return Promise.all(
        metas.map(async (meta) => {
          const shouldHydrate =
            !meta.createdAt ||
            meta.messageCount === 0 ||
            meta.providers.length === 0 ||
            Object.keys(meta.providerModels ?? {}).length === 0;

          if (!shouldHydrate) {
            return meta;
          }

          const conversationRaw = await AsyncStorage.getItem(
            conversationKey(meta.id),
          );

          if (!conversationRaw) {
            return meta;
          }

          try {
            const conversation = JSON.parse(conversationRaw) as Conversation;
            return buildConversationMetaFromConversation(conversation, meta);
          } catch {
            return meta;
          }
        }),
      );
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

      let storedMetas: ConversationMeta[];

      try {
        storedMetas = JSON.parse(raw) as ConversationMeta[];
      } catch {
        storedMetas = [];
      }
      const normalizedMetas = await Promise.all(
        storedMetas.map(async (meta) => {
          const needsHydration = conversationMetaNeedsHydration(meta);
          const normalizedMeta = normalizeConversationMeta(meta);

          if (!needsHydration) {
            return normalizedMeta;
          }

          const conversationRaw = await AsyncStorage.getItem(
            conversationKey(meta.id),
          );

          if (!conversationRaw) {
            return normalizedMeta;
          }

          let conversation: Conversation;

          try {
            conversation = JSON.parse(conversationRaw) as Conversation;
          } catch {
            return normalizedMeta;
          }

          return buildConversationMetaFromConversation(
            conversation,
            normalizedMeta,
          );
        }),
      );

      const hydratedMetas = await hydrateConversationMetas(normalizedMetas);

      if (cancelled) {
        return;
      }

      const sortedMetas = sortConversationMeta(hydratedMetas);
      setConversations(sortedMetas);

      if (JSON.stringify(sortedMetas) !== JSON.stringify(storedMetas)) {
        AsyncStorage.setItem(META_KEY, JSON.stringify(sortedMetas));
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [hydrateConversationMetas]);

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

  useEffect(() => {
    let cancelled = false;

    if (
      conversations.length === 0 ||
      !conversations.some(
        (conversation) =>
          conversation.messageCount === 0 || conversation.providers.length === 0,
      )
    ) {
      return;
    }

    void (async () => {
      const hydratedMetas = await hydrateConversationMetas(conversations);

      if (cancelled) {
        return;
      }

      if (JSON.stringify(hydratedMetas) === JSON.stringify(conversations)) {
        return;
      }

      setConversations(persistConversationMeta(hydratedMetas));
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations, hydrateConversationMetas, persistConversationMeta]);

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
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        providers: initialProvider ? [initialProvider] : [],
        providerModels:
          initialProvider && initialModel
            ? { [initialProvider]: [initialModel] }
            : {},
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
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
                messageCount: updated.messages.length,
                providers:
                  msg.provider && !m.providers.includes(msg.provider)
                    ? [...m.providers, msg.provider]
                    : m.providers,
                providerModels:
                  msg.provider && msg.model
                    ? {
                        ...m.providerModels,
                        [msg.provider]: (
                          m.providerModels[msg.provider] ?? []
                        ).includes(msg.model)
                          ? m.providerModels[msg.provider]
                          : [...(m.providerModels[msg.provider] ?? []), msg.model],
                      }
                    : m.providerModels,
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
          const providerLabels = (conversationMeta.providers ?? [])
            .map((provider) => PROVIDER_LABELS[provider])
            .join(" ");
          const lastProviderLabel = conversationMeta.lastProvider
            ? PROVIDER_LABELS[conversationMeta.lastProvider]
            : "";
          const metadataHaystack = [
            conversationMeta.title,
            conversationMeta.lastModel ?? "",
            lastProviderLabel,
            providerLabels,
            ...Object.values(conversationMeta.providerModels ?? {}).flat(),
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

  const captureActiveConversationSnapshot =
    useCallback((): ActiveConversationSnapshot => {
      const conversation = activeConversationRef.current;
      const meta = conversation
        ? conversations.find((entry) => entry.id === conversation.id) ?? null
        : null;

      return {
        conversation: conversation
          ? JSON.parse(JSON.stringify(conversation))
          : null,
        meta: meta ? { ...meta } : null,
      };
    }, [conversations]);

  const restoreActiveConversationSnapshot = useCallback(
    async (snapshot: ActiveConversationSnapshot) => {
      const currentConversation = activeConversationRef.current;

      if (!snapshot.conversation) {
        if (currentConversation) {
          await AsyncStorage.removeItem(conversationKey(currentConversation.id));
          setConversations((prev) =>
            persistConversationMeta(
              prev.filter((entry) => entry.id !== currentConversation.id),
            ),
          );
        }

        setActiveConversationValue(null);
        return;
      }

      const restoredConversation = snapshot.conversation;
      const restoredMeta = buildConversationMetaFromConversation(
        restoredConversation,
        snapshot.meta,
      );

      if (currentConversation && currentConversation.id !== restoredConversation.id) {
        await AsyncStorage.removeItem(conversationKey(currentConversation.id));
      }

      saveConversation(restoredConversation);
      setActiveConversationValue(restoredConversation);
      setConversations((prev) =>
        persistConversationMeta([
          ...prev.filter(
            (entry) =>
              entry.id !== restoredConversation.id &&
              entry.id !== currentConversation?.id,
          ),
          restoredMeta,
        ]),
      );
    },
    [persistConversationMeta, saveConversation, setActiveConversationValue],
  );

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
    captureActiveConversationSnapshot,
    restoreActiveConversationSnapshot,
  };
}
