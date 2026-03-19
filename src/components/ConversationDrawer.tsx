import React from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalization } from "../i18n";
import { ConversationMeta } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { ProviderIcon } from "./ProviderIcon";

interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationMeta[];
  activeId: string | null;
  onSearchConversations: (query: string) => Promise<ConversationMeta[]>;
  onSelect: (id: string) => Promise<void> | void;
  onCopyThread: (id: string) => void;
  onShareThread: (id: string) => void;
  onManageMemory: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onTogglePinned: (id: string) => void;
  onNewSession: () => Promise<void> | void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onDismiss?: () => void;
}

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
  const { t, locale } = useLocalization();
  const insets = useSafeAreaInsets();
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

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={[styles.deleteAction, { backgroundColor: colors.danger }]}
      onPress={() => onDelete(id)}
    >
      <Feather name="trash-2" size={16} color="#FFFFFF" />
      <Text style={styles.deleteText}>{t("delete")}</Text>
    </TouchableOpacity>
  );

  const formatDateTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const includeYear = date.getFullYear() !== now.getFullYear();

    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      ...(includeYear ? { year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const closeRenameModal = () => {
    setEditingConversationId(null);
    setEditingTitle("");
  };

  const closeActionModal = () => {
    setActionConversationId(null);
  };

  const submitRename = () => {
    if (!editingConversationId || !editingTitle.trim()) {
      return;
    }

    onRenameThread(editingConversationId, editingTitle);
    closeRenameModal();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onDismiss={onDismiss}
      >
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
              void (async () => {
                await onNewSession();
                onClose();
              })();
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

          <View
            style={[
              styles.searchShell,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("searchConversationsPlaceholder")}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {searchQuery.trim() ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.searchClearButton}
                activeOpacity={0.82}
              >
                <Feather name="x" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

            <FlatList
              data={visibleConversations}
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
              renderItem={({ item }) => {
                const active = item.id === activeId;
                const providers =
                  item.providers && item.providers.length > 0
                    ? item.providers
                    : item.lastProvider
                      ? [item.lastProvider]
                      : [];
                const providerModelEntries = providers.map((provider) => ({
                  provider,
                  models: item.providerModels?.[provider] ?? [],
                }));
                const cardBody = (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.itemMenuButton,
                        styles.itemMenuButtonFloating,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => {
                        setActionConversationId(item.id);
                      }}
                      activeOpacity={0.88}
                    >
                      <Feather
                        name="more-horizontal"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemPressArea}
                      onPress={() => {
                        void (async () => {
                          await onSelect(item.id);
                          onClose();
                        })();
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemTitleRow}>
                          {item.pinned ? (
                            <View
                              style={[
                                styles.pinnedBadge,
                                {
                                  backgroundColor: colors.accentSoft,
                                  borderColor: colors.borderStrong,
                                },
                              ]}
                            >
                              <Feather
                                name="bookmark"
                                size={12}
                                color={colors.accent}
                              />
                              <Text
                                style={[
                                  styles.pinnedBadgeText,
                                  { color: colors.accent },
                                ]}
                              >
                                {t("pinned")}
                              </Text>
                            </View>
                          ) : null}
                          <Text
                            style={[styles.itemTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemMeta}>
                        <View style={styles.itemMetaCopy}>
                          <View style={styles.itemModelList}>
                            {providerModelEntries.length > 0 ? (
                              providerModelEntries.map(({ provider, models }) => (
                                <View
                                  key={`${item.id}-${provider}-models`}
                                  style={styles.itemModelRow}
                                >
                                  <View
                                    style={[
                                      styles.itemModelIconWrap,
                                      {
                                        backgroundColor: active
                                          ? colors.accentSoft
                                          : colors.surfaceAlt,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  >
                                    <ProviderIcon
                                      provider={provider}
                                      color={
                                        active ? colors.accent : colors.textSecondary
                                      }
                                    />
                                  </View>
                                  <Text
                                    style={[
                                      styles.itemModelText,
                                      { color: colors.textSecondary },
                                    ]}
                                    numberOfLines={2}
                                  >
                                    {models.length > 0
                                      ? models.join(" · ")
                                      : t("noModelYet")}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text
                                style={[
                                  styles.itemModelText,
                                  { color: colors.textMuted },
                                ]}
                                numberOfLines={1}
                              >
                                {t("noProviderYet")}
                              </Text>
                            )}
                          </View>
                          <View style={styles.itemStatsRow}>
                            <View
                              style={[
                                styles.itemStatChip,
                                {
                                  backgroundColor: colors.surfaceAlt,
                                  borderColor: colors.border,
                                },
                              ]}
                            >
                              <Feather
                                name="message-square"
                                size={13}
                                color={active ? colors.accent : colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.itemStatChipText,
                                  {
                                    color: active
                                      ? colors.accent
                                      : colors.textSecondary,
                                  },
                                ]}
                              >
                                {t("messageCount", {
                                  count: item.messageCount ?? 0,
                                })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.itemTimelineRow}>
                            <View style={styles.itemTimelineBlock}>
                              <Text
                                style={[
                                  styles.itemTimelineLabel,
                                  { color: colors.textMuted },
                                ]}
                              >
                                {t("startedAt")}
                              </Text>
                              <Text
                                style={[
                                  styles.itemTimelineValue,
                                  { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {formatDateTime(item.createdAt ?? item.updatedAt)}
                              </Text>
                            </View>
                            <View style={styles.itemTimelineBlock}>
                              <Text
                                style={[
                                  styles.itemTimelineLabel,
                                  { color: colors.textMuted },
                                ]}
                              >
                                {t("endedAt")}
                              </Text>
                              <Text
                                style={[
                                  styles.itemTimelineValue,
                                  { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {formatDateTime(item.updatedAt)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </>
                );

                return (
                  <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                    {active ? (
                      <LinearGradient
                        colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.itemFrame, { shadowColor: colors.glow }]}
                      >
                        <View
                          style={[
                            styles.item,
                            { backgroundColor: colors.surfaceElevated },
                          ]}
                        >
                          {cardBody}
                        </View>
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          styles.itemFrame,
                          styles.itemFrameInactive,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            shadowColor: "transparent",
                          },
                        ]}
                      >
                        <View style={styles.item}>{cardBody}</View>
                      </View>
                    )}
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
          {actionConversation ? (
            <View style={styles.inlineActionOverlay} pointerEvents="box-none">
              <TouchableOpacity
                style={[
                  styles.inlineActionBackdrop,
                  { backgroundColor: colors.overlay },
                ]}
                activeOpacity={1}
                onPress={closeActionModal}
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
                  {actionConversation.title}
                </Text>
                <Text
                  style={[
                    styles.actionSheetMeta,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("messageCount", {
                    count: actionConversation.messageCount ?? 0,
                  })}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.actionSheetRow,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    onTogglePinned(actionConversation.id);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather
                    name="bookmark"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {actionConversation.pinned ? t("unpin") : t("pin")}
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
                    setEditingConversationId(actionConversation.id);
                    setEditingTitle(actionConversation.title);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather
                    name="edit-3"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.textSecondary },
                    ]}
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
                    onManageMemory(actionConversation.id);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather
                    name="archive"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.textSecondary },
                    ]}
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
                    onShareThread(actionConversation.id);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather
                    name="share"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.textSecondary },
                    ]}
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
                    onCopyThread(actionConversation.id);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather
                    name="copy"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("copy")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionSheetRow,
                    styles.actionSheetDeleteRow,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    onDelete(actionConversation.id);
                    closeActionModal();
                  }}
                  activeOpacity={0.88}
                >
                  <Feather name="trash-2" size={16} color={colors.danger} />
                  <Text
                    style={[
                      styles.actionSheetRowText,
                      { color: colors.danger },
                    ]}
                  >
                    {t("delete")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {editingConversationId ? (
            <View style={styles.inlineRenameOverlay} pointerEvents="box-none">
              <TouchableOpacity
                style={[
                  styles.inlineRenameBackdrop,
                  { backgroundColor: colors.overlay },
                ]}
                activeOpacity={1}
                onPress={closeRenameModal}
              />
              <View
                style={[
                  styles.renameCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: colors.glow,
                  },
                ]}
              >
                <Text style={[styles.renameTitle, { color: colors.text }]}>
                  {t("renameThread")}
                </Text>
                <Text
                  style={[styles.renameHint, { color: colors.textSecondary }]}
                >
                  {t("renameThreadHint")}
                </Text>
                <TextInput
                  value={editingTitle}
                  onChangeText={setEditingTitle}
                  autoFocus
                  placeholder={t("threadTitle")}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.accent}
                  style={[
                    styles.renameInput,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <View style={styles.renameActions}>
                  <TouchableOpacity
                    style={[
                      styles.renameAction,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={closeRenameModal}
                    activeOpacity={0.88}
                  >
                    <Text
                      style={[
                        styles.renameActionText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.renameAction,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.borderStrong,
                        opacity: editingTitle.trim() ? 1 : 0.5,
                      },
                    ]}
                    onPress={submitRename}
                    activeOpacity={0.88}
                    disabled={!editingTitle.trim()}
                  >
                    <Text
                      style={[styles.renameActionText, { color: colors.accent }]}
                    >
                      {t("save")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
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
  inlineActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  inlineActionBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  actionSheet: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },
  actionSheetTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: fonts.display,
  },
  actionSheetMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    marginBottom: 4,
  },
  actionSheetRow: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionSheetDeleteRow: {
    marginTop: 4,
  },
  actionSheetRowText: {
    fontSize: 14,
    fontFamily: fonts.display,
  },
  inlineRenameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 12,
  },
  inlineRenameBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  renameCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },
  renameTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.display,
  },
  renameHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  renameInput: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  renameAction: {
    minWidth: 92,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  renameActionText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
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
  searchShell: {
    marginHorizontal: 18,
    marginBottom: 14,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
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
  itemFrame: {
    borderRadius: 24,
    padding: 1.5,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 10,
  },
  itemFrameInactive: {
    borderWidth: 1,
  },
  item: {
    position: "relative",
    borderRadius: 22.5,
    padding: 16,
    overflow: "hidden",
  },
  itemPressArea: {
    paddingRight: 44,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitleRow: {
    flex: 1,
    gap: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: fonts.display,
  },
  itemMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMenuButtonFloating: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  pinnedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinnedBadgeText: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  itemMeta: {
    gap: 10,
  },
  itemMetaCopy: {
    gap: 10,
  },
  itemModelList: {
    gap: 8,
  },
  itemModelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  itemModelIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemModelText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  itemStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  itemStatChipText: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  itemTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  itemTimelineBlock: {
    flex: 1,
    gap: 4,
  },
  itemTimelineLabel: {
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  itemTimelineValue: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
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
