import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "../../i18n";
import { useTheme } from "../../theme/ThemeContext";

import { styles } from "./styles";

interface ConversationDrawerHeaderProps {
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  onClearSearch: () => void;
  onClose: () => void;
  onNewSession: () => void;
}

export function ConversationDrawerHeader({
  searchQuery,
  onChangeSearchQuery,
  onClearSearch,
  onClose,
  onNewSession,
}: ConversationDrawerHeaderProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  return (
    <>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 12) + 8,
          },
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
          testID="conversation-drawer-close"
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
        testID="conversation-drawer-new-session"
        activeOpacity={0.92}
        onPress={onNewSession}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.newSession}
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
          testID="conversation-drawer-search-input"
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder={t("searchConversationsPlaceholder")}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {searchQuery.trim() ? (
          <TouchableOpacity
            testID="conversation-drawer-clear-search"
            onPress={onClearSearch}
            style={styles.searchClearButton}
            activeOpacity={0.82}
          >
            <Feather name="x" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}
