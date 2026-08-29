import { PROVIDER_LABELS } from "../../constants/models";
import { translate } from "../../i18n";
import type { Message, MessageMetadata } from "../../types";
import { estimateChatUsage } from "../../utils/usageStats";
import { getProviderModelCandidates } from "../providerModelCandidates";
import { prepareMessageImagesForRequest } from "../imageAttachmentFiles";
import { executeProviderModelRequest } from "../providerResilience";
import { modelSupportsImageInput } from "../../utils/imageInputCapabilities";
import {
  addResponseProvenanceToMessages,
  createResponseProvenanceStreamFilter,
  stripLeadingResponseProvenanceMarker,
} from "./messageProvenance";
import { buildSystemPrompt } from "./prompts";
import {
  buildProviderEmptyReplyError,
  buildProviderNotWiredUpError,
  getLlmProviderConfigOrThrow,
  LLM_STREAM_REQUESTERS,
} from "./requestRouter";
import type { StreamChatParams } from "./types";

export const LLM_INITIAL_REPLY_TIMEOUT_MS = 5 * 60_000;
export const LLM_REPLY_INACTIVITY_TIMEOUT_MS = 10 * 60_000;
const LOCAL_ANDROID_DEV_API_KEY = "sk-test-android-local-dev";

function buildProviderReplyTimeoutError(
  provider: StreamChatParams["provider"],
  language: StreamChatParams["language"],
) {
  return new Error(
    translate(language, "providerTimeoutError", {
      provider: PROVIDER_LABELS[provider],
      action: translate(language, "replyGenerationAction"),
    }),
  );
}

function buildProviderCompletionLimitError(
  provider: StreamChatParams["provider"],
  language: StreamChatParams["language"],
) {
  return new Error(
    translate(language, "providerIncompleteReplyError", {
      provider: PROVIDER_LABELS[provider],
    }),
  );
}

function isLocalAndroidDevReplyEnabled(apiKey: string) {
  return (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    apiKey.trim() === LOCAL_ANDROID_DEV_API_KEY
  );
}

