import { buildSystemPrompt } from "../../src/services/llm";
import { DEFAULT_ASSISTANT_INSTRUCTIONS } from "../../src/types";

describe("buildSystemPrompt", () => {
  it("falls back to the default instructions when the custom prompt is empty", () => {
    const prompt = buildSystemPrompt({
      assistantInstructions: "   ",
      responseLength: "normal",
      responseTone: "professional",
    });

    expect(prompt).toContain(DEFAULT_ASSISTANT_INSTRUCTIONS);
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
});
