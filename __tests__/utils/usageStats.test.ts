import {
  aggregateConversationUsage,
  aggregateConversationUsageByRoute,
  estimateChatUsage,
  formatTokenCount,
  formatUsd,
} from "../../src/utils/usageStats";

describe("usageStats", () => {
  it("estimates tokens and cost for priced models", () => {
    const usage = estimateChatUsage({
      provider: "openai",
      model: "gpt-5.4",
      kind: "reply",
      systemPrompt: "You are helpful.",
      messages: [
        {
          role: "user",
          content: "Explain orbital mechanics simply.",
        },
      ],
      completionText:
        "Orbit means falling around something while moving sideways.",
    });

    expect(usage.kind).toBe("reply");
    expect(usage.promptTokens).toBeGreaterThan(0);
    expect(usage.completionTokens).toBeGreaterThan(0);
    expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);
    expect(usage.totalCostUsd).not.toBeNull();
  });

  it("leaves cost empty for unpriced models", () => {
    const usage = estimateChatUsage({
      provider: "nvidia",
      model: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      kind: "reply",
      systemPrompt: "You are helpful.",
      messages: [
        {
          role: "user",
          content: "Hello",
        },
      ],
      completionText: "Hi.",
    });

    expect(usage.totalCostUsd).toBeNull();
  });

  it("aggregates message usage and summary events per conversation", () => {
    const totals = aggregateConversationUsage({
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "Hi.",
          model: "gpt-5.4",
          provider: "openai",
          timestamp: "2026-03-17T12:00:00.000Z",
          usage: {
            kind: "reply",
            source: "estimated",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
            inputCostUsd: 0.00025,
            outputCostUsd: 0.0003,
            totalCostUsd: 0.00055,
          },
        },
      ],
      usageEvents: [
        {
          id: "e1",
          kind: "context-summary",
          model: "gpt-5.4",
          provider: "openai",
          timestamp: "2026-03-17T12:01:00.000Z",
          usage: {
            kind: "summary",
            source: "estimated",
            promptTokens: 80,
            completionTokens: 15,
            totalTokens: 95,
            inputCostUsd: 0.0002,
            outputCostUsd: 0.000225,
            totalCostUsd: 0.000425,
          },
        },
      ],
    });

    expect(totals.promptTokens).toBe(180);
    expect(totals.completionTokens).toBe(35);
    expect(totals.totalTokens).toBe(215);
    expect(totals.replyCount).toBe(1);
    expect(totals.summaryCount).toBe(1);
    expect(totals.pricedEntryCount).toBe(2);
    expect(totals.totalCostUsd).toBeCloseTo(0.000975, 8);
  });

  it("breaks conversation usage down by provider and model", () => {
    const routes = aggregateConversationUsageByRoute({
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "OpenAI reply",
          model: "gpt-5.4",
          provider: "openai",
          timestamp: "2026-03-17T12:00:00.000Z",
          usage: {
            kind: "reply",
            source: "estimated",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
            inputCostUsd: 0.00025,
            outputCostUsd: 0.0003,
            totalCostUsd: 0.00055,
          },
        },
        {
          id: "m2",
          role: "assistant",
          content: "Anthropic reply",
          model: "claude-sonnet-4-6",
          provider: "anthropic",
          timestamp: "2026-03-17T12:02:00.000Z",
          usage: {
            kind: "reply",
            source: "estimated",
            promptTokens: 80,
            completionTokens: 18,
            totalTokens: 98,
            inputCostUsd: 0.00024,
            outputCostUsd: 0.00027,
            totalCostUsd: 0.00051,
          },
        },
      ],
      usageEvents: [],
    });

    expect(routes).toHaveLength(2);
    expect(routes[0]).toEqual(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-5.4",
        totalTokens: 120,
      }),
    );
    expect(routes[1]).toEqual(
      expect.objectContaining({
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        totalTokens: 98,
      }),
    );
  });

  it("formats token counts and usd amounts for display", () => {
    expect(formatTokenCount(12345)).toBe("12,345");
    expect(formatUsd(0.000975)).toBe("$0.00098");
    expect(formatUsd(0.1234)).toBe("$0.123");
  });
});
