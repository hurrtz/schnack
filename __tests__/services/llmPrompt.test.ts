import { buildSystemPrompt } from "../../src/services/llm";
import { DEFAULT_ASSISTANT_INSTRUCTIONS } from "../../src/types";

describe("buildSystemPrompt", () => {
  it("falls back to the default instructions when the custom prompt is empty", () => {
    const prompt = buildSystemPrompt({
      assistantInstructions: "   ",
      responseLength: "normal",
      responseTone: "professional",
      language: "en",
    });

    expect(prompt).toContain(DEFAULT_ASSISTANT_INSTRUCTIONS);
    expect(prompt).toContain(
      "Match the language of the user's latest message by default."
    );
    expect(prompt).toContain(
      "Aim for a balanced response length. Cover the important points without dragging the answer out."
    );
    expect(prompt).toContain(
      "Speak like a senior consultant briefing a client. Precise language, no slang, measured and authoritative."
    );
  });

  it("combines custom instructions with the selected length and tone", () => {
    const prompt = buildSystemPrompt({
      assistantInstructions: "Answer like a historian with a strong sense of chronology.",
      responseLength: "thorough",
      responseTone: "nerdy",
      language: "en",
    });

    expect(prompt).toContain(
      "Answer like a historian with a strong sense of chronology."
    );
    expect(prompt).toContain(
      "Go deep and be comprehensive. Include nuance, detail, tradeoffs, and the reasoning that matters."
    );
    expect(prompt).toContain(
      "Speak like an enthusiastic expert who loves going deep. Use technical terminology freely, geek out about details, assume the user can keep up."
    );
  });

  it("appends the compacted conversation summary as background context", () => {
    const prompt = buildSystemPrompt({
      assistantInstructions: "Keep the reply grounded in prior user preferences.",
      responseLength: "brief",
      responseTone: "concise",
      language: "en",
      conversationSummary:
        "User prefers answers in German and is evaluating providers mainly on latency and cost.",
    });

    expect(prompt).toContain(
      "Earlier conversation context for background memory only."
    );
    expect(prompt).toContain(
      "User prefers answers in German and is evaluating providers mainly on latency and cost."
    );
  });
});
