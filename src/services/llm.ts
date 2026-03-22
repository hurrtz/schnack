import { PROVIDER_LABELS } from "../constants/models";
import { translate } from "../i18n";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  Message,
  Provider,
  UsageEstimate,
} from "../types";
import { estimateChatUsage } from "../utils/usageStats";

import {
  buildSystemPrompt,
  CONTEXT_SUMMARIZER_PROMPT,
  formatMessagesForSummary,
} from "./llm/prompts";
import { requestAnthropicChat, requestAnthropicChatStream } from "./llm/providers/anthropic";
import { requestCohereChat } from "./llm/providers/cohere";
import {
  requestOpenAICompatibleChat,
  requestOpenAICompatibleChatStream,
} from "./llm/providers/openaiCompatible";
import { ChatMessage, OPENAI_COMPATIBLE_ENDPOINTS } from "./llm/shared";

export { buildSystemPrompt } from "./llm/prompts";

interface StreamChatParams {
  messages: Message[];
  model: string;
  provider: Provider;
  apiKey: string;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  language: AppLanguage;
  conversationSummary?: string;
  onChunk: (text: string) => void;
  onDone: (fullText: string, usage?: UsageEstimate) => void;
  onError: (error: Error) => void;
  abortSignal?: AbortSignal;
}

async function requestChatText(params: {
  messages: ChatMessage[];
  model: string;
  provider: Provider;
  apiKey: string;
  language: AppLanguage;
  systemPrompt: string;
  abortSignal?: AbortSignal;
}) {
  const openAICompatibleEndpoint = OPENAI_COMPATIBLE_ENDPOINTS[params.provider];

  if (openAICompatibleEndpoint) {
    return requestOpenAICompatibleChat({
      endpoint: openAICompatibleEndpoint,
      provider: params.provider,
      model: params.model,
      messages: params.messages,
      apiKey: params.apiKey,
      language: params.language,
      systemPrompt: params.systemPrompt,
      abortSignal: params.abortSignal,
    });
  }

  switch (params.provider) {
    case "anthropic":
      return requestAnthropicChat({
        model: params.model,
        messages: params.messages,
        apiKey: params.apiKey,
        language: params.language,
        systemPrompt: params.systemPrompt,
        abortSignal: params.abortSignal,
      });
    case "cohere":
      return requestCohereChat({
        model: params.model,
        messages: params.messages,
        apiKey: params.apiKey,
        language: params.language,
        systemPrompt: params.systemPrompt,
        abortSignal: params.abortSignal,
      });
    default:
      throw new Error(
        translate(params.language, "providerNotWiredUpYet", {
          provider: PROVIDER_LABELS[params.provider],
        }),
      );
  }
}

export async function summarizeConversationContext(params: {
  existingSummary?: string;
  messages: Message[];
  model: string;
  provider: Provider;
  apiKey: string;
  language: AppLanguage;
  abortSignal?: AbortSignal;
}) {
  const existingSummary = params.existingSummary?.trim() ?? "";

  if (!existingSummary && params.messages.length === 0) {
    return {
      summary: "",
      usage: undefined,
    };
  }

  const promptSections: string[] = [];

  if (existingSummary) {
    promptSections.push(`Existing summary:\n${existingSummary}`);
  }

  if (params.messages.length > 0) {
    promptSections.push(
      `Conversation turns to absorb:\n${formatMessagesForSummary(params.messages)}`,
    );
  }

  const summaryRequestMessages = [
    {
      role: "user" as const,
      content: promptSections.join("\n\n"),
    },
  ];

  const summary = await requestChatText({
    provider: params.provider,
    model: params.model,
    apiKey: params.apiKey,
    language: params.language,
    systemPrompt: CONTEXT_SUMMARIZER_PROMPT,
    messages: summaryRequestMessages,
    abortSignal: params.abortSignal,
  });

  const trimmedSummary = summary.trim();

  return {
    summary: trimmedSummary,
    usage: estimateChatUsage({
      provider: params.provider,
      model: params.model,
      kind: "summary",
      systemPrompt: CONTEXT_SUMMARIZER_PROMPT,
      messages: summaryRequestMessages,
      completionText: trimmedSummary,
    }),
  };
}

export async function validateProviderConnection(params: {
  provider: Provider;
  model: string;
  apiKey: string;
  language: AppLanguage;
  abortSignal?: AbortSignal;
}) {
  await requestChatText({
    messages: [
      {
        role: "user",
        content: "Reply with OK only.",
      },
    ],
    model: params.model,
    provider: params.provider,
    apiKey: params.apiKey,
    language: params.language,
    systemPrompt:
      "You are validating a provider connection for a voice assistant app. Reply with exactly OK.",
    abortSignal: params.abortSignal,
  });
}

export async function streamChat({
  messages,
  model,
  provider,
  apiKey,
  assistantInstructions,
  responseLength,
  responseTone,
  language,
  conversationSummary,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: StreamChatParams): Promise<void> {
  try {
    const systemPrompt = buildSystemPrompt({
      assistantInstructions,
      responseLength,
      responseTone,
      language,
      conversationSummary,
    });
    const openAICompatibleEndpoint = OPENAI_COMPATIBLE_ENDPOINTS[provider];
    let fullText = "";

    if (openAICompatibleEndpoint) {
      fullText = await requestOpenAICompatibleChatStream({
        endpoint: openAICompatibleEndpoint,
        provider,
        model,
        messages,
        apiKey,
        language,
        systemPrompt,
        onChunk,
        abortSignal,
      });
    } else if (provider === "anthropic") {
      fullText = await requestAnthropicChatStream({
        model,
        messages,
        apiKey,
        language,
        systemPrompt,
        onChunk,
        abortSignal,
      });
    } else {
      fullText = await requestChatText({
        messages,
        model,
        provider,
        apiKey,
        language,
        systemPrompt,
        abortSignal,
      });

      if (fullText) {
        onChunk(fullText);
      }
    }

    onDone(
      fullText,
      estimateChatUsage({
        provider,
        model,
        kind: "reply",
        systemPrompt,
        messages,
        completionText: fullText,
      }),
    );
  } catch (error) {
    if (abortSignal?.aborted) {
      return;
    }

    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
