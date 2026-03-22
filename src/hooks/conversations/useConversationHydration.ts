import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { ConversationMeta } from "../../types";
import {
  buildConversationMetaFromConversation,
  conversationMetaNeedsHydration,
  normalizeConversationMeta,
  sortConversationMeta,
} from "./meta";
import {
  persistConversationMeta,
  readConversation,
  readStoredConversationMetas,
} from "./storage";

async function hydrateConversationMetas(metas: ConversationMeta[]) {
  return Promise.all(
    metas.map(async (meta) => {
      const shouldHydrate =
        !meta.createdAt ||
        meta.messageCount === 0 ||
        meta.providers.length === 0 ||
        Object.keys(meta.providerModels ?? {}).length === 0;

      if (!shouldHydrate) {
        return meta;
      }

      const conversation = await readConversation(meta.id);

      if (!conversation) {
        return meta;
      }

      return buildConversationMetaFromConversation(conversation, meta);
    }),
  );
}

export function useConversationHydration(params: {
  conversations: ConversationMeta[];
  setConversations: Dispatch<SetStateAction<ConversationMeta[]>>;
}) {
  const { conversations, setConversations } = params;

  const hydrateConversationMetasCallback = useMemo(
    () => hydrateConversationMetas,
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedMetas = await readStoredConversationMetas();

      if (cancelled || storedMetas.length === 0) {
        return;
      }

      const normalizedMetas = await Promise.all(
        storedMetas.map(async (meta) => {
          const needsHydration = conversationMetaNeedsHydration(meta);
          const normalizedMeta = normalizeConversationMeta(meta);

          if (!needsHydration) {
            return normalizedMeta;
          }

          const conversation = await readConversation(meta.id);

          if (!conversation) {
            return normalizedMeta;
          }

          return buildConversationMetaFromConversation(
            conversation,
            normalizedMeta,
          );
        }),
      );

      const hydratedMetas = await hydrateConversationMetasCallback(normalizedMetas);

      if (cancelled) {
        return;
      }

      const sortedMetas = sortConversationMeta(hydratedMetas);
      setConversations(sortedMetas);

      if (JSON.stringify(sortedMetas) !== JSON.stringify(storedMetas)) {
        persistConversationMeta(sortedMetas);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateConversationMetasCallback, setConversations]);

  useEffect(() => {
    let cancelled = false;

    if (
      conversations.length === 0 ||
      !conversations.some(
        (conversation) =>
          conversation.messageCount === 0 || conversation.providers.length === 0,
      )
    ) {
      return;
    }

    void (async () => {
      const hydratedMetas = await hydrateConversationMetasCallback(conversations);

      if (cancelled) {
        return;
      }

      if (JSON.stringify(hydratedMetas) === JSON.stringify(conversations)) {
        return;
      }

      setConversations(persistConversationMeta(hydratedMetas));
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations, hydrateConversationMetasCallback, setConversations]);
}
