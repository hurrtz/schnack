import { Conversation, ConversationMeta, Message, Provider } from "../../types";

export function truncateConversationTitle(text: string, max = 40): string {
  if (text.length <= max) {
    return text;
  }

  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

function inferConversationState(messages: Message[]) {
  let lastModel: string | null = null;
  let lastProvider: Provider | null = null;
  const providers: Provider[] = [];
  const seenProviders = new Set<Provider>();
  const providerModels: Partial<Record<Provider, string[]>> = {};
  const seenProviderModels = new Map<Provider, Set<string>>();

  for (const message of messages) {
    if (message.provider && !seenProviders.has(message.provider)) {
      seenProviders.add(message.provider);
      providers.push(message.provider);
    }

    if (message.provider && message.model) {
      const seenModels = seenProviderModels.get(message.provider) ?? new Set<string>();
      if (!seenModels.has(message.model)) {
        seenModels.add(message.model);
        seenProviderModels.set(message.provider, seenModels);
        providerModels[message.provider] = [
          ...(providerModels[message.provider] ?? []),
          message.model,
        ];
      }
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];

    if (!lastModel && candidate.model) {
      lastModel = candidate.model;
    }

    if (!lastProvider && candidate.provider) {
      lastProvider = candidate.provider;
    }

    if (lastModel && lastProvider) {
      break;
    }
  }

  return {
    lastModel,
    lastProvider,
    providers,
    providerModels,
    messageCount: messages.length,
  };
}

function compareConversationMeta(
  left: ConversationMeta,
  right: ConversationMeta,
) {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function sortConversationMeta(conversations: ConversationMeta[]) {
  return [...conversations].sort(compareConversationMeta);
}

export function normalizeConversationMeta(meta: Partial<ConversationMeta>) {
  return {
    ...meta,
    id: meta.id ?? "",
    title: meta.title ?? "",
    createdAt: meta.createdAt ?? meta.updatedAt ?? new Date(0).toISOString(),
    updatedAt: meta.updatedAt ?? new Date(0).toISOString(),
    messageCount: meta.messageCount ?? 0,
    providers:
      meta.providers ??
      (meta.lastProvider ? [meta.lastProvider] : []),
    providerModels: meta.providerModels ?? {},
    lastModel: meta.lastModel ?? null,
    lastProvider: meta.lastProvider ?? null,
    pinned: meta.pinned ?? false,
  };
}

export function conversationMetaNeedsHydration(meta: Partial<ConversationMeta>) {
  return (
    !meta.createdAt ||
    typeof meta.messageCount !== "number" ||
    !Array.isArray(meta.providers) ||
    typeof meta.providerModels !== "object" ||
    meta.providerModels === null
  );
}

export function normalizeConversationTitle(title: string, fallback: string) {
  const trimmed = title.trim();

  if (!trimmed) {
    return fallback;
  }

  return truncateConversationTitle(trimmed, 60);
}

export function buildConversationMetaFromConversation(
  conversation: Conversation,
  existingMeta?: ConversationMeta | null,
): ConversationMeta {
  const inferredState = inferConversationState(conversation.messages);

  return normalizeConversationMeta({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: inferredState.messageCount,
    providers:
      inferredState.providers.length > 0
        ? inferredState.providers
        : existingMeta?.providers ?? [],
    providerModels:
      Object.keys(inferredState.providerModels).length > 0
        ? inferredState.providerModels
        : existingMeta?.providerModels ?? {},
    lastModel: inferredState.lastModel ?? existingMeta?.lastModel ?? null,
    lastProvider: inferredState.lastProvider ?? existingMeta?.lastProvider ?? null,
    pinned: existingMeta?.pinned ?? false,
  });
}
