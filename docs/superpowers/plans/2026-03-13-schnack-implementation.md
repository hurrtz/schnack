# SchnackAI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) voice conversation app that lets users talk to any OpenAI or Anthropic model via Whisper STT and OpenAI TTS.

**Architecture:** Direct API calls from the app — no backend. Audio recorded via `expo-av`, sent to Whisper for transcription, text sent to selected LLM (streamed), response read aloud via OpenAI TTS. All state persisted locally with AsyncStorage.

**Tech Stack:** React Native (Expo SDK 52+), TypeScript, expo-av, expo-router, @react-native-async-storage/async-storage, react-native-reanimated, react-native-gesture-handler

---

## File Structure

```
app/
  _layout.tsx                     # Root layout: ThemeProvider, drawer setup
  index.tsx                       # Entry → MainScreen

src/
  config.ts                       # API keys (gitignored)
  config.example.ts               # Template showing required keys
  types.ts                        # Settings, Conversation, Message interfaces

  constants/
    models.ts                     # Hardcoded model lists per provider

  theme/
    colors.ts                     # Light/dark color tokens
    ThemeContext.tsx               # Theme context + useTheme hook

  hooks/
    useSettings.ts                # Settings CRUD + AsyncStorage persistence
    useConversations.ts           # Conversation CRUD + AsyncStorage persistence
    useAudioRecorder.ts           # expo-av mic recording + metering data
    useAudioPlayer.ts             # expo-av audio playback + metering data

  services/
    whisper.ts                    # OpenAI Whisper STT API call
    llm.ts                        # OpenAI + Anthropic chat streaming
    tts.ts                        # OpenAI TTS API call
    voicePipeline.ts              # Orchestrates: record → STT → LLM → TTS

  components/
    WaveformCircle.tsx            # Large circular waveform + talk button
    WaveformBar.tsx               # Compact rectangular waveform bar
    Waveform.tsx                  # Shared waveform rendering logic (used by both)
    ChatBubble.tsx                # Single message bubble
    ChatTranscript.tsx            # Scrollable list of ChatBubbles
    ProviderToggle.tsx            # Side-by-side OpenAI / Anthropic radio buttons
    SettingsModal.tsx             # Settings modal overlay
    Picker.tsx                    # Dropdown picker used by SettingsModal
    ConversationDrawer.tsx        # Left drawer with conversation list + swipe-to-delete
    Toast.tsx                     # Toast notification component

  screens/
    MainScreen.tsx                # Main screen: default + expanded view states

__tests__/
  services/
    whisper.test.ts
    llm.test.ts
    tts.test.ts
    voicePipeline.test.ts
  hooks/
    useSettings.test.ts
    useConversations.test.ts
```

---

## Chunk 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `app/_layout.tsx`, `app/index.tsx`, `src/config.ts`, `src/config.example.ts`

- [ ] **Step 1: Create Expo project**

```bash
cd /Users/tobias.winkler/Projects/schnack
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-av expo-router @react-native-async-storage/async-storage react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-uuid
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native ts-jest @types/jest
```

- [ ] **Step 4: Create config files**

Create `src/config.ts`:
```typescript
export const OPENAI_API_KEY = "sk-...your-key-here...";
export const ANTHROPIC_API_KEY = "sk-ant-...your-key-here...";
```

Create `src/config.example.ts`:
```typescript
export const OPENAI_API_KEY = "sk-...";
export const ANTHROPIC_API_KEY = "sk-ant-...";
```

- [ ] **Step 5: Add config.ts to .gitignore**

Append to `.gitignore`:
```
src/config.ts
```

- [ ] **Step 6: Configure expo-router**

Update `package.json` to set `"main": "expo-router/entry"`.

Create `app/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `app/index.tsx`:
```typescript
import { View, Text } from "react-native";

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>SchnackAI</Text>
    </View>
  );
}
```

- [ ] **Step 7: Verify app runs**

```bash
npx expo start
```

Scan QR code on phone or press `i` for iOS simulator. Confirm "SchnackAI" text appears.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Expo project with dependencies"
```

---

### Task 2: Types and Constants

**Files:**
- Create: `src/types.ts`, `src/constants/models.ts`

- [ ] **Step 1: Create shared types**

Create `src/types.ts`:
```typescript
export type Provider = "openai" | "anthropic";
export type InputMode = "push-to-talk" | "toggle-to-talk";
export type TtsPlayback = "stream" | "wait";
export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  inputMode: InputMode;
  ttsPlayback: TtsPlayback;
  openaiModel: string;
  anthropicModel: string;
  ttsVoice: string;
  theme: ThemeMode;
  lastProvider: Provider;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: "push-to-talk",
  ttsPlayback: "stream",
  openaiModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",
  ttsVoice: "alloy",
  theme: "system",
  lastProvider: "openai",
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  provider: Provider | null;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  lastModel: string | null;
}
```

- [ ] **Step 2: Create model constants**

Create `src/constants/models.ts`:
```typescript
export interface ModelInfo {
  id: string;
  name: string;
  releaseDate: string; // YYYY-MM-DD for sorting
}

export const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-4.1", name: "GPT-4.1", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", releaseDate: "2025-04-14" },
  { id: "gpt-4o", name: "GPT-4o", releaseDate: "2025-03-25" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", releaseDate: "2024-07-18" },
  { id: "o3", name: "o3", releaseDate: "2025-04-16" },
  { id: "o3-mini", name: "o3 Mini", releaseDate: "2025-01-31" },
  { id: "o4-mini", name: "o4 Mini", releaseDate: "2025-04-16" },
];

export const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", releaseDate: "2025-06-25" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", releaseDate: "2025-06-25" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", releaseDate: "2025-10-01" },
];

export const TTS_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "onyx", "nova", "sage", "shimmer", "verse",
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/constants/models.ts
git commit -m "feat: add shared types, model constants, and default settings"
```

---

### Task 3: Theme System

**Files:**
- Create: `src/theme/colors.ts`, `src/theme/ThemeContext.tsx`

