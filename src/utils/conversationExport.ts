import { Conversation, Message } from "../types";
import { PROVIDER_LABELS } from "../constants/models";

function formatSpeakerLabel(message: Message) {
  if (message.role === "user") {
    return "You";
  }

  if (message.provider && message.model) {
    return `${PROVIDER_LABELS[message.provider]} · ${message.model}`;
  }

  if (message.provider) {
    return PROVIDER_LABELS[message.provider];
  }

  if (message.model) {
    return message.model;
  }

  return "Assistant";
}

export function formatMessageForCopy(message: Message) {
  return `${formatSpeakerLabel(message)}\n${message.content.trim()}`;
}

export function formatConversationForCopy(conversation: Conversation) {
  const title = conversation.title.trim() || "Untitled conversation";
  const body = conversation.messages
    .map((message) => formatMessageForCopy(message))
    .join("\n\n");

  return [`Conversation: ${title}`, body].filter(Boolean).join("\n\n");
}
