import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";

import { useLocalization } from "../../i18n";
import { useTheme } from "../../theme/ThemeContext";
import { ConversationMeta } from "../../types";
import { ProviderIcon } from "../ProviderIcon";

import { styles } from "./styles";

interface ConversationDrawerItemProps {
  conversation: ConversationMeta;
  active: boolean;
  formatDateTime: (iso: string) => string;
  onDelete: (conversationId: string) => void;
  onOpenActionConversation: (conversationId: string) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationDrawerItem({
  conversation,
  active,
  formatDateTime,
  onDelete,
  onOpenActionConversation,
  onSelectConversation,
}: ConversationDrawerItemProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const providers =
    conversation.providers && conversation.providers.length > 0
      ? conversation.providers
      : conversation.lastProvider
        ? [conversation.lastProvider]
        : [];
  const providerModelEntries = providers.map((provider) => ({
    provider,
    models: conversation.providerModels?.[provider] ?? [],
  }));

  const renderRightActions = () => (
    <TouchableOpacity
      style={[styles.deleteAction, { backgroundColor: colors.danger }]}
      onPress={() => onDelete(conversation.id)}
    >
      <Feather name="trash-2" size={16} color="#FFFFFF" />
      <Text style={styles.deleteText}>{t("delete")}</Text>
    </TouchableOpacity>
  );

  const cardBody = (
    <>
      <TouchableOpacity
        testID={`conversation-drawer-menu-${conversation.id}`}
        style={[
          styles.itemMenuButton,
          styles.itemMenuButtonFloating,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
        onPress={() => onOpenActionConversation(conversation.id)}
        activeOpacity={0.88}
      >
        <Feather
          name="more-horizontal"
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID={`conversation-drawer-item-${conversation.id}`}
        style={styles.itemPressArea}
        onPress={() => onSelectConversation(conversation.id)}
        activeOpacity={0.9}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            {conversation.pinned ? (
              <View
                style={[
                  styles.pinnedBadge,
                  {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                <Feather name="bookmark" size={12} color={colors.accent} />
                <Text
                  style={[styles.pinnedBadgeText, { color: colors.accent }]}
                >
                  {t("pinned")}
                </Text>
              </View>
            ) : null}
            <Text
              style={[styles.itemTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {conversation.title}
            </Text>
          </View>
        </View>
        <View style={styles.itemMeta}>
          <View style={styles.itemMetaCopy}>
            <View style={styles.itemModelList}>
              {providerModelEntries.length > 0 ? (
                providerModelEntries.map(({ provider, models }) => (
                  <View
                    key={`${conversation.id}-${provider}-models`}
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
                        color={active ? colors.accent : colors.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.itemModelText,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {models.length > 0 ? models.join(" · ") : t("noModelYet")}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={[styles.itemModelText, { color: colors.textMuted }]}
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
                      color: active ? colors.accent : colors.textSecondary,
                    },
                  ]}
                >
                  {t("messageCount", {
                    count: conversation.messageCount ?? 0,
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
                  {formatDateTime(conversation.createdAt ?? conversation.updatedAt)}
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
                  {formatDateTime(conversation.updatedAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
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
}