- [ ] **Step 1: Create color tokens**

Create `src/theme/colors.ts`:
```typescript
export const lightColors = {
  background: "#FFFFFF",
  surface: "#F2F2F7",
  text: "#000000",
  textSecondary: "#8E8E93",
  accent: "#4A9EFF",
  accentSoft: "rgba(74, 158, 255, 0.13)",
  bubbleUser: "rgba(74, 158, 255, 0.2)",
  bubbleAssistant: "#E5E5EA",
  border: "#D1D1D6",
  overlay: "rgba(0, 0, 0, 0.4)",
};

export const darkColors = {
  background: "#1A1A2E",
  surface: "#16213E",
  text: "#EEEEEE",
  textSecondary: "#888888",
  accent: "#4A9EFF",
  accentSoft: "rgba(74, 158, 255, 0.13)",
  bubbleUser: "rgba(74, 158, 255, 0.2)",
  bubbleAssistant: "#333333",
  border: "#333333",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export type Colors = typeof lightColors;
```

- [ ] **Step 2: Create theme context**

Create `src/theme/ThemeContext.tsx`:
```typescript
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { lightColors, darkColors, Colors } from "./colors";
import { ThemeMode } from "../types";

interface ThemeContextValue {
  colors: Colors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
});

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const isDark = mode === "system" ? systemScheme !== "light" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(() => ({ colors, isDark }), [colors, isDark]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/theme/
git commit -m "feat: add theme system with light/dark/system modes"
```

---

### Task 4: Settings Persistence

**Files:**
- Create: `src/hooks/useSettings.ts`, `__tests__/hooks/useSettings.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/hooks/useSettings.test.ts`:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act } from "@testing-library/react-native";
import { useSettings } from "../../src/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../src/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe("useSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns default settings when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("loads saved settings from AsyncStorage", async () => {
    const saved = { ...DEFAULT_SETTINGS, lastProvider: "anthropic" as const };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(saved)
    );
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    expect(result.current.settings.lastProvider).toBe("anthropic");
  });

  it("persists settings on update", async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {
      result.current.updateSettings({ lastProvider: "anthropic" });
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@schnackai/settings",
      expect.stringContaining('"lastProvider":"anthropic"')
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/hooks/useSettings.test.ts
```

Expected: FAIL — `useSettings` module not found.

- [ ] **Step 3: Implement useSettings**

Create `src/hooks/useSettings.ts`:
```typescript
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings, DEFAULT_SETTINGS } from "../types";

const STORAGE_KEY = "@schnackai/settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      }
      setLoaded(true);
    });
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  return { settings, updateSettings, loaded };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/hooks/useSettings.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts __tests__/hooks/useSettings.test.ts
git commit -m "feat: add useSettings hook with AsyncStorage persistence"
```

---

### Task 5: Conversation Persistence

**Files:**
- Create: `src/hooks/useConversations.ts`, `__tests__/hooks/useConversations.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/hooks/useConversations.test.ts`:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act } from "@testing-library/react-native";
import { useConversations } from "../../src/hooks/useConversations";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-uuid", () => ({
  v4: () => "test-uuid-123",
}));

describe("useConversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with empty conversation list", () => {
    const { result } = renderHook(() => useConversations());
    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConversation).toBeNull();
  });

  it("creates a new conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation("Hello, how are you?");
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe("Hello, how are you?");
    expect(result.current.activeConversation).not.toBeNull();
  });

  it("truncates long titles at word boundary to ~40 chars", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation(
        "This is a very long message that should be truncated at a word boundary for display"
      );
    });
    const title = result.current.conversations[0].title;
    expect(title.length).toBeLessThanOrEqual(43); // 40 + "..."
    expect(title.endsWith("...")).toBe(true);
  });

  it("adds a message to the active conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation("Test");
    });
    await act(async () => {
      result.current.addMessage({
        role: "user",
        content: "Test message",
        model: null,
        provider: null,
      });
    });
    expect(result.current.activeConversation!.messages).toHaveLength(1);
  });

  it("deletes a conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      result.current.createConversation("To be deleted");
    });
    const id = result.current.conversations[0].id;
    await act(async () => {
      result.current.deleteConversation(id);
    });
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversation).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/hooks/useConversations.test.ts
```

Expected: FAIL — `useConversations` module not found.

- [ ] **Step 3: Implement useConversations**

Create `src/hooks/useConversations.ts`:
```typescript
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import {
  Conversation,
  ConversationMeta,
  Message,
  Provider,
} from "../types";

const META_KEY = "@schnackai/conversations";
const conversationKey = (id: string) => `@schnackai/conversation/${id}`;

function truncateTitle(text: string, max = 40): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(META_KEY).then((raw) => {
      if (raw) setConversations(JSON.parse(raw));
    });
  }, []);

  const saveMeta = useCallback((metas: ConversationMeta[]) => {
    setConversations(metas);
    AsyncStorage.setItem(META_KEY, JSON.stringify(metas));
  }, []);

  const saveConversation = useCallback((conv: Conversation) => {
    AsyncStorage.setItem(conversationKey(conv.id), JSON.stringify(conv));
  }, []);

  const createConversation = useCallback(
    (firstMessage: string) => {
      const now = new Date().toISOString();
      const conv: Conversation = {
        id: uuid.v4() as string,
        title: truncateTitle(firstMessage),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      const meta: ConversationMeta = {
        id: conv.id,
        title: conv.title,
        updatedAt: now,
        lastModel: null,
      };
      saveMeta([meta, ...conversations]);
      saveConversation(conv);
      setActiveConversation(conv);
    },
    [conversations, saveMeta, saveConversation]
  );

  const selectConversation = useCallback(async (id: string) => {
    const raw = await AsyncStorage.getItem(conversationKey(id));
    if (raw) {
      setActiveConversation(JSON.parse(raw));
    }
  }, []);

  const addMessage = useCallback(
    (msg: Omit<Message, "id" | "timestamp">) => {
      if (!activeConversation) return;

      const message: Message = {
        ...msg,
        id: uuid.v4() as string,
        timestamp: new Date().toISOString(),
      };

      const updated: Conversation = {
        ...activeConversation,
        updatedAt: message.timestamp,
        messages: [...activeConversation.messages, message],
      };

      setActiveConversation(updated);
      saveConversation(updated);

      const lastModel =
        msg.role === "assistant" ? msg.model : undefined;
      setConversations((prev) => {
        const next = prev.map((m) =>
          m.id === updated.id
            ? {
                ...m,
                updatedAt: updated.updatedAt,
                ...(lastModel !== undefined ? { lastModel } : {}),
              }
            : m
        );
        AsyncStorage.setItem(META_KEY, JSON.stringify(next));
        return next;
      });
    },
    [activeConversation, saveConversation]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      AsyncStorage.removeItem(conversationKey(id));
      const next = conversations.filter((c) => c.id !== id);
      saveMeta(next);
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    },
    [conversations, activeConversation, saveMeta]
  );

  const clearActiveConversation = useCallback(() => {
    setActiveConversation(null);
  }, []);

  return {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    addMessage,
    deleteConversation,
    clearActiveConversation,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/hooks/useConversations.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useConversations.ts __tests__/hooks/useConversations.test.ts
git commit -m "feat: add useConversations hook with CRUD and persistence"
```

