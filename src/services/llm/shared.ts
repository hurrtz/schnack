import { PROVIDER_LABELS } from "../../constants/models";
import { translate } from "../../i18n";
import { AppLanguage, Provider } from "../../types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const OPENAI_COMPATIBLE_ENDPOINTS: Partial<Record<Provider, string>> = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
};

export function toAPIMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function requireProviderKey(
  provider: Provider,
  apiKey: string,
  language: AppLanguage,
) {
  if (!apiKey) {
    throw new Error(
      translate(language, "providerConfiguredInSettings", {
        provider: PROVIDER_LABELS[provider],
      }),
    );
  }

  return apiKey;
}
