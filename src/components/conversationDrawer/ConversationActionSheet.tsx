import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { useLocalization } from "../../i18n";
import { useTheme } from "../../theme/ThemeContext";
import { ConversationMeta } from "../../types";

import { styles } from "./styles";

interface ConversationActionSheetProps {
  conversation: ConversationMeta | null;
  onClose: () => void;
  onCopyThread: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onManageMemory: (conversationId: string) => void;
  onOpenRenameModal: (conversation: ConversationMeta) => void;
  onShareThread: (conversationId: string) => void;
  onTogglePinned: (conversationId: string) => void;
}

export function ConversationActionSheet({
  conversation,
  onClose,
  onCopyThread,
  onDelete,
  onManageMemory,
  onOpenRenameModal,
  onShareThread,
  onTogglePinned,
}: ConversationActionSheetProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  if (!conversation) {
    return null;
  }

  return (
    <View style={styles.inlineActionOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.inlineActionBackdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          styles.actionSheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
        ]}
      >
        <Text style={[styles.actionSheetTitle, { color: colors.text }]}>
          {conversation.title}
        </Text>
        <Text
          style={[styles.actionSheetMeta, { color: colors.textSecondary }]}
        >
          {t("messageCount", {
            count: conversation.messageCount ?? 0,
          })}
        </Text>

        <TouchableOpacity
          testID="conversation-action-toggle-pin"
          style={[
            styles.actionSheetRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            onTogglePinned(conversation.id);
            onClose();
          }}
          activeOpacity={0.88}
        >
          <Feather name="bookmark" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.actionSheetRowText, { color: colors.textSecondary }]}
          >
            {conversation.pinned ? t("unpin") : t("pin")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="conversation-action-rename"
          style={[
            styles.actionSheetRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => onOpenRenameModal(conversation)}
          activeOpacity={0.88}
        >
          <Feather name="edit-3" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.actionSheetRowText, { color: colors.textSecondary }]}
          >
            {t("rename")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionSheetRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            onManageMemory(conversation.id);
            onClose();
          }}
          activeOpacity={0.88}
        >
          <Feather name="archive" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.actionSheetRowText, { color: colors.textSecondary }]}
          >
            {t("memory")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionSheetRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            onShareThread(conversation.id);
            onClose();
          }}
          activeOpacity={0.88}
        >
          <Feather name="share" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.actionSheetRowText, { color: colors.textSecondary }]}
          >
            {t("share")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionSheetRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            onCopyThread(conversation.id);
            onClose();
          }}
          activeOpacity={0.88}
        >
          <Feather name="copy" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.actionSheetRowText, { color: colors.textSecondary }]}
          >
            {t("copy")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="conversation-action-delete"
          style={[
            styles.actionSheetRow,
            styles.actionSheetDeleteRow,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            onDelete(conversation.id);
            onClose();
          }}
          activeOpacity={0.88}
        >
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={[styles.actionSheetRowText, { color: colors.danger }]}>
            {t("delete")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
