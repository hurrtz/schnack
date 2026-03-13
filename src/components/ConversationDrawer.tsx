import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../theme/ThemeContext";
import { ConversationMeta } from "../types";

interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConversationDrawer({
  visible,
  conversations,
  activeId,
  onSelect,
  onNewSession,
  onDelete,
  onClose,
}: ConversationDrawerProps) {
  const { colors } = useTheme();

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => onDelete(id)}
    >
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View
          style={[styles.drawer, { backgroundColor: colors.surface }]}
        >
          <View
            style={[styles.header, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Conversations
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.newSession,
              { borderColor: colors.accent },
            ]}
            onPress={() => {
              onNewSession();
              onClose();
            }}
          >
            <Text style={[styles.newSessionText, { color: colors.accent }]}>
              + New Session
            </Text>
          </TouchableOpacity>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                <TouchableOpacity
                  style={[
                    styles.item,
                    {
                      borderLeftColor:
                        item.id === activeId ? colors.accent : "transparent",
                      backgroundColor:
                        item.id === activeId ? colors.accentSoft : "transparent",
                    },
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Text
                    style={[styles.itemTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.itemMeta}>
                    <Text
                      style={[
                        styles.itemModel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.lastModel || "—"}
                    </Text>
                    <Text
                      style={[
                        styles.itemDate,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatDate(item.updatedAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            )}
          />
        </View>

        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  drawer: { width: "80%", flex: 1 },
  backdrop: { width: "20%", backgroundColor: "rgba(0,0,0,0.5)" },
  header: {
    padding: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "700" },
  newSession: {
    margin: 12,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
  },
  newSessionText: { fontSize: 13, fontWeight: "600" },
  item: {
    padding: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
  },
  itemTitle: { fontSize: 13, fontWeight: "600", marginBottom: 3 },
  itemMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemModel: { fontSize: 10 },
  itemDate: { fontSize: 10 },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  deleteText: { color: "white", fontWeight: "600", fontSize: 13 },
});
