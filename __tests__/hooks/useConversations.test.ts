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
    await act(async () => { result.current.createConversation("Hello, how are you?"); });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe("Hello, how are you?");
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

  it("deletes a conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => { result.current.createConversation("To be deleted"); });
    const id = result.current.conversations[0].id;
    await act(async () => { result.current.deleteConversation(id); });
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversation).toBeNull();
  });
});
