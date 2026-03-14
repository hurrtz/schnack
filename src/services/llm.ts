import { PROVIDER_LABELS } from "../constants/models";
import { Message, Provider } from "../types";

interface StreamChatParams {
  messages: Message[];
  model: string;
  provider: Provider;
  apiKey: string;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  abortSignal?: AbortSignal;
}

const SYSTEM_PROMPT =
  "You are a voice assistant. The user is speaking to you and will hear your response read aloud. Respond naturally and conversationally as if talking. Never use markdown, bullet points, numbered lists, headers, or any formatting. Keep responses concise and spoken-friendly.";

function toAPIMessages(messages: Message[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function requireProviderKey(provider: Provider, apiKey: string) {
  if (!apiKey) {
    throw new Error(`${PROVIDER_LABELS[provider]} is not configured in Settings.`);
  }

  return apiKey;
}

function extractOpenAICompatibleText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

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

  return "";
}

async function requestOpenAICompatibleChat(params: {
  endpoint: string;
  provider: Provider;
  model: string;
  messages: Message[];
  apiKey: string;
  abortSignal?: AbortSignal;
}) {
  const { endpoint, provider, model, messages, apiKey, abortSignal } = params;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireProviderKey(provider, apiKey)}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...toAPIMessages(messages),
      ],
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `${PROVIDER_LABELS[provider]} API error (${response.status}): ${errText}`
    );
  }

  const data = await response.json();
  return extractOpenAICompatibleText(data.choices?.[0]?.message?.content);
}

async function requestAnthropicChat(params: {
  model: string;
  messages: Message[];
  apiKey: string;
  abortSignal?: AbortSignal;
}) {
  const { model, messages, apiKey, abortSignal } = params;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": requireProviderKey("anthropic", apiKey),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: toAPIMessages(messages),
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.content
    ?.map((part: { text?: string }) => part.text || "")
    .join("") || "";
}

export async function streamChat({
  messages,
  model,
  provider,
  apiKey,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: StreamChatParams): Promise<void> {
  try {
    let fullText = "";

    switch (provider) {
      case "openai":
        fullText = await requestOpenAICompatibleChat({
          endpoint: "https://api.openai.com/v1/chat/completions",
          provider,
          model,
          messages,
          apiKey,
          abortSignal,
        });
        break;
      case "gemini":
        fullText = await requestOpenAICompatibleChat({
          endpoint:
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          provider,
          model,
          messages,
          apiKey,
          abortSignal,
        });
        break;
      case "nvidia":
        fullText = await requestOpenAICompatibleChat({
          endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
          provider,
          model,
          messages,
          apiKey,
          abortSignal,
        });
        break;
      case "anthropic":
        fullText = await requestAnthropicChat({
          model,
          messages,
          apiKey,
          abortSignal,
        });
        break;
    }

    onChunk(fullText);
    onDone(fullText);
  } catch (error) {
    if (abortSignal?.aborted) {
      return;
    }

    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
