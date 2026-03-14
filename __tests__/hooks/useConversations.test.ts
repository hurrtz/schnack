import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act } from "@testing-library/react-native";
import { useConversations } from "../../src/hooks/useConversations";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-uuid", () => ({ v4: () => "test-uuid-123" }));

describe("useConversations", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("starts with empty conversation list", () => {
    const { result } = renderHook(() => useConversations());
    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConversation).toBeNull();
  });

  it("creates a new conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation("Hello, how are you?", "gpt-5.4");
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe("Hello, how are you?");
    expect(result.current.conversations[0].lastModel).toBe("gpt-5.4");
    expect(result.current.activeConversation).not.toBeNull();
  });

  it("truncates long titles at word boundary to ~40 chars", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation("This is a very long message that should be truncated at a word boundary for display");
    });
    const title = result.current.conversations[0].title;
    expect(title.length).toBeLessThanOrEqual(43);
    expect(title.endsWith("...")).toBe(true);
  });

  it("adds a message to the active conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => { result.current.createConversation("Test"); });
    await act(async () => {
      result.current.addMessage({ role: "user", content: "Test message", model: null, provider: null });
    });
    expect(result.current.activeConversation!.messages).toHaveLength(1);
  });

  it("appends messages even when using a stale callback from before conversation creation", async () => {
    const { result } = renderHook(() => useConversations());
    const staleAddMessage = result.current.addMessage;

    await act(async () => {
      result.current.createConversation("Test", "gpt-5.4");
    });

    await act(async () => {
      staleAddMessage({
        role: "assistant",
        content: "Reply",
        model: "gpt-5.4",
        provider: "openai",
      });
    });

    expect(result.current.activeConversation?.messages).toHaveLength(1);
    expect(result.current.conversations[0].lastModel).toBe("gpt-5.4");
  });

  it("backfills missing model metadata from stored conversation messages", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "@voxai/conversations") {
        return Promise.resolve(
          JSON.stringify([
            {
              id: "conv-1",
              title: "Existing session",
              updatedAt: "2026-03-14T10:00:00.000Z",
              lastModel: null,
            },
          ])
        );
      }

      if (key === "@voxai/conversation/conv-1") {
        return Promise.resolve(
          JSON.stringify({
            id: "conv-1",
            title: "Existing session",
            createdAt: "2026-03-14T09:00:00.000Z",
            updatedAt: "2026-03-14T10:00:00.000Z",
            messages: [
              {
                id: "m1",
                role: "user",
                content: "Hello",
                model: null,
                provider: null,
                timestamp: "2026-03-14T09:59:00.000Z",
              },
              {
                id: "m2",
                role: "assistant",
                content: "Hi",
                model: "claude-sonnet-4-20250514",
                provider: "anthropic",
                timestamp: "2026-03-14T10:00:00.000Z",
              },
            ],
          })
        );
      }

      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useConversations());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.conversations[0]?.lastModel).toBe(
      "claude-sonnet-4-20250514"
    );
  });

  it("deletes a conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => { result.current.createConversation("To be deleted"); });
    const id = result.current.conversations[0].id;
    await act(async () => { result.current.deleteConversation(id); });
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversation).toBeNull();
  });
});
