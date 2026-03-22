import { useState, useEffect, useCallback, useRef } from "react";
import { Conversation, ConversationMeta } from "../types";
import { persistConversationMeta } from "./conversations/storage";
import { useConversationHydration } from "./conversations/useConversationHydration";
import { useConversationMutations } from "./conversations/useConversationMutations";
import {
  ActiveConversationSnapshot,
  useConversationSnapshots,
} from "./conversations/useConversationSnapshots";
import { useConversationSearch } from "./conversations/useConversationSearch";

export type { ActiveConversationSnapshot };

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
  const persistMetas = useCallback((metas: ConversationMeta[]) => {
    return persistConversationMeta(metas);
  }, []);

  useConversationHydration({
    conversations,
    setConversations,
  });

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

  const {
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
  } = useConversationMutations({
    activeConversationRef,
    persistMetas,
    setActiveConversationValue,
    setConversations,
  });
  const { searchConversations } = useConversationSearch({
    conversations,
    getConversationById,
  });
  const {
    captureActiveConversationSnapshot,
    restoreActiveConversationSnapshot,
  } = useConversationSnapshots({
    activeConversationRef,
    conversations,
    persistMetas,
    setActiveConversationValue,
    setConversations,
  });

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
