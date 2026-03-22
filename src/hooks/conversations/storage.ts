import AsyncStorage from "@react-native-async-storage/async-storage";
import { Conversation, ConversationMeta } from "../../types";
import {
  buildConversationMetaFromConversation,
  normalizeConversationMeta,
  sortConversationMeta,
} from "./meta";

export const META_KEY = "@schnackai/conversations";

export function conversationKey(id: string) {
  return `@schnackai/conversation/${id}`;
}

export async function readConversation(id: string) {
  const raw = await AsyncStorage.getItem(conversationKey(id));
  return raw ? (JSON.parse(raw) as Conversation) : null;
}

export async function readStoredConversationMetas() {
  const raw = await AsyncStorage.getItem(META_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as ConversationMeta[];
  } catch {
    return [];
  }
}

export function saveConversation(conversation: Conversation) {
  AsyncStorage.setItem(conversationKey(conversation.id), JSON.stringify(conversation));
}

export function removeConversation(id: string) {
  return AsyncStorage.removeItem(conversationKey(id));
}

export function persistConversationMeta(metas: ConversationMeta[]) {
  const sortedMetas = sortConversationMeta(
    metas.map(normalizeConversationMeta),
  );
  AsyncStorage.setItem(META_KEY, JSON.stringify(sortedMetas));
  return sortedMetas;
}

export async function hydrateConversationMeta(meta: ConversationMeta) {
  const conversation = await readConversation(meta.id);

  if (!conversation) {
    return meta;
  }

  return buildConversationMetaFromConversation(conversation, meta);
}
