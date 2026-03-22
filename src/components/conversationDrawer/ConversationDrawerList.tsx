import React from "react";
import { FlatList, Text, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { useLocalization } from "../../i18n";
import { useTheme } from "../../theme/ThemeContext";
import { ConversationMeta } from "../../types";

import { formatConversationDateTime } from "./formatConversationDateTime";
import { ConversationDrawerItem } from "./ConversationDrawerItem";
import { styles } from "./styles";

interface ConversationDrawerListProps {
  activeId: string | null;
  conversations: ConversationMeta[];
  searchQuery: string;
  onDeleteConversation: (conversationId: string) => void;
  onOpenActionConversation: (conversationId: string) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationDrawerList({
  activeId,
  conversations,
  searchQuery,
  onDeleteConversation,
  onOpenActionConversation,
  onSelectConversation,
}: ConversationDrawerListProps) {
  const { colors } = useTheme();
  const { locale, t } = useLocalization();

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View
          testID="conversation-drawer-empty-state"
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.accentSoft, borderColor: colors.border },
            ]}
          >
            <Feather name="message-circle" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery.trim()
              ? t("noMatchingConversations")
              : t("noSavedConversationsYet")}
          </Text>
          <Text
            style={[styles.emptyDescription, { color: colors.textSecondary }]}
          >
            {searchQuery.trim()
              ? t("noMatchingConversationsDescription")
              : t("drawerEmptyDescription")}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <ConversationDrawerItem
          conversation={item}
          active={item.id === activeId}
          formatDateTime={(iso) => formatConversationDateTime(iso, locale)}
          onDelete={onDeleteConversation}
          onOpenActionConversation={onOpenActionConversation}
          onSelectConversation={onSelectConversation}
        />
      )}
    />
  );
}
