import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { Conversation, ConversationMeta } from "../../types";
import { buildConversationMetaFromConversation } from "./meta";
import { removeConversation, saveConversation } from "./storage";

export interface ActiveConversationSnapshot {
  conversation: Conversation | null;
  meta: ConversationMeta | null;
}

export function useConversationSnapshots(params: {
  activeConversationRef: MutableRefObject<Conversation | null>;
  conversations: ConversationMeta[];
  persistMetas: (metas: ConversationMeta[]) => ConversationMeta[];
  setActiveConversationValue: (conversation: Conversation | null) => void;
  setConversations: Dispatch<SetStateAction<ConversationMeta[]>>;
}) {
  const {
    activeConversationRef,
    conversations,
    persistMetas,
    setActiveConversationValue,
    setConversations,
  } = params;

  const captureActiveConversationSnapshot =
    useCallback((): ActiveConversationSnapshot => {
      const conversation = activeConversationRef.current;
      const meta = conversation
        ? conversations.find((entry) => entry.id === conversation.id) ?? null
        : null;

      return {
        conversation: conversation
          ? JSON.parse(JSON.stringify(conversation))
          : null,
        meta: meta ? { ...meta } : null,
      };
    }, [activeConversationRef, conversations]);

  const restoreActiveConversationSnapshot = useCallback(
    async (snapshot: ActiveConversationSnapshot) => {
      const currentConversation = activeConversationRef.current;

      if (!snapshot.conversation) {
        if (currentConversation) {
          await removeConversation(currentConversation.id);
          setConversations((previous) =>
            persistMetas(
              previous.filter((entry) => entry.id !== currentConversation.id),
            ),
          );
        }

        setActiveConversationValue(null);
        return;
      }

      const restoredConversation = snapshot.conversation;
      const restoredMeta = buildConversationMetaFromConversation(
        restoredConversation,
        snapshot.meta,
      );

      if (currentConversation && currentConversation.id !== restoredConversation.id) {
        await removeConversation(currentConversation.id);
      }

      saveConversation(restoredConversation);
      setActiveConversationValue(restoredConversation);
      setConversations((previous) =>
        persistMetas([
          ...previous.filter(
            (entry) =>
              entry.id !== restoredConversation.id &&
              entry.id !== currentConversation?.id,
          ),
          restoredMeta,
        ]),
      );
    },
    [activeConversationRef, persistMetas, setActiveConversationValue, setConversations],
  );

  return {
    captureActiveConversationSnapshot,
    restoreActiveConversationSnapshot,
  };
}