---

## Chunk 2: API Services

### Task 6: Whisper STT Service

**Files:**
- Create: `src/services/whisper.ts`, `__tests__/services/whisper.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/services/whisper.test.ts`:
```typescript
import { transcribeAudio } from "../../src/services/whisper";

global.fetch = jest.fn();

describe("transcribeAudio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends audio file to Whisper API and returns text", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Hello world" }),
    });

    const result = await transcribeAudio("/path/to/audio.m4a");
    expect(result).toBe("Hello world");

    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toMatch(/^Bearer /);
  });

  it("returns null for empty transcription", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "  " }),
    });

    const result = await transcribeAudio("/path/to/audio.m4a");
    expect(result).toBeNull();
  });

  it("throws on API error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(transcribeAudio("/path/to/audio.m4a")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/services/whisper.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement whisper service**

Create `src/services/whisper.ts`:
```typescript
import { OPENAI_API_KEY } from "../config";

export async function transcribeAudio(fileUri: string): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  formData.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.text?.trim();
  return text ? text : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/services/whisper.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/whisper.ts __tests__/services/whisper.test.ts
git commit -m "feat: add Whisper STT service"
```

---

### Task 7: LLM Streaming Service

**Files:**
- Create: `src/services/llm.ts`, `__tests__/services/llm.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/services/llm.test.ts`:
```typescript
import { streamChat } from "../../src/services/llm";
import { Message } from "../../src/types";

global.fetch = jest.fn();

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Hello",
    model: null,
    provider: null,
    timestamp: "2026-01-01T00:00:00Z",
  },
];

describe("streamChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls OpenAI chat completions for openai provider", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const chunks: string[] = [];
    await streamChat({
      messages: mockMessages,
      model: "gpt-4o",
      provider: "openai",
      onChunk: (text) => chunks.push(text),
      onDone: () => {},
      onError: () => {},
    });

    expect(chunks).toEqual(["Hi"]);
    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("calls Anthropic messages API for anthropic provider", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n')
        );
        controller.close();
      },
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const chunks: string[] = [];
    await streamChat({
      messages: mockMessages,
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      onChunk: (text) => chunks.push(text),
      onDone: () => {},
      onError: () => {},
    });

    expect(chunks).toEqual(["Hi"]);
    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/services/llm.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LLM streaming service**

Create `src/services/llm.ts`:
```typescript
import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from "../config";
import { Message, Provider } from "../types";

interface StreamChatParams {
  messages: Message[];
  model: string;
  provider: Provider;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  abortSignal?: AbortSignal;
}

function toOpenAIMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function toAnthropicMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parseLine: (line: string) => string | null,
  isDone: (line: string) => boolean,
  onChunk: (text: string) => void
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (isDone(line)) return fullText;
      const text = parseLine(line);
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
  }

  return fullText;
}

export async function streamChat({
  messages,
  model,
  provider,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: StreamChatParams): Promise<void> {
  try {
    if (provider === "openai") {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: toOpenAIMessages(messages),
            stream: true,
          }),
          signal: abortSignal,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
      }

      const reader = response.body!.getReader();
      const fullText = await readSSEStream(
        reader,
        (line) => {
          if (!line.startsWith("data: ")) return null;
          const json = line.slice(6);
          if (json === "[DONE]") return null;
          const parsed = JSON.parse(json);
          return parsed.choices?.[0]?.delta?.content || null;
        },
        (line) => line === "data: [DONE]",
        onChunk
      );
      onDone(fullText);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: toAnthropicMessages(messages),
          stream: true,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Anthropic API error (${response.status}): ${errText}`
        );
      }

      const reader = response.body!.getReader();
      const fullText = await readSSEStream(
        reader,
        (line) => {
          if (!line.startsWith("data: ")) return null;
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === "content_block_delta") {
            return parsed.delta?.text || null;
          }
          return null;
        },
        (line) => {
          if (!line.startsWith("data: ")) return false;
          try {
            const parsed = JSON.parse(line.slice(6));
            return parsed.type === "message_stop";
          } catch {
            return false;
          }
        },
        onChunk
      );
      onDone(fullText);
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/services/llm.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/llm.ts __tests__/services/llm.test.ts
git commit -m "feat: add LLM streaming service for OpenAI and Anthropic"
```

---

### Task 8: TTS Service

**Files:**
- Create: `src/services/tts.ts`, `__tests__/services/tts.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/services/tts.test.ts`:
```typescript
import { synthesizeSpeech } from "../../src/services/tts";

