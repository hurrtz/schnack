import { useCallback, useRef, useState } from "react";

import { Conversation, Provider } from "../../types";

export function useMainScreenUiState() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsFocusProvider, setSettingsFocusProvider] = useState<
    Provider | undefined
  >();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [statusDetailsVisible, setStatusDetailsVisible] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [setupGuideVisible, setSetupGuideVisible] = useState(false);
  const [memoryConversation, setMemoryConversation] =
    useState<Conversation | null>(null);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const pendingDrawerDismissActionRef = useRef<null | (() => void)>(null);

  const openSettings = useCallback((focusProvider?: Provider) => {
    setSettingsFocusProvider(focusProvider);
    setSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
    setSettingsFocusProvider(undefined);
  }, []);

  const openMemoryConversation = useCallback((conversation: Conversation) => {
    setMemoryConversation(conversation);
    setMemoryVisible(true);
  }, []);

  const closeMemory = useCallback(() => {
    setMemoryVisible(false);
    setMemoryConversation(null);
  }, []);

  const openTranscript = useCallback(() => {
    setConversationMenuVisible(false);
    setTranscriptVisible(true);
  }, []);

  const closeTranscript = useCallback(() => {
    setConversationMenuVisible(false);
    setTranscriptVisible(false);
  }, []);

  const openStatusDetails = useCallback(() => {
    setStatusDetailsVisible(true);
  }, []);

  const closeStatusDetails = useCallback(() => {
    setStatusDetailsVisible(false);
  }, []);

  const closeConversationMenu = useCallback(() => {
    setConversationMenuVisible(false);
  }, []);

  const toggleConversationMenu = useCallback(() => {
    setConversationMenuVisible((previous) => !previous);
  }, []);

  const runAfterDrawerDismiss = useCallback(
    (action: () => void) => {
      if (!drawerVisible) {
        action();
        return;
      }

      pendingDrawerDismissActionRef.current = action;
      setDrawerVisible(false);
    },
    [drawerVisible],
  );

  const handleDrawerDismiss = useCallback(() => {
    const pendingAction = pendingDrawerDismissActionRef.current;
    pendingDrawerDismissActionRef.current = null;
    pendingAction?.();
  }, []);

  return {
    settingsVisible,
    settingsFocusProvider,
    drawerVisible,
    statusDetailsVisible,
    transcriptVisible,
    conversationMenuVisible,
    setupGuideVisible,
    memoryConversation,
    memoryVisible,
    setDrawerVisible,
    setSetupGuideVisible,
    setMemoryConversation,
    openSettings,
    closeSettings,
    openMemoryConversation,
    closeMemory,
    openTranscript,
    closeTranscript,
    openStatusDetails,
    closeStatusDetails,
    closeConversationMenu,
    toggleConversationMenu,
    runAfterDrawerDismiss,
    handleDrawerDismiss,
  };
}
