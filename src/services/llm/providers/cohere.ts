import { networkFetch } from "../../networkFetch";
import {
  buildProviderHttpError,
  normalizeProviderTransportError,
} from "../../providerErrors";
import { AppLanguage } from "../../../types";

import { ChatMessage, requireProviderKey, toAPIMessages } from "../shared";

function extractCohereText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("");
}

export async function requestCohereChat(params: {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  language: AppLanguage;
  systemPrompt: string;
  abortSignal?: AbortSignal;
}) {
  const { model, messages, apiKey, systemPrompt, abortSignal } = params;
  let response: Awaited<ReturnType<typeof networkFetch>>;

  try {
    response = await networkFetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireProviderKey("cohere", apiKey, params.language)}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...toAPIMessages(messages),
        ],
      }),
      signal: abortSignal,
    });
  } catch (error) {
    throw normalizeProviderTransportError({
      provider: "cohere",
      language: params.language,
      error,
      action: "reply",
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw buildProviderHttpError({
      provider: "cohere",
      language: params.language,
      status: response.status,
      errorText: errText,
      action: "reply",
    });
  }

  const data = await response.json();
  return extractCohereText(data.message?.content);
}
