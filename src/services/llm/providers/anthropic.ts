import { networkFetch } from "../../networkFetch";
import {
  buildProviderHttpError,
  normalizeProviderTransportError,
} from "../../providerErrors";
import { AppLanguage } from "../../../types";

import { readEventStream } from "../eventStream";
import { ChatMessage, requireProviderKey, toAPIMessages } from "../shared";

export async function requestAnthropicChat(params: {
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
    response = await networkFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": requireProviderKey("anthropic", apiKey, params.language),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: toAPIMessages(messages),
      }),
      signal: abortSignal,
    });
  } catch (error) {
    throw normalizeProviderTransportError({
      provider: "anthropic",
      language: params.language,
      error,
      action: "reply",
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw buildProviderHttpError({
      provider: "anthropic",
      language: params.language,
      status: response.status,
      errorText: errText,
      action: "reply",
    });
  }

  const data = await response.json();
  return (
    data.content?.map((part: { text?: string }) => part.text || "").join("") ||
    ""
  );
}

export async function requestAnthropicChatStream(params: {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  language: AppLanguage;
  systemPrompt: string;
  onChunk: (text: string) => void;
  abortSignal?: AbortSignal;
}) {
  const { model, messages, apiKey, systemPrompt, onChunk, abortSignal } =
    params;
  let response: Awaited<ReturnType<typeof networkFetch>>;

  try {
    response = await networkFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": requireProviderKey("anthropic", apiKey, params.language),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        stream: true,
        messages: toAPIMessages(messages),
      }),
      signal: abortSignal,
    });
  } catch (error) {
    throw normalizeProviderTransportError({
      provider: "anthropic",
      language: params.language,
      error,
      action: "reply",
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw buildProviderHttpError({
      provider: "anthropic",
      language: params.language,
      status: response.status,
      errorText: errText,
      action: "reply",
    });
  }

  if (!response.body) {
    const fullText = await requestAnthropicChat({
      model,
      messages,
      apiKey,
      language: params.language,
      systemPrompt,
      abortSignal,
    });

    if (fullText) {
      onChunk(fullText);
    }

    return fullText;
  }

  let fullText = "";

  await readEventStream(response.body, async ({ type, data }) => {
    if (!data || type !== "content_block_delta") {
      return;
    }

    const payload = JSON.parse(data);
    const delta =
      payload?.type === "content_block_delta" &&
      payload?.delta?.type === "text_delta" &&
      typeof payload.delta.text === "string"
        ? payload.delta.text
        : "";

    if (!delta) {
      return;
    }

    fullText += delta;
    onChunk(delta);
  });

  return fullText;
}
