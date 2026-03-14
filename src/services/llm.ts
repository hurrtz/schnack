import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from "../config";
import { Message, Provider } from "../types";

interface StreamChatParams {
  messages: Message[];
  model: string;
  provider: Provider;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  abortSignal?: AbortSignal;
}

const SYSTEM_PROMPT = "You are a voice assistant. The user is speaking to you and will hear your response read aloud. Respond naturally and conversationally as if talking. Never use markdown, bullet points, numbered lists, headers, or any formatting. Keep responses concise and spoken-friendly.";

function toAPIMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function streamChat({
  messages,
  model,
  provider,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: StreamChatParams): Promise<void> {
  try {
    if (provider === "openai") {
      // React Native fetch doesn't support ReadableStream, so use non-streaming
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...toAPIMessages(messages)] }),
        signal: abortSignal,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
      }
      const data = await response.json();
      const fullText = data.choices?.[0]?.message?.content || "";
      onChunk(fullText);
      onDone(fullText);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM_PROMPT, messages: toAPIMessages(messages) }),
        signal: abortSignal,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
      }
      const data = await response.json();
      const fullText = data.content?.[0]?.text || "";
      onChunk(fullText);
      onDone(fullText);
    }
  } catch (error) {
    if (abortSignal?.aborted) return;
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
