import { useCallback } from "react";
import { PROVIDER_LABELS } from "../../constants/models";
import { ConversationMeta } from "../../types";
import { sortConversationMeta } from "./meta";

export function useConversationSearch(params: {
  conversations: ConversationMeta[];
  getConversationById: (id: string) => Promise<import("../../types").Conversation | null>;
}) {
  const { conversations, getConversationById } = params;

  const searchConversations = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return conversations;
      }

      const matches = await Promise.all(
        conversations.map(async (conversationMeta) => {
          const providerLabels = (conversationMeta.providers ?? [])
            .map((provider) => PROVIDER_LABELS[provider])
            .join(" ");
          const lastProviderLabel = conversationMeta.lastProvider
            ? PROVIDER_LABELS[conversationMeta.lastProvider]
            : "";
          const metadataHaystack = [
            conversationMeta.title,
            conversationMeta.lastModel ?? "",
            lastProviderLabel,
            providerLabels,
            ...Object.values(conversationMeta.providerModels ?? {}).flat(),
          ]
            .join(" ")
            .toLowerCase();

          if (metadataHaystack.includes(normalizedQuery)) {
            return conversationMeta;
          }

          const conversation = await getConversationById(conversationMeta.id);

          if (!conversation) {
            return null;
          }

          const conversationHaystack = [
            conversation.contextSummary ?? "",
            ...conversation.messages.map((message) => message.content),
          ]
            .join(" ")
            .toLowerCase();

          return conversationHaystack.includes(normalizedQuery)
            ? conversationMeta
            : null;
        }),
      );

      return sortConversationMeta(
        matches.filter(
          (conversation): conversation is ConversationMeta =>
            conversation !== null,
        ),
      );
    },
    [conversations, getConversationById],
  );

  return {
    searchConversations,
  };
}
