import { Conversation, Message } from "../types";
import { PROVIDER_LABELS } from "../constants/models";
import { AppLanguage } from "../types";
import { translate } from "../i18n";

function formatSpeakerLabel(message: Message, language: AppLanguage) {
  if (message.role === "user") {
    return translate(language, "you");
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

  return translate(language, "assistant");
}

export function formatMessageForCopy(message: Message, language: AppLanguage) {
  return `${formatSpeakerLabel(message, language)}\n${message.content.trim()}`;
}

export function formatConversationForCopy(
  conversation: Conversation,
  language: AppLanguage
) {
  const title = conversation.title.trim() || translate(language, "untitledConversation");
  const body = conversation.messages
    .map((message) => formatMessageForCopy(message, language))
    .join("\n\n");

  return [
    translate(language, "conversationExportHeader", { title }),
    body,
  ]
    .filter(Boolean)
    .join("\n\n");
}
