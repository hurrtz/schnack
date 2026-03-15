import React from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PROVIDER_LABELS } from "../constants/models";
import { useLocalization } from "../i18n";
import { ConversationMeta } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { ProviderIcon } from "./ProviderIcon";

interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCopyThread: (id: string) => void;
  onNewSession: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConversationDrawer({
  visible,
  conversations,
  activeId,
  onSelect,
  onCopyThread,
  onNewSession,
  onDelete,
  onClose,
}: ConversationDrawerProps) {
  const { colors } = useTheme();
  const { t, locale } = useLocalization();
  const insets = useSafeAreaInsets();

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={[styles.deleteAction, { backgroundColor: colors.danger }]}
      onPress={() => onDelete(id)}
    >
      <Feather name="trash-2" size={16} color="#FFFFFF" />
      <Text style={styles.deleteText}>{t("delete")}</Text>
    </TouchableOpacity>
  );

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (diffDays === 1) {
      return t("yesterday");
    }

    return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
              paddingTop: Math.max(insets.top, 12) + 8,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.drawerGlow}
          />

          <View
            style={[
              styles.header,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                {t("memory")}
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("conversations")}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t("drawerSubtitle")}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => {
              onNewSession();
              onClose();
            }}
          >
            <LinearGradient
              colors={[colors.accentGradientStart, colors.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.newSession]}
            >
              <Feather name="plus" size={16} color="#F4F8FF" />
              <Text style={styles.newSessionText}>{t("newSession")}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View
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
                  {t("noSavedConversationsYet")}
                </Text>
                <Text
                  style={[styles.emptyDescription, { color: colors.textSecondary }]}
                >
                  {t("drawerEmptyDescription")}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const active = item.id === activeId;

              return (
                <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                  <TouchableOpacity
                    style={[
                      styles.item,
                      {
                        borderColor: active ? colors.borderStrong : colors.border,
                        backgroundColor: active
                          ? colors.surfaceElevated
                          : colors.surface,
                        shadowColor: active ? colors.glow : "transparent",
                      },
                    ]}
                    onPress={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    activeOpacity={0.9}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.activeRail}
                      />
                    ) : null}
                    <View style={styles.itemHeader}>
                      <Text
                        style={[styles.itemTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.itemDate, { color: colors.textMuted }]}
                      >
                        {formatDate(item.updatedAt)}
                      </Text>
                    </View>
                    <View style={styles.itemMeta}>
                      <View style={styles.itemMetaCopy}>
                        <View style={styles.itemProviderRow}>
                          {item.lastProvider ? (
                            <ProviderIcon
                              provider={item.lastProvider}
                              color={active ? colors.accent : colors.textSecondary}
                            />
                          ) : (
                            <Feather
                              name="cpu"
                              size={16}
                              color={colors.textMuted}
                            />
                          )}
                          <Text
                            style={[
                              styles.itemProviderLabel,
                              {
                                color: item.lastProvider
                                  ? active
                                    ? colors.accent
                                    : colors.textSecondary
                                  : colors.textMuted,
                              },
                            ]}
                          >
                            {item.lastProvider
                              ? PROVIDER_LABELS[item.lastProvider]
                              : t("noProviderYet")}
                          </Text>
                        </View>
                        <View style={styles.itemFooter}>
                          <Text
                            style={[styles.itemModel, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {item.lastModel || t("noModelYet")}
                          </Text>
                        <View
                          style={[
                            styles.statePill,
                            {
                              backgroundColor: active
                                  ? colors.accentSoft
                                  : colors.surfaceAlt,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.stateText,
                                { color: active ? colors.accent : colors.textSecondary },
                              ]}
                            >
                              {active ? t("live") : t("saved")}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.copyAction,
                              {
                                backgroundColor: colors.surfaceAlt,
                                borderColor: colors.border,
                              },
                            ]}
                            onPress={() => onCopyThread(item.id)}
                            activeOpacity={0.88}
                          >
                            <Feather
                              name="copy"
                              size={13}
                              color={colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.copyActionText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {t("copy")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            }}
          />
        </View>

        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  drawer: {
    width: "84%",
    maxWidth: 380,
    borderRightWidth: 1,
  },
  drawerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  backdrop: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  newSession: {
    marginTop: 16,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 7,
  },
  newSessionText: {
    color: "#F4F8FF",
    fontSize: 15,
    fontFamily: fonts.display,
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    textAlign: "center",
    fontFamily: fonts.display,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: fonts.body,
  },
  item: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 10,
  },
  activeRail: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 0,
    width: 4,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.display,
  },
  itemDate: {
    fontSize: 11,
    fontFamily: fonts.mono,
  },
  itemMeta: {
    gap: 10,
  },
  itemMetaCopy: {
    gap: 8,
  },
  itemProviderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemProviderLabel: {
    fontSize: 12,
    fontFamily: fonts.mono,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  itemModel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  statePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyActionText: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  stateText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  deleteAction: {
    width: 96,
    marginBottom: 10,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  deleteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: fonts.display,
  },
});
