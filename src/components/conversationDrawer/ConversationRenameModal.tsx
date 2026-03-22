import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { useLocalization } from "../../i18n";
import { useTheme } from "../../theme/ThemeContext";

import { styles } from "./styles";

interface ConversationRenameModalProps {
  visible: boolean;
  editingTitle: string;
  onChangeEditingTitle: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ConversationRenameModal({
  visible,
  editingTitle,
  onChangeEditingTitle,
  onClose,
  onSubmit,
}: ConversationRenameModalProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.inlineRenameOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.inlineRenameBackdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
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
        <Text style={[styles.renameHint, { color: colors.textSecondary }]}>
          {t("renameThreadHint")}
        </Text>
        <TextInput
          testID="conversation-rename-input"
          value={editingTitle}
          onChangeText={onChangeEditingTitle}
          onSubmitEditing={onSubmit}
          autoFocus
          returnKeyType="done"
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
            testID="conversation-rename-cancel"
            style={[
              styles.renameAction,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.88}
          >
            <Text
              style={[styles.renameActionText, { color: colors.textSecondary }]}
            >
              {t("cancel")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="conversation-rename-save"
            style={[
              styles.renameAction,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.borderStrong,
                opacity: editingTitle.trim() ? 1 : 0.5,
              },
            ]}
            onPress={onSubmit}
            activeOpacity={0.88}
            disabled={!editingTitle.trim()}
          >
            <Text style={[styles.renameActionText, { color: colors.accent }]}>
              {t("save")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
