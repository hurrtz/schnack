import { OPENAI_API_KEY, ANTHROPIC_API_KEY, Provider } from "../config";
import { Message } from "../types";

interface StreamChatParams {
  messages: Message[];
  model: string;
  provider: Provider;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  abortSignal?: AbortSignal;
}

function toAPIMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parseLine: (line: string) => string | null,
  isDone: (line: string) => boolean,
  onChunk: (text: string) => void
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (isDone(line)) return fullText;
      const text = parseLine(line);
      if (text) { fullText += text; onChunk(text); }
    }
  }
  return fullText;
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: toAPIMessages(messages), stream: true }),
        signal: abortSignal,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
      }
      const reader = response.body!.getReader();
      const fullText = await readSSEStream(
        reader,
        (line) => {
          if (!line.startsWith("data: ")) return null;
          const json = line.slice(6);
          if (json === "[DONE]") return null;
          return JSON.parse(json).choices?.[0]?.delta?.content || null;
        },
        (line) => line === "data: [DONE]",
        onChunk
      );
      onDone(fullText);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 4096, messages: toAPIMessages(messages), stream: true }),
        signal: abortSignal,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
      }
      const reader = response.body!.getReader();
      const fullText = await readSSEStream(
        reader,
        (line) => {
          if (!line.startsWith("data: ")) return null;
          const parsed = JSON.parse(line.slice(6));
          return parsed.type === "content_block_delta" ? parsed.delta?.text || null : null;
        },
        (line) => {
          if (!line.startsWith("data: ")) return false;
          try { return JSON.parse(line.slice(6)).type === "message_stop"; } catch { return false; }
        },
        onChunk
      );
      onDone(fullText);
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
