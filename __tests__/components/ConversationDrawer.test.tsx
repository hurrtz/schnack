import React from "react";
import { fireEvent, waitFor } from "@testing-library/react-native";

import { ConversationDrawer } from "../../src/components/ConversationDrawer";
import { ConversationMeta } from "../../src/types";
import { renderWithProviders } from "../test-utils/renderWithProviders";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name }: { name: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, name);
  },
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("react-native-gesture-handler", () => ({
  Swipeable: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("../../src/components/ProviderIcon", () => ({
  ProviderIcon: ({ provider }: { provider: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, provider);
  },
}));

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

function renderConversationDrawer(
  overrideProps: Partial<React.ComponentProps<typeof ConversationDrawer>> = {},
) {
  return renderWithProviders(
    <ConversationDrawer
      visible
      conversations={conversations}
      activeId="one"
      onSearchConversations={jest.fn(async (query: string) =>
        conversations.filter((conversation) =>
          conversation.title.toLowerCase().includes(query.toLowerCase()),
        ),
      )}
      onSelect={jest.fn()}
      onCopyThread={jest.fn()}
      onShareThread={jest.fn()}
      onManageMemory={jest.fn()}
      onRenameThread={jest.fn()}
      onTogglePinned={jest.fn()}
      onNewSession={jest.fn(async () => undefined)}
      onDelete={jest.fn()}
      onClose={jest.fn()}
      {...overrideProps}
    />,
  );
}

describe("ConversationDrawer", () => {
  it("renders the drawer shell and existing conversations", () => {
    const screen = renderConversationDrawer();

    expect(screen.getByText("Conversations")).toBeTruthy();
    expect(screen.getByText("Morning briefing")).toBeTruthy();
    expect(screen.getByText("Travel planning")).toBeTruthy();
  });

  it("filters conversations through async search", async () => {
    const onSearchConversations = jest.fn(async () => [conversations[1]]);
    const screen = renderConversationDrawer({ onSearchConversations });

    fireEvent.changeText(
      screen.getByTestId("conversation-drawer-search-input"),
      "travel",
    );

    await waitFor(() => {
      expect(onSearchConversations).toHaveBeenCalledWith("travel");
      expect(screen.getByText("Travel planning")).toBeTruthy();
      expect(screen.queryByText("Morning briefing")).toBeNull();
    });
  });

  it("opens the rename modal from the action sheet and saves the new title", async () => {
    const onRenameThread = jest.fn();
    const screen = renderConversationDrawer({ onRenameThread });

    fireEvent.press(screen.getByTestId("conversation-drawer-menu-one"));

    await waitFor(() => {
      expect(screen.getByTestId("conversation-action-rename")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("conversation-action-rename"));
    fireEvent.changeText(
      screen.getByTestId("conversation-rename-input"),
      "Renamed briefing",
    );
    fireEvent.press(screen.getByTestId("conversation-rename-save"));

    expect(onRenameThread).toHaveBeenCalledWith("one", "Renamed briefing");
  });

  it("starts a new session and closes the drawer", async () => {
    const onNewSession = jest.fn(async () => undefined);
    const onClose = jest.fn();
    const screen = renderConversationDrawer({ onNewSession, onClose });

    fireEvent.press(screen.getByTestId("conversation-drawer-new-session"));

    await waitFor(() => {
      expect(onNewSession).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
