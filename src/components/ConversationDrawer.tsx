import React from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { ConversationActionSheet } from "./conversationDrawer/ConversationActionSheet";
import { ConversationDrawerHeader } from "./conversationDrawer/ConversationDrawerHeader";
import { ConversationDrawerList } from "./conversationDrawer/ConversationDrawerList";
import { ConversationRenameModal } from "./conversationDrawer/ConversationRenameModal";
import { styles } from "./conversationDrawer/styles";
import { ConversationDrawerProps } from "./conversationDrawer/types";
import { useConversationDrawerController } from "./conversationDrawer/useConversationDrawerController";

export function ConversationDrawer({
  visible,
  conversations,
  activeId,
  onSearchConversations,
  onSelect,
  onCopyThread,
  onShareThread,
  onManageMemory,
  onRenameThread,
  onTogglePinned,
  onNewSession,
  onDelete,
  onClose,
  onDismiss,
}: ConversationDrawerProps) {
  const { colors } = useTheme();
  const controller = useConversationDrawerController({
    visible,
    conversations,
    onClose,
    onNewSession,
    onRenameThread,
    onSearchConversations,
    onSelect,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onDismiss={onDismiss}>
      <View style={styles.container}>
        <View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.drawerGlow}
          />

          <ConversationDrawerHeader
            searchQuery={controller.searchQuery}
            onChangeSearchQuery={controller.setSearchQuery}
            onClearSearch={controller.clearSearch}
            onClose={onClose}
            onNewSession={controller.handleNewSession}
          />
          <ConversationDrawerList
            activeId={activeId}
            conversations={controller.visibleConversations}
            searchQuery={controller.searchQuery}
            onDeleteConversation={onDelete}
            onOpenActionConversation={controller.openActionConversation}
            onSelectConversation={controller.handleSelectConversation}
          />
        </View>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>

      <ConversationActionSheet
        conversation={controller.actionConversation}
        onClose={controller.closeActionModal}
        onCopyThread={onCopyThread}
        onDelete={onDelete}
        onManageMemory={onManageMemory}
        onOpenRenameModal={controller.openRenameModal}
        onShareThread={onShareThread}
        onTogglePinned={onTogglePinned}
      />
      <ConversationRenameModal
        visible={controller.editingConversationId !== null}
        editingTitle={controller.editingTitle}
        onChangeEditingTitle={controller.setEditingTitle}
        onClose={controller.closeRenameModal}
        onSubmit={controller.submitRename}
      />
    </Modal>
  );
}