global.fetch = jest.fn();

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls OpenAI TTS API and returns audio data URI", async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    });

    const result = await synthesizeSpeech("Hello world", "alloy");
    expect(result).toBe(mockArrayBuffer);

    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe("alloy");
    expect(body.input).toBe("Hello world");
  });

  it("throws on API error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    });

    await expect(synthesizeSpeech("Test", "alloy")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/services/tts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TTS service**

Create `src/services/tts.ts`:
```typescript
import { OPENAI_API_KEY } from "../config";

export async function synthesizeSpeech(
  text: string,
  voice: string
): Promise<ArrayBuffer> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: text,
      response_format: "aac",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/services/tts.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/tts.ts __tests__/services/tts.test.ts
git commit -m "feat: add OpenAI TTS service"
```

---

### Task 9: Voice Pipeline Orchestrator

**Files:**
- Create: `src/services/voicePipeline.ts`, `__tests__/services/voicePipeline.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/services/voicePipeline.test.ts`:
```typescript
import { splitIntoSentences } from "../../src/services/voicePipeline";

describe("splitIntoSentences", () => {
  it("splits on period", () => {
    expect(splitIntoSentences("Hello. World.")).toEqual(["Hello.", " World."]);
  });

  it("splits on question mark", () => {
    expect(splitIntoSentences("How? Why?")).toEqual(["How?", " Why?"]);
  });

  it("splits on exclamation mark", () => {
    expect(splitIntoSentences("Wow! Great!")).toEqual(["Wow!", " Great!"]);
  });

  it("splits on newline", () => {
    expect(splitIntoSentences("Line one\nLine two")).toEqual([
      "Line one\n",
      "Line two",
    ]);
  });

  it("returns single chunk for no delimiters", () => {
    expect(splitIntoSentences("hello world")).toEqual(["hello world"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/services/voicePipeline.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement voice pipeline**

Create `src/services/voicePipeline.ts`:
```typescript
import { transcribeAudio } from "./whisper";
import { streamChat } from "./llm";
import { synthesizeSpeech } from "./tts";
import { Message, Provider } from "../types";

export function splitIntoSentences(text: string): string[] {
  const result: string[] = [];
  let current = "";

  for (const char of text) {
    current += char;
    if (char === "." || char === "!" || char === "?" || char === "\n") {
      result.push(current);
      current = "";
    }
  }

  if (current) result.push(current);
  return result;
}

interface PipelineCallbacks {
  onTranscription: (text: string) => void;
  onChunk: (text: string) => void;
  onResponseDone: (fullText: string) => void;
  onAudioReady: (audioData: ArrayBuffer) => void;
  onError: (error: Error) => void;
}

export async function runVoicePipeline(params: {
  audioUri: string;
  messages: Message[];
  model: string;
  provider: Provider;
  ttsVoice: string;
  ttsPlayback: "stream" | "wait";
  callbacks: PipelineCallbacks;
  abortSignal?: AbortSignal;
}): Promise<string | null> {
  const {
    audioUri,
    messages,
    model,
    provider,
    ttsVoice,
    ttsPlayback,
    callbacks,
    abortSignal,
  } = params;

  // Step 1: STT
  const transcription = await transcribeAudio(audioUri);
  if (!transcription) return null;

  callbacks.onTranscription(transcription);

  if (abortSignal?.aborted) return transcription;

  // Step 2: LLM
  const allMessages: Message[] = [
    ...messages,
    {
      id: "pending",
      role: "user",
      content: transcription,
      model: null,
      provider: null,
      timestamp: new Date().toISOString(),
    },
  ];

  let sentenceBuffer = "";
  const ttsQueue: Promise<void>[] = [];

  const enqueueTts = (sentence: string) => {
    const promise = synthesizeSpeech(sentence, ttsVoice)
      .then((audio) => {
        if (!abortSignal?.aborted) {
          callbacks.onAudioReady(audio);
        }
      })
      .catch(callbacks.onError);
    ttsQueue.push(promise);
  };

  await streamChat({
    messages: allMessages,
    model,
    provider,
    abortSignal,
    onChunk: (text) => {
      if (abortSignal?.aborted) return;
      callbacks.onChunk(text);

      if (ttsPlayback === "stream") {
        sentenceBuffer += text;
        const sentences = splitIntoSentences(sentenceBuffer);
        if (sentences.length > 1) {
          // All complete sentences except the last (possibly incomplete) one
          for (let i = 0; i < sentences.length - 1; i++) {
            enqueueTts(sentences[i]);
          }
          sentenceBuffer = sentences[sentences.length - 1];
        }
      }
    },
    onDone: async (fullText) => {
      if (abortSignal?.aborted) return;
      callbacks.onResponseDone(fullText);

      if (ttsPlayback === "stream") {
        // Flush remaining buffer
        if (sentenceBuffer.trim()) {
          enqueueTts(sentenceBuffer);
        }
      } else {
        // Wait mode: single TTS call for entire response
        enqueueTts(fullText);
      }
    },
    onError: callbacks.onError,
  });

  await Promise.all(ttsQueue);
  return transcription;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/services/voicePipeline.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/voicePipeline.ts __tests__/services/voicePipeline.test.ts
git commit -m "feat: add voice pipeline orchestrator with sentence chunking"
```

---

## Chunk 3: Audio Hooks

### Task 10: Audio Recorder Hook

**Files:**
- Create: `src/hooks/useAudioRecorder.ts`

- [ ] **Step 1: Implement audio recorder hook**

Create `src/hooks/useAudioRecorder.ts`:
```typescript
import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export interface RecorderState {
  isRecording: boolean;
  meteringData: number; // dB level, -160 to 0
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    meteringData: -160,
  });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission not granted");
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    await recording.startAsync();
    recordingRef.current = recording;

    setState({ isRecording: true, meteringData: -160 });

    meteringInterval.current = setInterval(async () => {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          setState((prev) => ({ ...prev, meteringData: status.metering! }));
        }
      }
    }, 100);
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (meteringInterval.current) {
      clearInterval(meteringInterval.current);
      meteringInterval.current = null;
    }

    if (!recordingRef.current) return null;

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    setState({ isRecording: false, meteringData: -160 });
    return uri;
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
```

- [ ] **Step 2: Verify hook compiles**

```bash
npx tsc --noEmit src/hooks/useAudioRecorder.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAudioRecorder.ts
git commit -m "feat: add audio recorder hook with metering"
```

---

### Task 11: Audio Player Hook

**Files:**
- Create: `src/hooks/useAudioPlayer.ts`

- [ ] **Step 1: Implement audio player hook**

Create `src/hooks/useAudioPlayer.ts`:
```typescript
import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export interface PlayerState {
  isPlaying: boolean;
  meteringData: number;
}

