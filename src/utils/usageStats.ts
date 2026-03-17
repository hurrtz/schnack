import {
  Conversation,
  Message,
  Provider,
  UsageEstimate,
  UsageEstimateKind,
} from "../types";
import {
  estimateMessageTokens,
  estimateTextTokens,
} from "../services/conversationContext";
import { PRICING_ASSUMPTIONS } from "../constants/usagePricing";

export interface ConversationUsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  pricedEntryCount: number;
  unpricedEntryCount: number;
  replyCount: number;
  summaryCount: number;
}

export interface ConversationUsageRouteTotals {
  provider: Provider | null;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  pricedEntryCount: number;
  unpricedEntryCount: number;
  entryCount: number;
}

function findPricing(provider: Provider, model: string) {
  const matcher = PRICING_ASSUMPTIONS.find(
    (entry) => entry.provider === provider && entry.modelPattern.test(model),
  );

  return matcher ?? null;
}

function tokensToUsd(tokens: number, usdPerMillion: number) {
  return (tokens / 1_000_000) * usdPerMillion;
}

function roundTo(amount: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function estimateChatUsage(params: {
  provider: Provider;
  model: string;
  kind: UsageEstimateKind;
  systemPrompt: string;
  messages: Pick<Message, "role" | "content">[];
  completionText: string;
}): UsageEstimate {
  const promptTokens =
    estimateMessageTokens({
      role: "assistant",
      content: params.systemPrompt,
    }) +
    params.messages.reduce(
      (total, message) => total + estimateMessageTokens(message),
      0,
    );
  const completionTokens = Math.max(
    estimateTextTokens(params.completionText.trim()),
    0,
  );
  const totalTokens = promptTokens + completionTokens;
  const pricing = findPricing(params.provider, params.model);
  const inputCostUsd = pricing
    ? tokensToUsd(promptTokens, pricing.inputUsdPerMillion)
    : null;
  const outputCostUsd = pricing
    ? tokensToUsd(completionTokens, pricing.outputUsdPerMillion)
    : null;

  return {
    kind: params.kind,
    source: "estimated",
    promptTokens,
    completionTokens,
    totalTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd:
      inputCostUsd !== null && outputCostUsd !== null
        ? inputCostUsd + outputCostUsd
        : null,
  };
}

export function aggregateConversationUsage(
  conversation?: Pick<Conversation, "messages" | "usageEvents"> | null,
): ConversationUsageTotals {
  if (!conversation) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      pricedEntryCount: 0,
      unpricedEntryCount: 0,
      replyCount: 0,
      summaryCount: 0,
    };
  }

  const messageUsages = conversation.messages
    .filter(
      (message): message is Message & { usage: UsageEstimate } =>
        !!message.usage,
    )
    .map((message) => message.usage);
  const eventUsages = (conversation.usageEvents ?? []).map(
    (event) => event.usage,
  );
  const usages = [...messageUsages, ...eventUsages];

  return usages.reduce<ConversationUsageTotals>(
    (total, usage) => {
      total.promptTokens += usage.promptTokens;
      total.completionTokens += usage.completionTokens;
      total.totalTokens += usage.totalTokens;

      if (usage.totalCostUsd !== null) {
        total.totalCostUsd += usage.totalCostUsd;
        total.pricedEntryCount += 1;
      } else {
        total.unpricedEntryCount += 1;
      }

      if (usage.kind === "reply") {
        total.replyCount += 1;
      } else if (usage.kind === "summary") {
        total.summaryCount += 1;
      }

      return total;
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      pricedEntryCount: 0,
      unpricedEntryCount: 0,
      replyCount: 0,
      summaryCount: 0,
    },
  );
}

export function aggregateConversationUsageByRoute(
  conversation?: Pick<Conversation, "messages" | "usageEvents"> | null,
): ConversationUsageRouteTotals[] {
  if (!conversation) {
    return [];
  }

  const entries = [
    ...conversation.messages
      .filter(
        (message): message is Message & { usage: UsageEstimate } =>
          !!message.usage,
      )
      .map((message) => ({
        provider: message.provider,
        model: message.model,
        usage: message.usage,
      })),
    ...(conversation.usageEvents ?? []).map((event) => ({
      provider: event.provider,
      model: event.model,
      usage: event.usage,
    })),
  ];

  const totalsByRoute = new Map<string, ConversationUsageRouteTotals>();

  for (const entry of entries) {
    const key = `${entry.provider ?? "unknown"}::${entry.model ?? "unknown"}`;
    const existing = totalsByRoute.get(key) ?? {
      provider: entry.provider,
      model: entry.model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      pricedEntryCount: 0,
      unpricedEntryCount: 0,
      entryCount: 0,
    };

    existing.promptTokens += entry.usage.promptTokens;
    existing.completionTokens += entry.usage.completionTokens;
    existing.totalTokens += entry.usage.totalTokens;
    existing.entryCount += 1;

    if (entry.usage.totalCostUsd !== null) {
      existing.totalCostUsd += entry.usage.totalCostUsd;
      existing.pricedEntryCount += 1;
    } else {
      existing.unpricedEntryCount += 1;
    }

    totalsByRoute.set(key, existing);
  }

  return [...totalsByRoute.values()].sort(
    (left, right) => right.totalTokens - left.totalTokens,
  );
}

export function formatTokenCount(count: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(count);
}

export function formatUsd(amount: number) {
  if (amount >= 1) {
    return `$${roundTo(amount, 2).toFixed(2)}`;
  }

  if (amount >= 0.01) {
    return `$${roundTo(amount, 3).toFixed(3)}`;
  }

  if (amount >= 0.001) {
    return `$${roundTo(amount, 4).toFixed(4)}`;
  }

  return `$${roundTo(amount, 5).toFixed(5)}`;
}
