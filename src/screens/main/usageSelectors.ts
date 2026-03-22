import { getProviderModelName, PROVIDER_LABELS } from "../../constants/models";
import { Conversation } from "../../types";
import {
  aggregateConversationUsage,
  aggregateConversationUsageByRoute,
  formatTokenCount,
  formatUsd,
} from "../../utils/usageStats";

import { TranslateFn } from "./shared";

export interface ConversationUsageRouteDisplay {
  key: string;
  label: string;
  value: string;
}

export interface ConversationUsageDisplayData {
  countsLabel: string;
  noteLabel: string;
  promptTokensLabel: string;
  replyTokensLabel: string;
  totalTokensLabel: string;
  totalCostLabel: string | null;
  routes: ConversationUsageRouteDisplay[];
}

export function getConversationUsageDisplayData(params: {
  conversation: Conversation | null;
  showUsageStats: boolean;
  t: TranslateFn;
}): ConversationUsageDisplayData | null {
  const { conversation, showUsageStats, t } = params;

  if (!conversation || !showUsageStats) {
    return null;
  }

  const totals = aggregateConversationUsage(conversation);

  if (totals.totalTokens <= 0) {
    return null;
  }

  const totalCostLabel =
    totals.pricedEntryCount > 0
      ? t(
          totals.unpricedEntryCount > 0
            ? "estimatedCostPartial"
            : "estimatedCost",
          {
            cost: formatUsd(totals.totalCostUsd),
          },
        )
      : null;
  const routes = aggregateConversationUsageByRoute(conversation)
    .filter((routeList) => routeList.totalTokens > 0)
    .map((route) => {
      const routeLabel =
        route.provider && route.model
          ? `${PROVIDER_LABELS[route.provider]} · ${getProviderModelName(
              route.provider,
              route.model,
            )}`
          : route.model || t("unknownUsageRoute");
      const routeCostLabel =
        route.pricedEntryCount > 0 ? formatUsd(route.totalCostUsd) : null;

      return {
        key: `${route.provider ?? "unknown"}:${route.model ?? "unknown"}`,
        label: routeLabel,
        value: routeCostLabel
          ? t(
              route.unpricedEntryCount > 0
                ? "estimatedRouteUsagePartial"
                : "estimatedRouteUsage",
              {
                tokens: formatTokenCount(route.totalTokens),
                cost: routeCostLabel,
              },
            )
          : t("estimatedRouteUsageTokensOnly", {
              tokens: formatTokenCount(route.totalTokens),
            }),
      };
    });

  return {
    countsLabel: t("estimatedUsageCounts", {
      replies: totals.replyCount,
      summaries: totals.summaryCount,
    }),
    noteLabel: t("estimatedUsageConversationScope"),
    promptTokensLabel: t("estimatedPromptTokens", {
      count: formatTokenCount(totals.promptTokens),
    }),
    replyTokensLabel: t("estimatedReplyTokens", {
      count: formatTokenCount(totals.completionTokens),
    }),
    totalTokensLabel: t("estimatedTotalTokens", {
      count: formatTokenCount(totals.totalTokens),
    }),
    totalCostLabel,
    routes: routes.length > 1 ? routes : [],
  };
}
