import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { TranslationKey } from "../../i18n";
import { Colors } from "../../theme/colors";

type TranslateFn = (key: TranslationKey) => string;

interface ConversationMenuProps {
  visible: boolean;
  colors: Colors;
  t: TranslateFn;
  onClose: () => void;
  onManageMemory: () => void;
  onCopyThread: () => void;
  onShareThread: () => void;
}

export function ConversationMenu({
  visible,
  colors,
  t,
  onClose,
  onManageMemory,
  onCopyThread,
  onShareThread,
}: ConversationMenuProps) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.conversationMenuBackdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <View
        style={[
          styles.conversationMenu,
          styles.conversationMenuModal,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.conversationMenuItem}
          onPress={onManageMemory}
          activeOpacity={0.85}
        >
          <Feather name="archive" size={15} color={colors.accent} />
          <Text style={[styles.conversationMenuText, { color: colors.text }]}>
            {t("memory")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.conversationMenuItem}
          onPress={onCopyThread}
          activeOpacity={0.85}
        >
          <Feather name="copy" size={15} color={colors.accent} />
          <Text style={[styles.conversationMenuText, { color: colors.text }]}>
            {t("copyThread")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.conversationMenuItem}
          onPress={onShareThread}
          activeOpacity={0.85}
        >
          <Feather name="share" size={15} color={colors.accent} />
          <Text style={[styles.conversationMenuText, { color: colors.text }]}>
            {t("shareThread")}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  conversationMenuBackdrop: {
    position: "absolute",
    inset: 0,
  },
  conversationMenu: {
    position: "absolute",
    top: 56,
    right: 16,
    minWidth: 200,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 10,
    zIndex: 20,
  },
  conversationMenuModal: {
    overflow: "hidden",
  },
  conversationMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  conversationMenuText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
