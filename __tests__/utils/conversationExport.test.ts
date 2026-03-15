import {
  formatConversationForCopy,
  formatMessageForCopy,
} from "../../src/utils/conversationExport";
import { Conversation, Message } from "../../src/types";

describe("conversationExport", () => {
  it("formats individual user messages for copying", () => {
    const message: Message = {
      id: "m-1",
      role: "user",
      content: "Explain the wind.",
      model: null,
      provider: null,
      timestamp: "2026-03-15T12:00:00.000Z",
    };

    expect(formatMessageForCopy(message)).toBe("You\nExplain the wind.");
  });

  it("formats assistant messages with provider and model labels", () => {
    const message: Message = {
      id: "m-2",
      role: "assistant",
      content: "Wind is moving air.",
      model: "gpt-5.4",
      provider: "openai",
      timestamp: "2026-03-15T12:00:05.000Z",
    };

    expect(formatMessageForCopy(message)).toBe(
      "OpenAI · gpt-5.4\nWind is moving air."
    );
  });

  it("formats full conversations for thread copy", () => {
    const conversation: Conversation = {
      id: "c-1",
      title: "Wind basics",
      createdAt: "2026-03-15T12:00:00.000Z",
      updatedAt: "2026-03-15T12:01:00.000Z",
      messages: [
        {
          id: "m-1",
          role: "user",
          content: "Explain the wind.",
          model: null,
          provider: null,
          timestamp: "2026-03-15T12:00:00.000Z",
        },
        {
          id: "m-2",
          role: "assistant",
          content: "Wind is moving air.",
          model: "gpt-5.4",
          provider: "openai",
          timestamp: "2026-03-15T12:00:05.000Z",
        },
      ],
    };

    expect(formatConversationForCopy(conversation)).toBe(
      [
        "Conversation: Wind basics",
        "You\nExplain the wind.",
        "OpenAI · gpt-5.4\nWind is moving air.",
      ].join("\n\n")
    );
  });
});
