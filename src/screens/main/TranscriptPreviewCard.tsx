import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { ChatTranscript } from "../../components/ChatTranscript";
import { Colors } from "../../theme/colors";
import { Message } from "../../types";

import { TranslateFn } from "./shared";
import { styles } from "./styles";

interface TranscriptPreviewCardProps {
  colors: Colors;
  messages: Message[];
  onCopyMessage: (message: Message) => void;
  onOpenTranscript: () => void;
  showUsageStats: boolean;
  t: TranslateFn;
}

export function TranscriptPreviewCard({
  colors,
  messages,
  onCopyMessage,
  onOpenTranscript,
  showUsageStats,
  t,
}: TranscriptPreviewCardProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.transcriptShell,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.glow,
        },
      ]}
    >
      <View style={styles.transcriptHeader}>
        <TouchableOpacity
          style={[
            styles.expandButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenTranscript}
        >
          <Text style={[styles.expandButtonText, { color: colors.text }]}>
            {t("showTranscript")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.transcriptBody}>
        <ChatTranscript
          messages={messages}
          emptyTitle={t("noTranscriptYet")}
          emptyDescription={t("previewTranscriptEmptyDescription")}
          contentContainerStyle={styles.previewTranscriptContent}
          scrollEnabled={false}
          showUsageStats={showUsageStats}
          onCopyMessage={onCopyMessage}
        />
      </View>
    </View>
  );
}
