import { act, renderHook, waitFor } from "@testing-library/react-native";

import { ConversationMeta } from "../../../src/types";
import { useConversationDrawerController } from "../../../src/components/conversationDrawer/useConversationDrawerController";

const conversations: ConversationMeta[] = [
  {
    id: "one",
    title: "Morning briefing",
    createdAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-20T08:15:00.000Z",
    messageCount: 4,
    providers: ["openai"],
    providerModels: { openai: ["gpt-5.4"] },
    lastModel: "gpt-5.4",
    lastProvider: "openai",
    pinned: false,
  },
  {
    id: "two",
    title: "Travel planning",
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-20T09:30:00.000Z",
    messageCount: 7,
    providers: ["anthropic"],
    providerModels: { anthropic: ["claude-sonnet-4-5"] },
    lastModel: "claude-sonnet-4-5",
    lastProvider: "anthropic",
    pinned: true,
  },
];

describe("useConversationDrawerController", () => {
  it("resets transient state when the drawer closes", async () => {
    const onSearchConversations = jest.fn(async () => [conversations[1]]);

    const { result, rerender } = renderHook(
      ({ visible }) =>
        useConversationDrawerController({
          visible,
          conversations,
          onSearchConversations,
          onRenameThread: jest.fn(),
          onSelect: jest.fn(),
          onNewSession: jest.fn(),
          onClose: jest.fn(),
        }),
      {
        initialProps: { visible: true },
      },
    );

    act(() => {
      result.current.setSearchQuery("travel");
      result.current.openRenameModal(conversations[0]);
      result.current.openActionConversation(conversations[1].id);
    });

    await waitFor(() => {
      expect(onSearchConversations).toHaveBeenCalledWith("travel");
      expect(result.current.visibleConversations).toEqual([conversations[1]]);
    });

    act(() => {
      rerender({ visible: false });
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.editingConversationId).toBeNull();
    expect(result.current.actionConversation).toBeNull();
    expect(result.current.visibleConversations).toEqual(conversations);
  });

  it("submits a rename and closes the rename modal", () => {
    const onRenameThread = jest.fn();

    const { result } = renderHook(() =>
      useConversationDrawerController({
        visible: true,
        conversations,
        onSearchConversations: jest.fn(async () => conversations),
        onRenameThread,
        onSelect: jest.fn(),
        onNewSession: jest.fn(),
        onClose: jest.fn(),
      }),
    );

    act(() => {
      result.current.openRenameModal(conversations[0]);
    });

    act(() => {
      result.current.setEditingTitle("Renamed thread");
    });

    act(() => {
      result.current.submitRename();
    });

    expect(onRenameThread).toHaveBeenCalledWith("one", "Renamed thread");
    expect(result.current.editingConversationId).toBeNull();
    expect(result.current.editingTitle).toBe("");
  });

  it("closes the drawer after creating a new session", async () => {
    const onNewSession = jest.fn(async () => undefined);
    const onClose = jest.fn();

    const { result } = renderHook(() =>
      useConversationDrawerController({
        visible: true,
        conversations,
        onSearchConversations: jest.fn(async () => conversations),
        onRenameThread: jest.fn(),
        onSelect: jest.fn(),
        onNewSession,
        onClose,
      }),
    );

    await act(async () => {
      result.current.handleNewSession();
      await Promise.resolve();
    });

    expect(onNewSession).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
