import { act, renderHook } from "@testing-library/react-native";

import { useMainScreenUiState } from "../../src/screens/main/useMainScreenUiState";

describe("useMainScreenUiState", () => {
  it("opens and closes settings with an optional focus provider", () => {
    const { result } = renderHook(() => useMainScreenUiState());

    act(() => {
      result.current.openSettings("openai");
    });

    expect(result.current.settingsVisible).toBe(true);
    expect(result.current.settingsFocusProvider).toBe("openai");

    act(() => {
      result.current.closeSettings();
    });

    expect(result.current.settingsVisible).toBe(false);
    expect(result.current.settingsFocusProvider).toBeUndefined();
  });

  it("defers drawer actions until dismissal when the drawer is open", () => {
    const { result } = renderHook(() => useMainScreenUiState());
    const action = jest.fn();

    act(() => {
      result.current.setDrawerVisible(true);
    });

    act(() => {
      result.current.runAfterDrawerDismiss(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.drawerVisible).toBe(false);

    act(() => {
      result.current.handleDrawerDismiss();
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("opens and clears the memory modal state", () => {
    const { result } = renderHook(() => useMainScreenUiState());
    const conversation = {
      id: "conversation-1",
      title: "Test conversation",
      createdAt: "2026-03-22T10:00:00.000Z",
      updatedAt: "2026-03-22T10:00:00.000Z",
      messages: [],
    };

    act(() => {
      result.current.openMemoryConversation(conversation);
    });

    expect(result.current.memoryVisible).toBe(true);
    expect(result.current.memoryConversation).toEqual(conversation);

    act(() => {
      result.current.closeMemory();
    });

    expect(result.current.memoryVisible).toBe(false);
    expect(result.current.memoryConversation).toBeNull();
  });
});