function buildLocalAndroidDevReply(messages: Message[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const prompt = lastUserMessage?.content.trim();

  return prompt
    ? `local Android development reply: I received "${prompt}". This confirms the text chat pipeline is working without contacting a provider.`
    : "local Android development reply: this confirms the text chat pipeline is working without contacting a provider.";
}

export async function streamChat({
  messages,
  model,
  modelEffort,
  provider,
  apiKey,
  assistantInstructions,
  responseLength,
  responseTone,
  language,
  conversationSummary,
  pastConversationKnowledge,
  spokenParagraphStreaming,
  synthesisContext,
  webSearchContext,
  maxOutputCharacters,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: StreamChatParams): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  let releaseAbortSignal: (() => void) | null = null;
  let abortRequestTransport: (() => void) | null = null;
  const outputCharacterLimit =
    typeof maxOutputCharacters === "number" &&
    Number.isSafeInteger(maxOutputCharacters) &&
    maxOutputCharacters > 0
      ? maxOutputCharacters
      : null;

  try {
    const hasImages = messages.some(
      (message) => (message.attachments?.length ?? 0) > 0,
    );
    if (hasImages && !modelSupportsImageInput(provider, model)) {
      throw new Error(
        translate(language, "imageInputUnsupported", {
          provider: PROVIDER_LABELS[provider],
          model,
        }),
      );
    }
    const provenanceMessages = addResponseProvenanceToMessages(messages);
    const requestMessages = hasImages
      ? await prepareMessageImagesForRequest(provenanceMessages)
      : provenanceMessages;
    const requestedSystemPrompt = buildSystemPrompt({
      assistantInstructions,
      responseLength,
      responseTone,
      language,
      currentModel: model,
      currentProvider: provider,
      conversationSummary,
      pastConversationKnowledge,
      spokenParagraphStreaming,
      synthesisContext,
      webSearchContext,
    });

    if (isLocalAndroidDevReplyEnabled(apiKey)) {
      const fullText = buildLocalAndroidDevReply(messages);

      if (outputCharacterLimit && fullText.length > outputCharacterLimit) {
        throw buildProviderCompletionLimitError(provider, language);
      }

      onChunk(fullText);
      await onDone(
        fullText,
        estimateChatUsage({
          provider,
          model,
          kind: "reply",
          systemPrompt: requestedSystemPrompt,
          messages,
          completionText: fullText,
        }),
      );
      return;
    }

    const timeoutError = buildProviderReplyTimeoutError(provider, language);
    const requestAbortController = new AbortController();
    abortRequestTransport = () => requestAbortController.abort();
    const provenanceStreamFilter =
      createResponseProvenanceStreamFilter(onChunk);

    if (abortSignal?.aborted) {
      requestAbortController.abort();
    } else if (abortSignal) {
      const handleAbort = () => requestAbortController.abort();
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      releaseAbortSignal = () => {
        abortSignal.removeEventListener("abort", handleAbort);
      };
    }

    let rejectTimeout: ((reason?: unknown) => void) | null = null;
    let receivedStreamData = false;
    let streamedCharacters = 0;
    const armTimeout = (timeoutMs: number) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timedOut = true;
        rejectTimeout?.(timeoutError);
        requestAbortController.abort();
      }, timeoutMs);
    };
    const onStreamActivity = () => {
      if (timedOut) {
        return;
      }

      receivedStreamData = true;
      armTimeout(LLM_REPLY_INACTIVITY_TIMEOUT_MS);
    };
    const onChunkWithTimeout = (text: string) => {
      if (timedOut) {
        return;
      }

      onStreamActivity();
      if (
        outputCharacterLimit &&
        streamedCharacters + text.length > outputCharacterLimit
      ) {
        requestAbortController.abort();
        throw buildProviderCompletionLimitError(provider, language);
      }
      streamedCharacters += text.length;
      provenanceStreamFilter.push(text);
    };
    const requestPromise = (async () => {
      return executeProviderModelRequest({
        abortSignal: requestAbortController.signal,
        canRetry: () => !receivedStreamData,
        candidateModels: getProviderModelCandidates({
          capability: "llm",
          provider,
          requestedModel: model,
          isCompatible: hasImages
            ? (candidate) => modelSupportsImageInput(provider, candidate)
            : undefined,
        }),
        capability: "llm",
        modelEffort,
        provider,
        request: async (actualModel, actualModelEffort) => {
          let fullText = "";
          let replyMetadata: MessageMetadata | undefined;
          const systemPrompt = buildSystemPrompt({
            assistantInstructions,
            responseLength,
            responseTone,
            language,
            currentModel: actualModel,
            currentProvider: provider,
            conversationSummary,
            pastConversationKnowledge,
            spokenParagraphStreaming,
            synthesisContext,
            webSearchContext,
          });
          const config = getLlmProviderConfigOrThrow(
            provider,
            actualModel,
            language,
          );
          const requestParams = {
            messages: requestMessages,
            model: actualModel,
            modelEffort: actualModelEffort,
            provider,
            apiKey,
            language,
            systemPrompt,
            onChunk: onChunkWithTimeout,
            abortSignal: requestAbortController.signal,
          };

          switch (config.transport) {
            case "openai-compatible":
              fullText = await LLM_STREAM_REQUESTERS["openai-compatible"](
                {
                  ...requestParams,
                  onStreamActivity,
                  onMistralAssistantContent: (content) => {
                    replyMetadata = {
                      ...replyMetadata,
                      providerState: {
                        ...replyMetadata?.providerState,
                        mistralAssistantContent: content,
                      },
                    };
                  },
                  onOpenRouterMetadata: (metadata) => {
                    replyMetadata = {
                      ...replyMetadata,
                      router: metadata,
                    };
                  },
                },
                config,
              );
              break;
            case "gemini-generate-content":
              fullText = await LLM_STREAM_REQUESTERS["gemini-generate-content"](
                {
                  ...requestParams,
                  onStreamActivity,
                  onGeminiAssistantContent: (content) => {
                    replyMetadata = {
                      ...replyMetadata,
                      providerState: {
                        ...replyMetadata?.providerState,
                        geminiAssistantContent: content,
                      },
                    };
                  },
                },
                config,
              );
              break;
            case "openai-realtime":
              fullText =
                await LLM_STREAM_REQUESTERS["openai-realtime"](requestParams);
              break;
            case "anthropic":
              fullText = await LLM_STREAM_REQUESTERS.anthropic({
                ...requestParams,
                onStreamActivity,
              });
              break;
            default:
              throw buildProviderNotWiredUpError(provider, language);
          }

          return {
            fullText,
            replyMetadata,
            systemPrompt,
          };
        },
      });
    })().catch((error) => {
      if (timedOut) {
        throw timeoutError;
      }

      throw error;
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectTimeout = reject;
    });

    armTimeout(LLM_INITIAL_REPLY_TIMEOUT_MS);
    const resolvedRequest = await Promise.race([
      requestPromise,
      timeoutPromise,
    ]);

    if (timedOut || !resolvedRequest) {
      throw timeoutError;
    }

    const {
      actualModel,
      actualModelEffort,
      attempts,
      requestedModel,
      requestedModelEffort,
      usedFallback,
      value,
    } = resolvedRequest;
    const { fullText, systemPrompt } = value;
    let { replyMetadata } = value;
    if (usedFallback || attempts > 1) {
      replyMetadata = {
        ...replyMetadata,
        modelFailover: {
          actualModel,
          actualModelEffort,
          attempts,
          requestedModel,
          requestedModelEffort,
        },
      };
    }
    const filteredFullText = stripLeadingResponseProvenanceMarker(fullText);
    provenanceStreamFilter.flush();

    if (!filteredFullText.trim()) {
      throw buildProviderEmptyReplyError(provider, language);
    }

    const usage = estimateChatUsage({
      provider,
      model: actualModel,
      kind: "reply",
      systemPrompt,
      messages: requestMessages,
      completionText: filteredFullText,
    });

    if (replyMetadata) {
      await onDone(filteredFullText, usage, replyMetadata);
    } else {
      await onDone(filteredFullText, usage);
    }
  } catch (error) {
    if (abortSignal?.aborted) {
      return;
    }

    await onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Cancel the transport on every exit path. After a completed request this
    // is a no-op; after a stream error it stops the provider from generating
    // (and billing) a completion nobody will receive.
    abortRequestTransport?.();
    releaseAbortSignal?.();
  }
}