export function useAudioPlayer() {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    meteringData: -160,
  });
  const soundRef = useRef<Audio.Sound | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playNext = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;
    if (queueRef.current.length === 0) {
      setState({ isPlaying: false, meteringData: -160 });
      return;
    }

    playingRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: true }));

    const audioData = queueRef.current.shift()!;

    // Write audio buffer to temp file for expo-av
    const path = `${FileSystem.cacheDirectory}tts-${Date.now()}.aac`;
    await FileSystem.writeAsStringAsync(
      path,
      arrayBufferToBase64(audioData),
      { encoding: FileSystem.EncodingType.Base64 }
    );

    const { sound } = await Audio.Sound.createAsync({ uri: path });
    soundRef.current = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        if (meteringIntervalRef.current) {
          clearInterval(meteringIntervalRef.current);
          meteringIntervalRef.current = null;
        }
        sound.unloadAsync();
        soundRef.current = null;
        playingRef.current = false;
        // Play next in queue
        playNext();
      }
    });

    await sound.playAsync();

    // Simulate metering during playback (expo-av Sound doesn't expose metering)
    meteringIntervalRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        meteringData: -20 + Math.random() * 20, // Simulate voice-level metering
      }));
    }, 100);
  }, []);

  const enqueueAudio = useCallback(
    (audioData: ArrayBuffer) => {
      if (cancelledRef.current) return;
      queueRef.current.push(audioData);
      if (!playingRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  const stopPlayback = useCallback(async () => {
    cancelledRef.current = true;
    queueRef.current = [];
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    playingRef.current = false;
    setState({ isPlaying: false, meteringData: -160 });
  }, []);

  const resetCancellation = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return {
    ...state,
    enqueueAudio,
    stopPlayback,
    resetCancellation,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

- [ ] **Step 2: Add expo-file-system dependency**

```bash
npx expo install expo-file-system
```

- [ ] **Step 3: Verify hook compiles**

```bash
npx tsc --noEmit src/hooks/useAudioPlayer.ts
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAudioPlayer.ts
git commit -m "feat: add audio player hook with queue and cancellation"
```

---

## Chunk 4: UI Components

### Task 12: Toast Component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Implement Toast**

Create `src/components/Toast.tsx`:
```typescript
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  duration?: number;
}

export function Toast({
  message,
  visible,
  onDismiss,
  onRetry,
  duration = 4000,
}: ToastProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });

      if (!onRetry) {
        opacity.value = withDelay(duration, withTiming(0, { duration: 200 }));
        translateY.value = withDelay(
          duration,
          withTiming(-20, { duration: 200 })
        );
        const timer = setTimeout(onDismiss, duration + 200);
        return () => clearTimeout(timer);
      }
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-20, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={[styles.retry, { color: colors.accent }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1000,
  },
  message: { fontSize: 14, flex: 1 },
  retry: { fontSize: 14, fontWeight: "600", marginLeft: 12 },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/Toast.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add Toast component with retry support"
```

---

### Task 13: Waveform Components

**Files:**
- Create: `src/components/Waveform.tsx`, `src/components/WaveformCircle.tsx`, `src/components/WaveformBar.tsx`

- [ ] **Step 1: Implement shared waveform rendering**

Create `src/components/Waveform.tsx`:
```typescript
import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";

interface WaveformProps {
  metering: number; // -160 to 0
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  maxHeight: number;
  horizontal?: boolean;
}

export function Waveform({
  metering,
  barCount = 20,
  barWidth = 3,
  barGap = 2,
  maxHeight,
  horizontal = false,
}: WaveformProps) {
  const { colors } = useTheme();
  // Normalize metering from [-160, 0] to [0, 1]
  const normalized = Math.max(0, (metering + 160) / 160);

  const bars = Array.from({ length: barCount }, (_, i) => {
    // Create variation per bar using simple deterministic pattern
    const variation = Math.sin(i * 0.7 + Date.now() * 0.001) * 0.3 + 0.7;
    const height = Math.max(
      4,
      normalized * maxHeight * variation
    );
    return height;
  });

  return (
    <View
      style={[
        styles.container,
        horizontal ? styles.horizontal : styles.vertical,
      ]}
    >
      {bars.map((height, i) => (
        <AnimatedBar
          key={i}
          height={height}
          width={barWidth}
          color={colors.accent}
          gap={barGap}
        />
      ))}
    </View>
  );
}

function AnimatedBar({
  height,
  width,
  color,
  gap,
}: {
  height: number;
  width: number;
  color: string;
  gap: number;
}) {
  const style = useAnimatedStyle(() => ({
    height: withSpring(height, { damping: 15, stiffness: 200 }),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          backgroundColor: color,
          borderRadius: width / 2,
          marginHorizontal: gap / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  vertical: {
    flexDirection: "row",
  },
  horizontal: {
    flexDirection: "row",
  },
});
```

- [ ] **Step 2: Implement circular waveform button**

Create `src/components/WaveformCircle.tsx`:
```typescript
import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";

interface WaveformCircleProps {
  metering: number;
  isActive: boolean; // recording or playing
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformCircle({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={[
        styles.circle,
        {
          borderColor: isActive ? colors.accent : colors.border,
          backgroundColor: isActive ? colors.accentSoft : "transparent",
        },
      ]}
    >
      <Waveform metering={metering} maxHeight={60} barCount={16} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 3: Implement rectangular waveform bar**

Create `src/components/WaveformBar.tsx`:
```typescript
import React from "react";
import { TouchableOpacity, StyleSheet, GestureResponderEvent } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";

interface WaveformBarProps {
  metering: number;
  isActive: boolean;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

export function WaveformBar({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformBarProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={[
        styles.bar,
        {
          borderColor: isActive ? colors.accent : colors.border,
          backgroundColor: isActive ? colors.accentSoft : colors.surface,
        },
      ]}
    >
      <Waveform
        metering={metering}
        maxHeight={24}
        barCount={24}
        barWidth={2}
        barGap={1}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
```

- [ ] **Step 4: Verify all compile**

```bash
npx tsc --noEmit src/components/Waveform.tsx src/components/WaveformCircle.tsx src/components/WaveformBar.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Waveform.tsx src/components/WaveformCircle.tsx src/components/WaveformBar.tsx
git commit -m "feat: add waveform components (circle and bar variants)"
```

---

### Task 14: Chat Components

**Files:**
- Create: `src/components/ChatBubble.tsx`, `src/components/ChatTranscript.tsx`

- [ ] **Step 1: Implement ChatBubble**

Create `src/components/ChatBubble.tsx`:
```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.bubbleUser }]
            : [
                styles.bubbleAssistant,
                { backgroundColor: colors.bubbleAssistant },
              ],
        ]}
      >
        {!isUser && message.model && (
          <Text style={[styles.modelLabel, { color: colors.textSecondary }]}>
            {message.model}
          </Text>
        )}
        <Text style={[styles.content, { color: colors.text }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 3, paddingHorizontal: 16 },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 12 },
  bubbleUser: { borderBottomRightRadius: 2 },
  bubbleAssistant: { borderBottomLeftRadius: 2 },
  modelLabel: { fontSize: 10, marginBottom: 2 },
  content: { fontSize: 14, lineHeight: 20 },
});
```

- [ ] **Step 2: Implement ChatTranscript**

Create `src/components/ChatTranscript.tsx`:
```typescript
import React, { useRef, useEffect } from "react";
import { FlatList, StyleSheet } from "react-native";
import { ChatBubble } from "./ChatBubble";
import { Message } from "../types";

interface ChatTranscriptProps {
  messages: Message[];
  onTap?: () => void;
}

export function ChatTranscript({ messages, onTap }: ChatTranscriptProps) {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ChatBubble message={item} />}
      contentContainerStyle={styles.list}
      onTouchStart={onTap}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8 },
});
```

- [ ] **Step 3: Verify both compile**

```bash
npx tsc --noEmit src/components/ChatBubble.tsx src/components/ChatTranscript.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatBubble.tsx src/components/ChatTranscript.tsx
git commit -m "feat: add ChatBubble and ChatTranscript components"
```

---

### Task 15: Provider Toggle

**Files:**
- Create: `src/components/ProviderToggle.tsx`

- [ ] **Step 1: Implement ProviderToggle**

Create `src/components/ProviderToggle.tsx`:
```typescript
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();

  const button = (provider: Provider, label: string) => {
    const active = selected === provider;
    return (
      <TouchableOpacity
        style={[
          styles.button,
          {
            borderColor: active ? colors.accent : "transparent",
            backgroundColor: colors.surface,
          },
        ]}
        onPress={() => onSelect(provider)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.label,
            { color: active ? colors.accent : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {button("openai", "OpenAI")}
      {button("anthropic", "Anthropic")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
  },
  label: { fontSize: 14, fontWeight: "600" },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/ProviderToggle.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ProviderToggle.tsx
git commit -m "feat: add ProviderToggle component"
```

---

### Task 16: Settings Modal

**Files:**
- Create: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Implement SettingsModal**

Create `src/components/SettingsModal.tsx`:
```typescript
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Settings, InputMode, TtsPlayback, ThemeMode } from "../types";
import { OPENAI_MODELS, ANTHROPIC_MODELS, TTS_VOICES } from "../constants/models";
import { Picker } from "./Picker";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  onClose: () => void;
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.radioRow}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.radioButton,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.background,
                },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <Text
                style={[
                  styles.radioLabel,
                  { color: active ? colors.accent : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsModal({
  visible,
  settings,
  onUpdate,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.modal, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.background }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView>
            <RadioGroup<InputMode>
              label="Input Mode"
              options={[
                { value: "push-to-talk", label: "Push to Talk" },
                { value: "toggle-to-talk", label: "Toggle to Talk" },
              ]}
              value={settings.inputMode}
              onChange={(v) => onUpdate({ inputMode: v })}
            />

            <RadioGroup<TtsPlayback>
              label="TTS Playback"
              options={[
                { value: "stream", label: "Stream" },
                { value: "wait", label: "Wait" },
              ]}
              value={settings.ttsPlayback}
              onChange={(v) => onUpdate({ ttsPlayback: v })}
            />

            <Picker
              label="OpenAI Model"
              value={settings.openaiModel}
              options={OPENAI_MODELS.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(v) => onUpdate({ openaiModel: v })}
            />

            <Picker
              label="Anthropic Model"
              value={settings.anthropicModel}
              options={ANTHROPIC_MODELS.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(v) => onUpdate({ anthropicModel: v })}
            />

            <Picker
              label="TTS Voice"
              value={settings.ttsVoice}
              options={TTS_VOICES.map((v) => ({
                value: v,
                label: v.charAt(0).toUpperCase() + v.slice(1),
              }))}
              onChange={(v) => onUpdate({ ttsVoice: v })}
            />

            <RadioGroup<ThemeMode>
              label="Theme"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              value={settings.theme}
              onChange={(v) => onUpdate({ theme: v })}
            />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "700" },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  radioRow: { flexDirection: "row", gap: 6 },
  radioButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  radioLabel: { fontSize: 12, fontWeight: "600" },
});
```

- [ ] **Step 2: Create Picker helper component**

Create `src/components/Picker.tsx`:
```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";

interface PickerProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function Picker({ label, value, options, onChange }: PickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TouchableOpacity
        style={[
          styles.dropdown,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: colors.text, fontSize: 13 }}>
          {selected?.label || value}
        </Text>
        <Text style={{ color: colors.textSecondary }}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={[styles.list, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    {
                      backgroundColor:
                        item.value === value
                          ? colors.accentSoft
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  dropdown: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  list: {
    width: "80%",
    maxHeight: "60%",
    borderRadius: 12,
    padding: 8,
  },
  option: {
    padding: 12,
    borderRadius: 8,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/Picker.tsx
git commit -m "feat: add SettingsModal with Picker component"
```

---

### Task 17: Conversation Drawer

**Files:**
- Create: `src/components/ConversationDrawer.tsx`

- [ ] **Step 1: Implement ConversationDrawer**

Create `src/components/ConversationDrawer.tsx`:
```typescript
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../theme/ThemeContext";
import { ConversationMeta } from "../types";

interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConversationDrawer({
  visible,
  conversations,
  activeId,
  onSelect,
  onNewSession,
  onDelete,
  onClose,
}: ConversationDrawerProps) {
  const { colors } = useTheme();

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => onDelete(id)}
    >
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View
          style={[styles.drawer, { backgroundColor: colors.surface }]}
        >
          <View
            style={[styles.header, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Conversations
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.newSession,
              { borderColor: colors.accent },
            ]}
            onPress={() => {
              onNewSession();
              onClose();
            }}
          >
            <Text style={[styles.newSessionText, { color: colors.accent }]}>
              + New Session
            </Text>
          </TouchableOpacity>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                <TouchableOpacity
                  style={[
                    styles.item,
                    {
                      borderLeftColor:
                        item.id === activeId ? colors.accent : "transparent",
                      backgroundColor:
                        item.id === activeId ? colors.accentSoft : "transparent",
                    },
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Text
                    style={[styles.itemTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.itemMeta}>
                    <Text
                      style={[
                        styles.itemModel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.lastModel || "—"}
                    </Text>
                    <Text
                      style={[
                        styles.itemDate,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatDate(item.updatedAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            )}
          />
        </View>

        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  drawer: { width: "80%", flex: 1 },
  backdrop: { width: "20%", backgroundColor: "rgba(0,0,0,0.5)" },
  header: {
    padding: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "700" },
  newSession: {
    margin: 12,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
  },
  newSessionText: { fontSize: 13, fontWeight: "600" },
  item: {
    padding: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
  },
  itemTitle: { fontSize: 13, fontWeight: "600", marginBottom: 3 },
  itemMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemModel: { fontSize: 10 },
  itemDate: { fontSize: 10 },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  deleteText: { color: "white", fontWeight: "600", fontSize: 13 },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/ConversationDrawer.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConversationDrawer.tsx
git commit -m "feat: add ConversationDrawer with swipe-to-delete"
```

---

## Chunk 5: Main Screen & Integration

### Task 18: Main Screen

**Files:**
- Create: `src/screens/MainScreen.tsx`
- Modify: `app/index.tsx`, `app/_layout.tsx`

- [ ] **Step 1: Implement MainScreen**

Create `src/screens/MainScreen.tsx`:
```typescript
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { useSettings } from "../hooks/useSettings";
import { useConversations } from "../hooks/useConversations";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { runVoicePipeline } from "../services/voicePipeline";
import { WaveformCircle } from "../components/WaveformCircle";
import { WaveformBar } from "../components/WaveformBar";
import { ChatTranscript } from "../components/ChatTranscript";
import { ProviderToggle } from "../components/ProviderToggle";
import { SettingsModal } from "../components/SettingsModal";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { Toast } from "../components/Toast";
import { Provider } from "../types";

type ViewMode = "default" | "expanded";

export function MainScreen() {
  const { colors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    addMessage,
    deleteConversation,
    clearActiveConversation,
  } = useConversations();

  const recorder = useAudioRecorder();
  const player = useAudioPlayer();

  const [viewMode, setViewMode] = useState<ViewMode>("default");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    onRetry?: () => void;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const provider = settings.lastProvider;
  const model =
    provider === "openai" ? settings.openaiModel : settings.anthropicModel;

  const isActive = recorder.isRecording || player.isPlaying || processing;
  const metering = recorder.isRecording
    ? recorder.meteringData
    : player.isPlaying
      ? player.meteringData
      : -160;

  const showToast = useCallback(
    (message: string, onRetry?: () => void) => {
      setToast({ message, onRetry });
    },
    []
  );

  const handleRecordingDone = useCallback(
    async (audioUri: string) => {
      setProcessing(true);
      abortRef.current = new AbortController();
      player.resetCancellation();

      try {
        const transcription = await new Promise<string | null>(
          (resolve, reject) => {
            runVoicePipeline({
              audioUri,
              messages: activeConversation?.messages || [],
              model,
              provider,
              ttsVoice: settings.ttsVoice,
              ttsPlayback: settings.ttsPlayback,
              abortSignal: abortRef.current!.signal,
              callbacks: {
                onTranscription: (text) => {
                  // createConversation sets activeConversation synchronously
                  // in the same render cycle, so addMessage must be deferred
                  // to the next tick to read the updated state.
                  if (!activeConversation) {
                    createConversation(text);
                  }
                  // addMessage is called from within the pipeline after
                  // createConversation has set the active conversation.
                  // Use setTimeout to ensure React state has flushed.
                  setTimeout(() => {
                    addMessage({
                      role: "user",
                      content: text,
                      model: null,
                      provider: null,
                    });
                  }, 0);
                  resolve(text);
                },
                onChunk: (text) => {
                  setStreamingText((prev) => prev + text);
                },
                onResponseDone: (fullText) => {
                  setStreamingText("");
                  addMessage({
                    role: "assistant",
                    content: fullText,
                    model,
                    provider,
                  });
                },
                onAudioReady: (audioData) => {
                  player.enqueueAudio(audioData);
                },
                onError: (error) => {
                  showToast(error.message, () =>
                    handleRecordingDone(audioUri)
                  );
                  reject(error);
                },
              },
            });
          }
        );

        if (!transcription) {
          showToast("Couldn't catch that, try again.");
        }
      } catch {
        // Error already handled via onError callback
      } finally {
        setProcessing(false);
      }
    },
    [
      activeConversation,
      model,
      provider,
      settings.ttsVoice,
      settings.ttsPlayback,
      addMessage,
      createConversation,
      player,
      showToast,
    ]
  );

  const handlePressIn = useCallback(async () => {
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
    }
    await recorder.startRecording();
  }, [player, recorder]);

  const handlePressOut = useCallback(async () => {
    const uri = await recorder.stopRecording();
    if (uri) handleRecordingDone(uri);
  }, [recorder, handleRecordingDone]);

  const handleTogglePress = useCallback(async () => {
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
      return;
    }
    if (recorder.isRecording) {
      const uri = await recorder.stopRecording();
      if (uri) handleRecordingDone(uri);
    } else {
      await recorder.startRecording();
    }
  }, [player, recorder, handleRecordingDone]);

  const handleProviderChange = useCallback(
    (p: Provider) => {
      updateSettings({ lastProvider: p });
    },
    [updateSettings]
  );

  const handleExpandChat = useCallback(() => {
    setViewMode("expanded");
  }, []);

  // Build display messages: actual messages + streaming partial if active
  const baseMessages = activeConversation?.messages || [];
  const messages = streamingText
    ? [
        ...baseMessages,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamingText,
          model,
          provider,
          timestamp: new Date().toISOString(),
        },
      ]
    : baseMessages;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Toast */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onDismiss={() => setToast(null)}
        onRetry={toast?.onRetry}
      />

      {viewMode === "default" ? (
        <>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setDrawerVisible(true)}
            >
              <Text style={{ color: colors.text }}>☰</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>SchnackAI</Text>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ color: colors.text }}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Provider toggle */}
          <ProviderToggle
            selected={provider}
            onSelect={handleProviderChange}
          />

          {/* Main button */}
          <View style={styles.buttonArea}>
            <WaveformCircle
              metering={metering}
              isActive={isActive}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
          </View>

          {/* Chat preview */}
          <View
            style={[styles.chatPreview, { backgroundColor: colors.surface }]}
          >
            <ChatTranscript
              messages={messages}
              onTap={handleExpandChat}
            />
          </View>
        </>
      ) : (
        <>
          {/* Compact top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setDrawerVisible(true)}
            >
              <Text style={{ color: colors.text }}>☰</Text>
            </TouchableOpacity>
            <WaveformBar
              metering={metering}
              isActive={isActive}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ color: colors.text }}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Full chat */}
          <View style={styles.expandedChat}>
            <ChatTranscript messages={messages} />
          </View>

          {/* Pull down to collapse */}
          <TouchableOpacity
            style={styles.collapseHint}
            onPress={() => setViewMode("default")}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              ▼ Back to main view
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modals */}
      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        onUpdate={updateSettings}
        onClose={() => setSettingsVisible(false)}
      />
      <ConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeId={activeConversation?.id || null}
        onSelect={selectConversation}
        onNewSession={clearActiveConversation}
        onDelete={deleteConversation}
        onClose={() => setDrawerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatPreview: {
    maxHeight: 160,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  expandedChat: { flex: 1 },
  collapseHint: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
```

- [ ] **Step 2: Update app/_layout.tsx to wire ThemeProvider**

Replace `app/_layout.tsx`:
```typescript
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { ThemeProvider } from "../src/theme/ThemeContext";
import { useSettings } from "../src/hooks/useSettings";

function RootLayoutInner() {
  const { settings } = useSettings();

  return (
    <ThemeProvider mode={settings.theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutInner />
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Update app/index.tsx**

Replace `app/index.tsx`:
```typescript
import { MainScreen } from "../src/screens/MainScreen";

export default function Index() {
  return <MainScreen />;
}
```

- [ ] **Step 4: Verify app runs**

```bash
npx expo start
```

Open on device/simulator. Verify:
- Title "SchnackAI" visible
- Provider toggle shows OpenAI / Anthropic
- Circular button visible
- Settings modal opens via ⚙
- Drawer opens via ☰

- [ ] **Step 5: Commit**

```bash
git add src/screens/MainScreen.tsx app/_layout.tsx app/index.tsx
git commit -m "feat: add MainScreen with full UI integration"
```

---

### Task 19: End-to-End Manual Test

- [ ] **Step 1: Add real API keys to config.ts**

Edit `src/config.ts` with actual OpenAI and Anthropic API keys.

- [ ] **Step 2: Test full voice pipeline on device**

Open app on physical iPhone. Test the following:

1. **Push-to-talk:** Hold button, speak "Hello", release. Verify:
   - Waveform animates while holding
   - Text appears in chat (user bubble + AI bubble)
   - AI response is read aloud
   - Waveform animates during playback

2. **Toggle-to-talk:** Switch to toggle mode in settings. Tap button, speak, tap again. Verify same flow.

3. **Provider switch:** Select Anthropic. Speak. Verify response comes from Anthropic model (check model label on bubble).

4. **Interruption:** Start a conversation. While AI is speaking, tap button. Verify audio stops.

5. **Settings:** Change model, voice, theme. Verify each takes effect.

6. **Conversations:** Open drawer. Create new session. Switch between conversations. Delete one.

7. **Persistence:** Kill and reopen app. Verify last provider is restored and conversations are listed.

- [ ] **Step 3: Fix any issues found**

Address bugs discovered during manual testing.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final adjustments from manual testing"
```

---

### Task 20: Gitignore and Cleanup

- [ ] **Step 1: Update .gitignore**

Ensure `.gitignore` includes:
```
src/config.ts
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update gitignore for config and superpowers"
```
