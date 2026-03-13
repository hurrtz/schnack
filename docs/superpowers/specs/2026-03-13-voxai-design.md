# VoxAI — Design Spec

**Date:** 2026-03-13
**Platform:** React Native (Expo), iOS priority, Android supported
**Architecture:** Direct API (no backend)

## Overview

VoxAI is a mobile voice conversation app that lets the user speak to any OpenAI or Anthropic model. It solves the problem of existing apps (Claude iOS, ChatGPT iOS) being locked to outdated models for voice conversations.

The voice pipeline: record audio → OpenAI Whisper STT → selected LLM → OpenAI TTS → speaker playback. The user controls the conversation through a single large button that doubles as a live waveform visualizer.

## Voice Pipeline

### Recording

- **Library:** `expo-av` for mic recording
- **Format:** m4a audio file
- **Two input modes (user-selectable in settings):**
  - **Push-to-talk:** Hold button to record, release to stop
  - **Toggle-to-talk:** Tap to start recording, tap again to stop
- **Waveform:** Driven by audio metering data from `expo-av` during recording

### Speech-to-Text

- **Service:** OpenAI Whisper API (batch mode)
- **Flow:** After recording stops, the audio file is sent to Whisper. Language is auto-detected (supports English, German, and mixed input).
- **Empty result:** If Whisper returns blank text, show toast "Couldn't catch that, try again" — do not send to LLM.

### LLM Request

- **Providers:** OpenAI and Anthropic, selected via provider toggle on main screen
- **Model:** Configurable per provider in settings
- **Context:** Full conversation history sent with each request (no truncation in v1)
- **Streaming:** Response streamed via SSE for both providers
- **System prompt:** None (raw model). Personas may be added later.
- **Token limit exceeded:** Show toast "Conversation too long, start a new session."

### Text-to-Speech

- **Service:** OpenAI TTS API
- **Voice:** Configurable in settings (OpenAI TTS voices: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse)
- **Two playback modes (user-selectable in settings):**
  - **Stream (default):** LLM response buffered into sentence-sized chunks (split on `. ! ? \n`). Each chunk sent to TTS independently. Audio chunks queued and played sequentially.
  - **Wait:** Full LLM response collected, then single TTS call, then playback.
- **Waveform:** Driven by audio playback metering data during TTS output
- **Interruption:** User taps button during playback → audio stops immediately, pending TTS chunks cancelled, waveform resets. User can then speak.

## UI Design

### Main Screen — Default View

From top to bottom:

1. **Top bar:** Drawer button (☰, top-left), app title "VoxAI" (center), settings cog (⚙, top-right)
2. **Provider toggle:** Two full-width buttons side by side — "OpenAI" and "Anthropic" — acting as radio buttons. Default: OpenAI (or last-used provider on subsequent launches)
3. **Talk button:** Large circle in the center of the screen, doubling as a live waveform visualizer. Shows audio waveform for both voice input and TTS output.
4. **Chat preview:** Bottom section showing the conversation in WhatsApp-style bubbles. User messages on the right, AI messages on the left. AI messages show the model name (e.g. "gpt-4o") as a small label above the bubble text.

### Main Screen — Expanded Chat View

Triggered by tapping the chat area or scrolling up:

1. **Top bar:** Drawer button (☰, top-left), compact rectangular waveform bar (center, replaces circular button, still acts as talk button), settings cog (⚙, top-right)
2. **Chat area:** Takes up the rest of the screen. Scrollable WhatsApp-style transcript.
3. **Title and provider toggle:** Scrolled out of the viewport (not hidden, just above the visible area).

**Returning to default view:** The entire expanded view is a scrollable container. Scrolling down past the top of the chat content (i.e. pulling down on the page, not within the chat) collapses back to the default layout.

**Pinned elements:** Drawer button and settings cog are always visible in both views.

**Transition:** The circular button morphs into the rectangular bar with an animated transition.

### Settings Modal

Opened via ⚙ button (always top-right). Contains:

- **Input mode:** Push-to-talk / Toggle-to-talk (radio toggle)
- **TTS playback:** Stream / Wait (radio toggle)
- **OpenAI model:** Dropdown, sorted by release date (newest first)
- **Anthropic model:** Dropdown, sorted by release date (newest first)
- **TTS voice:** Dropdown (alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse)
- **Theme:** Light / Dark / System (radio toggle, default: System)

All settings auto-save on change. Modal closed via ✕ button or tapping outside.

### Conversation Drawer

Opened via ☰ button (always top-left). Slides in from the left.

- **First item:** "+ New Session" button (dashed border)
- **Conversation list:** Each item shows:
  - Title (auto-generated from first user message, truncated to ~40 chars at word boundary)
  - Most recently used model (model of the last assistant message in the conversation)
  - Date
- **Active conversation:** Highlighted with accent color border
- **Delete:** Swipe-to-delete on conversation items
- **Selecting a conversation:** Loads its history into the chat view. Speaking continues that conversation.

### Auto-Session

On app launch, the app does not auto-select a previous conversation. Speaking without selecting a conversation creates a new session automatically.

## Data Model

### Settings

```typescript
interface Settings {
  inputMode: "push-to-talk" | "toggle-to-talk";
  ttsPlayback: "stream" | "wait";
  openaiModel: string;
  anthropicModel: string;
  ttsVoice: string;
  theme: "light" | "dark" | "system";
  lastProvider: "openai" | "anthropic";
}
```

### Conversation

```typescript
interface Conversation {
  id: string; // uuid
  title: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  messages: Message[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null; // e.g. "gpt-4o", "claude-sonnet-4-6" — null for user messages
  provider: "openai" | "anthropic" | null; // null for user messages
  timestamp: string; // ISO timestamp
}
```

### Storage

Using `AsyncStorage`:

- `@voxai/settings` — Settings object
- `@voxai/conversations` — Array of conversation metadata (id, title, updatedAt, last model) for fast drawer loading
- `@voxai/conversation/{id}` — Full conversation with messages

### Persistence

- Settings, last-used provider, and all conversations persist across app launches.
- Conversation history can be re-read at any time by selecting a conversation in the drawer.

## API Keys

Hardcoded in a `config.ts` file (gitignored) for now (personal use). Both OpenAI and Anthropic keys are available.

- OpenAI key used for: Whisper STT, Chat Completions, TTS
- Anthropic key used for: Messages API

## Model List

Hardcoded list per provider, sorted by release date (newest first). Models include all currently available chat models for each provider. The list will need manual updates when new models are released.

## Error Handling

| Scenario | Behavior |
|---|---|
| Network failure (STT/LLM/TTS) | Toast with error message + retry button. Retry re-sends the failed step only. |
| Mic permission denied | Prompt to enable in system settings with clear explanation. |
| Empty transcription | Toast "Couldn't catch that, try again." Do not send to LLM. |
| LLM stream interrupted | Partial response kept in chat (marked incomplete). Retry available. |
| TTS failure | Text still appears in chat. Toast "Couldn't play audio." |
| Token limit exceeded | Toast "Conversation too long, start a new session." |
| Concurrent requests | Only one voice pipeline active at a time. Button shows processing state. |

## App Backgrounding

TTS audio continues playing when app is backgrounded (standard `expo-av` behavior).

## Out of Scope (v1)

- Text input (voice-only; users can use Claude/ChatGPT apps for text)
- System prompts / personas
- Conversation history truncation / smart context management
- Backend proxy
- Conversation storage limits
- Real-time streaming STT
- Auto-generated conversation titles via LLM
- Conversation export or sharing
