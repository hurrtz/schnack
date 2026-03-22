import React from "react";

import { ConversationMeta } from "../../types";

interface UseConversationDrawerControllerParams {
  visible: boolean;
  conversations: ConversationMeta[];
  onSearchConversations: (query: string) => Promise<ConversationMeta[]>;
  onRenameThread: (id: string, title: string) => void;
  onSelect: (id: string) => Promise<void> | void;
  onNewSession: () => Promise<void> | void;
  onClose: () => void;
}

export function useConversationDrawerController({
  visible,
  conversations,
  onSearchConversations,
  onRenameThread,
  onSelect,
  onNewSession,
  onClose,
}: UseConversationDrawerControllerParams) {
  const [editingConversationId, setEditingConversationId] = React.useState<
    string | null
  >(null);
  const [actionConversationId, setActionConversationId] = React.useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredConversations, setFilteredConversations] = React.useState<
    ConversationMeta[]
  >(conversations);

  const visibleConversations = searchQuery.trim()
    ? filteredConversations
    : conversations;
  const actionConversation = React.useMemo(
    () =>
      actionConversationId
        ? conversations.find((conversation) => conversation.id === actionConversationId) ??
          null
        : null,
    [actionConversationId, conversations],
  );

  React.useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setFilteredConversations(conversations);
      setActionConversationId(null);
      setEditingConversationId(null);
      setEditingTitle("");
      return;
    }

    const normalizedQuery = searchQuery.trim();

    if (!normalizedQuery) {
      setFilteredConversations(conversations);
      return;
    }

    let cancelled = false;

    void onSearchConversations(normalizedQuery).then((results) => {
      if (!cancelled) {
        setFilteredConversations(results);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversations, onSearchConversations, searchQuery, visible]);

  const clearSearch = React.useCallback(() => {
    setSearchQuery("");
  }, []);

  const closeRenameModal = React.useCallback(() => {
    setEditingConversationId(null);
    setEditingTitle("");
  }, []);

  const closeActionModal = React.useCallback(() => {
    setActionConversationId(null);
  }, []);

  const openActionConversation = React.useCallback((conversationId: string) => {
    setActionConversationId(conversationId);
  }, []);

  const openRenameModal = React.useCallback((conversation: ConversationMeta) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
    setActionConversationId(null);
  }, []);

  const submitRename = React.useCallback(() => {
    if (!editingConversationId || !editingTitle.trim()) {
      return;
    }

    onRenameThread(editingConversationId, editingTitle);
    closeRenameModal();
  }, [closeRenameModal, editingConversationId, editingTitle, onRenameThread]);

  const handleSelectConversation = React.useCallback(
    (conversationId: string) => {
      void (async () => {
        await onSelect(conversationId);
        onClose();
      })();
    },
    [onClose, onSelect],
  );

  const handleNewSession = React.useCallback(() => {
    void (async () => {
      await onNewSession();
      onClose();
    })();
  }, [onClose, onNewSession]);

  return {
    actionConversation,
    clearSearch,
    closeActionModal,
    closeRenameModal,
    editingConversationId,
    editingTitle,
    handleNewSession,
    handleSelectConversation,
    openActionConversation,
    openRenameModal,
    searchQuery,
    setEditingTitle,
    setSearchQuery,
    submitRename,
    visibleConversations,
  };
}
