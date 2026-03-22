import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import uuid from "react-native-uuid";
import {
  Conversation,
  ConversationMeta,
  Message,
  Provider,
  UsageEstimate,
} from "../../types";
import { normalizeConversationTitle, truncateConversationTitle } from "./meta";
import {
  readConversation,
  removeConversation,
  saveConversation,
} from "./storage";

export function useConversationMutations(params: {
  activeConversationRef: MutableRefObject<Conversation | null>;
  persistMetas: (metas: ConversationMeta[]) => ConversationMeta[];
  setActiveConversationValue: (conversation: Conversation | null) => void;
  setConversations: Dispatch<SetStateAction<ConversationMeta[]>>;
}) {
  const {
    activeConversationRef,
    persistMetas,
    setActiveConversationValue,
    setConversations,
  } = params;

  const createConversation = useCallback(
    (
      firstMessage: string,
      initialModel: string | null = null,
      initialProvider: Provider | null = null,
    ) => {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: uuid.v4() as string,
        title: truncateConversationTitle(firstMessage),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      const meta: ConversationMeta = {
        id: conversation.id,
        title: conversation.title,
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

      setConversations((previous) => persistMetas([meta, ...previous]));
      saveConversation(conversation);
      setActiveConversationValue(conversation);
    },
    [persistMetas, setActiveConversationValue, setConversations],
  );

  const selectConversation = useCallback(
    async (id: string) => {
      const conversation = await readConversation(id);

      if (conversation) {
        setActiveConversationValue(conversation);
      }
    },
    [setActiveConversationValue],
  );

  const getConversationById = useCallback(
    async (id: string) => {
      if (activeConversationRef.current?.id === id) {
        return activeConversationRef.current;
      }

      return readConversation(id);
    },
    [activeConversationRef],
  );

  const addMessage = useCallback(
    (messageInput: Omit<Message, "id" | "timestamp">) => {
      const currentConversation = activeConversationRef.current;

      if (!currentConversation) {
        return;
      }

      const message: Message = {
        ...messageInput,
        id: uuid.v4() as string,
        timestamp: new Date().toISOString(),
      };
      const updatedConversation: Conversation = {
        ...currentConversation,
        updatedAt: message.timestamp,
        messages: [...currentConversation.messages, message],
      };
      const lastModel = messageInput.model ?? undefined;
      const lastProvider = messageInput.provider ?? undefined;

      setActiveConversationValue(updatedConversation);
      saveConversation(updatedConversation);
      setConversations((previous) =>
        persistMetas(
          previous.map((meta) =>
            meta.id === updatedConversation.id
              ? {
                  ...meta,
                  createdAt: updatedConversation.createdAt,
                  updatedAt: updatedConversation.updatedAt,
                  messageCount: updatedConversation.messages.length,
                  providers:
                    messageInput.provider && !meta.providers.includes(messageInput.provider)
                      ? [...meta.providers, messageInput.provider]
                      : meta.providers,
                  providerModels:
                    messageInput.provider && messageInput.model
                      ? {
                          ...meta.providerModels,
                          [messageInput.provider]: (
                            meta.providerModels[messageInput.provider] ?? []
                          ).includes(messageInput.model)
                            ? meta.providerModels[messageInput.provider]
                            : [
                                ...(meta.providerModels[messageInput.provider] ?? []),
                                messageInput.model,
                              ],
                        }
                      : meta.providerModels,
                  ...(lastModel !== undefined ? { lastModel } : {}),
                  ...(lastProvider !== undefined ? { lastProvider } : {}),
                }
              : meta,
          ),
        ),
      );
    },
    [activeConversationRef, persistMetas, setActiveConversationValue, setConversations],
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
      const updatedConversation: Conversation = {
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

      setActiveConversationValue(updatedConversation);
      saveConversation(updatedConversation);
    },
    [activeConversationRef, setActiveConversationValue],
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
    [activeConversationRef, getConversationById, setActiveConversationValue],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      void removeConversation(id);
      setConversations((previous) => persistMetas(previous.filter((entry) => entry.id !== id)));

      if (activeConversationRef.current?.id === id) {
        setActiveConversationValue(null);
      }
    },
    [activeConversationRef, persistMetas, setActiveConversationValue, setConversations],
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

      setConversations((previous) =>
        persistMetas(
          previous.map((conversation) =>
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
    [activeConversationRef, getConversationById, persistMetas, setActiveConversationValue, setConversations],
  );

  const toggleConversationPinned = useCallback(
    (id: string) => {
      let nextPinned = false;

      setConversations((previous) =>
        persistMetas(
          previous.map((conversation) => {
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
    [persistMetas, setConversations],
  );

  const clearActiveConversation = useCallback(() => {
    setActiveConversationValue(null);
  }, [setActiveConversationValue]);

  return {
    addMessage,
    clearActiveConversation,
    clearConversationMemory,
    createConversation,
    deleteConversation,
    getConversationById,
    renameConversation,
    selectConversation,
    toggleConversationPinned,
    updateConversationContextSummary,
  };
}
