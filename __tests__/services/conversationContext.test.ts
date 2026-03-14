import {
  buildConversationContextPlan,
  CONTEXT_SUMMARY_TRIGGER_TOKENS,
  estimateMessagesTokens,
} from "../../src/services/conversationContext";
import { Message } from "../../src/types";

function makeMessage(id: string, role: "user" | "assistant", content: string): Message {
  return {
    id,
    role,
    content,
    model: role === "assistant" ? "gpt-5.4" : null,
    provider: role === "assistant" ? "openai" : null,
    timestamp: "2026-03-14T10:00:00.000Z",
  };
}

describe("buildConversationContextPlan", () => {
  it("keeps the full history when the thread is still small", () => {
    const messages = [
      makeMessage("1", "user", "Hello there."),
      makeMessage("2", "assistant", "Hi. How can I help?"),
    ];

    const plan = buildConversationContextPlan({ messages });

    expect(plan.usesSummary).toBe(false);
    expect(plan.needsSummaryUpdate).toBe(false);
    expect(plan.recentMessages).toEqual(messages);
  });

  it("switches to summary mode once the token trigger is exceeded", () => {
    const longChunk = "Wind forms because pressure differences move air across the atmosphere. ".repeat(
      24
    );
    const messages = Array.from({ length: 12 }, (_, index) =>
      makeMessage(
        String(index + 1),
        index % 2 === 0 ? "user" : "assistant",
        longChunk
      )
    );

    expect(estimateMessagesTokens(messages)).toBeGreaterThan(
      CONTEXT_SUMMARY_TRIGGER_TOKENS
    );

    const plan = buildConversationContextPlan({ messages });

    expect(plan.usesSummary).toBe(true);
    expect(plan.needsSummaryUpdate).toBe(true);
    expect(plan.targetSummarizedCount).toBeGreaterThan(0);
    expect(plan.messagesToSummarize).toHaveLength(plan.targetSummarizedCount);
    expect(plan.recentMessages.length).toBeLessThan(messages.length);
  });

  it("extends an existing summary instead of rebuilding it from scratch", () => {
    const longChunk = "The user is refining a product strategy and cares about cost, latency, and clarity. ".repeat(
      16
    );
    const messages = Array.from({ length: 14 }, (_, index) =>
      makeMessage(
        String(index + 1),
        index % 2 === 0 ? "user" : "assistant",
        longChunk
      )
    );

    const plan = buildConversationContextPlan({
      messages,
      contextSummary: "User cares about low latency and concise explanations.",
      summarizedMessageCount: 4,
    });

    expect(plan.usesSummary).toBe(true);
    expect(plan.targetSummarizedCount).toBeGreaterThanOrEqual(4);
    expect(plan.messagesToSummarize[0]?.id).toBe("5");
  });
});
