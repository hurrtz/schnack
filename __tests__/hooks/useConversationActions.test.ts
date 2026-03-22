import { act, renderHook } from "@testing-library/react-native";

import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";

import { useConversationActions } from "../../src/screens/main/useConversationActions";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

describe("useConversationActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, "share").mockResolvedValue({
      action: "sharedAction",
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resets the voice session before selecting a conversation", async () => {
    const callOrder: string[] = [];
    const resetVoiceSessionState = jest.fn(async () => {
      callOrder.push("reset");
    });
    const selectConversation = jest.fn(async () => {
      callOrder.push("select");
    });

    const { result } = renderHook(() =>
      useConversationActions({
        activeConversation: null,
        memoryConversation: null,
        getConversationById: jest.fn(),
        renameConversation: jest.fn(),
        toggleConversationPinned: jest.fn(),
        clearConversationMemory: jest.fn(),
        selectConversation,
        clearActiveConversation: jest.fn(),
        resetVoiceSessionState,
        openMemoryConversation: jest.fn(),
        setMemoryConversation: jest.fn(),
        showToast: jest.fn(),
        language: "en",
        t: (key) => key,
      }),
    );

    await act(async () => {
      await result.current.handleSelectConversation("conversation-1");
    });

    expect(resetVoiceSessionState).toHaveBeenCalledTimes(1);
    expect(selectConversation).toHaveBeenCalledWith("conversation-1");
    expect(callOrder).toEqual(["reset", "select"]);
  });

  it("copies the active conversation transcript to the clipboard", async () => {
    const showToast = jest.fn();
    const activeConversation = {
      id: "conversation-1",
      title: "Trip planning",
      createdAt: "2026-03-22T10:00:00.000Z",
      updatedAt: "2026-03-22T10:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user" as const,
          content: "Hello there",
          model: null,
          provider: null,
          timestamp: "2026-03-22T10:00:00.000Z",
        },
      ],
    };

    const { result } = renderHook(() =>
      useConversationActions({
        activeConversation,
        memoryConversation: null,
        getConversationById: jest.fn(),
        renameConversation: jest.fn(),
        toggleConversationPinned: jest.fn(),
        clearConversationMemory: jest.fn(),
        selectConversation: jest.fn(),
        clearActiveConversation: jest.fn(),
        resetVoiceSessionState: jest.fn(),
        openMemoryConversation: jest.fn(),
        setMemoryConversation: jest.fn(),
        showToast,
        language: "en",
        t: (key) =>
          ({
            threadCopied: "thread copied",
            nothingToCopyYet: "nothing to copy",
            couldntCopyText: "copy failed",
          }[key] ?? key),
      }),
    );

    await act(async () => {
      await result.current.handleCopyThread();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("Hello there"),
    );
    expect(showToast).toHaveBeenCalledWith("thread copied");
  });

  it("updates memory state after clearing saved conversation memory", async () => {
    const setMemoryConversation = jest.fn();
    const showToast = jest.fn();
    const memoryConversation = {
      id: "conversation-1",
      title: "Trip planning",
      createdAt: "2026-03-22T10:00:00.000Z",
      updatedAt: "2026-03-22T10:00:00.000Z",
      messages: [],
      contextSummary: "Old summary",
      summarizedMessageCount: 3,
    };
    const clearedConversation = {
      ...memoryConversation,
      contextSummary: undefined,
      summarizedMessageCount: undefined,
    };
    const clearConversationMemory = jest.fn(async () => clearedConversation);

    const { result } = renderHook(() =>
      useConversationActions({
        activeConversation: null,
        memoryConversation,
        getConversationById: jest.fn(),
        renameConversation: jest.fn(),
        toggleConversationPinned: jest.fn(),
        clearConversationMemory,
        selectConversation: jest.fn(),
        clearActiveConversation: jest.fn(),
        resetVoiceSessionState: jest.fn(),
        openMemoryConversation: jest.fn(),
        setMemoryConversation,
        showToast,
        language: "en",
        t: (key) =>
          ({
            memoryCleared: "memory cleared",
          }[key] ?? key),
      }),
    );

    await act(async () => {
      await result.current.handleClearMemory();
    });

    expect(clearConversationMemory).toHaveBeenCalledWith("conversation-1");
    expect(setMemoryConversation).toHaveBeenCalledWith(clearedConversation);
    expect(showToast).toHaveBeenCalledWith("memory cleared");
  });
});
