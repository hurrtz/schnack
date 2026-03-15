# VoxAI Settings Rework Plan

> **For agentic workers:** Implement this in small checkpoints. Treat the UI shell, settings schema, and voice backend routing as separate commits. Use checkbox tracking as work proceeds.

**Goal:** Rework the settings modal into a tabbed control surface that can support multiple voice backends, provider capability filtering, and future expansion without turning into one long scroll form.

**Primary UX changes requested:**
- Remove the `Conversation System` eyebrow above `Settings`
- Remove the subtitle below `Settings`
- Introduce tabs
- Organize settings into these tabs:
  - `Instructions`
  - `Providers`
  - `STT`
  - `TTS`
  - `UI`
- Add a short tab intro for every tab except `UI`

**Architecture direction:** Split the current flat settings model into three conceptual layers:
- assistant behavior
- provider credentials and model selection
- voice pipeline routing (`STT` and `TTS`)

The UI should become capability-driven. The settings modal should not hardcode which providers appear in STT/TTS dropdowns. Instead, it should derive those lists from provider metadata plus which providers currently have API keys configured.

**Tech stack:** Expo SDK 55, React Native 0.83, React 19, Expo Router, Expo Audio, AsyncStorage, Expo Secure Store

---

## Desired Tab Layout

### 1. Instructions

**Purpose text:** Control how the assistant behaves before any provider receives the request.

**Contains:**
- Existing `Assistant Instructions` section
- Existing `Adaptive Length` picker
- Existing `Response Tone` picker

**Notes:**
- This tab is already logically isolated in the current code and can mostly be moved as-is.
- Keep it designed as the future home for more system-level prompt controls.

---

### 2. Providers

**Purpose text:** Connect providers, manage API keys, and choose the model each provider should use when selected.

**Contains:**
- Current provider icon selector
- Current API key input
- Current `Create API key` external link
- Current per-provider model picker

**Notes:**
- This remains the source of truth for provider enablement.
- A provider is considered enabled when its API key is present.
- STT/TTS tabs must read from this enablement state instead of duplicating key management.

---

### 3. STT

**Purpose text:** Decide how speech is transcribed before it reaches the language model.

**Contains:**
- Existing `Input Mode` setting
- New backend mode selector:
  - `App Native`
  - `Provider`
- New provider picker below it

**Interaction rules:**
- If `App Native` is selected:
  - provider dropdown is visible but disabled, or hidden entirely
  - helper text explains that the device speech recognizer is used
- If `Provider` is selected:
  - provider dropdown becomes enabled
  - options show only providers that:
    - support STT
    - are enabled in `Providers`

**Notes:**
- `Input Mode` belongs here, not in the general top-level settings flow.
- The STT provider picker should never offer providers without credentials.

---

### 4. TTS

**Purpose text:** Decide how replies are spoken and when playback starts.

**Contains:**
- Rename `TTS Playback` to `Reply Playback`
- Existing playback options:
  - `Speak as Sentences Arrive` (current `stream`)
  - `Speak After Full Reply` (current `wait`)
- New backend mode selector:
  - `App Native`
  - `Provider`
- New provider picker below it
- Existing TTS voice selection
- Existing voice preview field and preview button

**Interaction rules:**
- If `App Native` is selected:
  - provider dropdown is disabled or hidden
  - helper text explains that system TTS is used
  - voice picker behavior must be reconsidered because current voices are OpenAI-specific
- If `Provider` is selected:
  - provider dropdown is enabled
  - options show only providers that:
    - support TTS
    - are enabled in `Providers`

**Notes:**
- `Reply Playback` is conceptually about response timing, not just TTS.
- It should remain as a user-facing concept even if backend support varies.
- The current preview flow is provider-specific and OpenAI-specific, so this tab is the biggest architecture shift.

---

### 5. UI

**Contains:**
- Existing `Theme` setting

**Notes:**
- No intro copy needed here, per request.

---

## Required Settings Schema Changes

The current `Settings` type in `src/types.ts` is too flat for this rework. Add explicit routing fields for STT and TTS.

### New types

```ts
export type VoiceBackendMode = "native" | "provider";
export type ReplyPlayback = "stream" | "wait";
```

### New settings fields

```ts
sttMode: VoiceBackendMode;
sttProvider: Provider | null;
ttsMode: VoiceBackendMode;
ttsProvider: Provider | null;
replyPlayback: ReplyPlayback;
```

### Existing fields to review

- `ttsPlayback`
  - likely rename to `replyPlayback`
- `ttsVoice`
  - keep for now, but its semantics become backend-dependent
- `inputMode`
  - stays, but moves to the `STT` tab in the UI

### Migration considerations

- Old installs currently persist `ttsPlayback`
- `useSettings` should map:
  - existing `ttsPlayback` -> new `replyPlayback`
- Default behavior should remain conservative:
  - `sttMode: "provider"`
  - `sttProvider: "openai"` for backward compatibility, or `null` if we want forced explicit choice
  - `ttsMode: "provider"`
  - `ttsProvider: "openai"` for backward compatibility, or `null`
- The migration should avoid breaking users who already have OpenAI configured.

---

## Provider Capability Model

The UI currently only knows whether a provider has:
- branding
- API key hint
- API key URL
- model list

That is no longer enough.

### Extend provider metadata in `src/constants/models.ts`

Add capability flags to `ProviderConfig`:

```ts
sttSupport: "none" | "provider";
ttsSupport: "none" | "provider";
```

Possible future extension:

```ts
nativeRecommendedForTts?: boolean;
nativeRecommendedForStt?: boolean;
```

### Helper selectors to add

- `getEnabledProviders(settings)`
- `getEnabledSttProviders(settings)`
- `getEnabledTtsProviders(settings)`

These helpers should live in a small selector utility instead of being rebuilt inside the modal.

### Important rule

The STT/TTS tabs should derive provider options from metadata plus enabled keys.
They should not each hand-roll filtering logic.

---

## Voice Pipeline Consequences

This rework is not just UI.

The current code path assumes:
- STT = OpenAI Whisper
- TTS = OpenAI TTS

That assumption appears in:
- `src/services/whisper.ts`
- `src/services/tts.ts`
- `src/services/voicePipeline.ts`
- `src/screens/MainScreen.tsx`

### Required backend abstraction

Introduce backend routing for:
- transcription
- speech synthesis

Suggested shape:

```ts
transcribeAudioWithConfiguredBackend(...)
synthesizeSpeechWithConfiguredBackend(...)
```

These should internally branch on:
- `native`
- `provider`

### Phase split

For the settings rework itself, the UI can be built before all non-OpenAI backends exist.
But if the routing fields are added without backend logic, the UI will become misleading.

So implementation should happen in two phases:

1. Add tabbed settings + new schema + capability filtering
2. Wire STT/TTS routing to honor those settings

If phase 2 is deferred, the UI must clearly label unimplemented choices.

---

## UX Decisions To Lock Before Coding

### Decision 1: Disabled vs hidden provider picker

Requested behavior says the dropdown should go from disabled to enabled.

Recommendation:
- keep it visible while disabled
- show muted helper text below it

Why:
- makes the capability model obvious
- avoids layout jump

### Decision 2: Where `TTS Voice` belongs

Recommendation:
- keep it in the `TTS` tab
- only enable it when the active TTS backend supports explicit voice selection

Why:
- current OpenAI-style voice list is not universal
- native TTS will likely use system voices, not this shared list

### Decision 3: Voice preview behavior

Recommendation:
- keep preview in the `TTS` tab
- make it backend-aware

Examples:
- native mode: preview via native TTS
- provider mode: preview via selected provider backend

### Decision 4: Default provider selection when mode = provider

Recommendation:
- auto-select the first enabled compatible provider when the current one becomes invalid

Why:
- matches how `lastProvider` already falls back in the main screen

---

## UI Implementation Plan

## Chunk 1: Settings shell + tabs

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] Remove eyebrow above `Settings`
- [ ] Remove subtitle under `Settings`
- [ ] Add a horizontal tab row under the header
- [ ] Add internal tab state
- [ ] Split modal body into tab panels
- [ ] Keep modal scrolling inside each tab panel instead of one giant shared vertical form

**Expected outcome:**
- cleaner header
- obvious information architecture
- no more “single long settings page” feel

---

## Chunk 2: Settings type + persistence migration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useSettings.ts`
- Modify: `__tests__/hooks/useSettings.test.ts`

- [ ] Add `VoiceBackendMode`
- [ ] Add `sttMode`, `sttProvider`, `ttsMode`, `ttsProvider`
- [ ] Rename or alias `ttsPlayback` -> `replyPlayback`
- [ ] Migrate persisted settings without losing existing user config
- [ ] Add tests for migration defaults and persisted round-trip

**Expected outcome:**
- settings model supports routed voice backends
- existing installs continue to load safely

---

## Chunk 3: Provider capability metadata

**Files:**
- Modify: `src/constants/models.ts`
- Add: `src/utils/providerCapabilities.ts` or similar

- [ ] Extend `ProviderConfig` with STT/TTS capability fields
- [ ] Add selectors for enabled STT/TTS providers
- [ ] Add tests if the selector logic gets non-trivial

**Expected outcome:**
- the modal can render capability-filtered provider dropdowns
- backend routing can reuse the same metadata

---

## Chunk 4: Instructions and Providers tabs

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] Move current assistant controls into `Instructions`
- [ ] Move current provider controls into `Providers`
- [ ] Add the short intro copy to both tabs

**Expected outcome:**
- zero behavior change
- immediate UI simplification

---

## Chunk 5: STT tab

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] Move `Input Mode` into `STT`
- [ ] Add backend mode selector
- [ ] Add provider dropdown with capability filtering
- [ ] Add disabled-state UX for provider dropdown when native STT is selected
- [ ] Add tab intro copy

**Expected outcome:**
- transcription settings become explicit
- future native/provider switching has a home in the UI

---

## Chunk 6: TTS tab

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] Rename `TTS Playback` to `Reply Playback`
- [ ] Keep stream/wait semantics, but update labels to read more clearly
- [ ] Add backend mode selector
- [ ] Add provider dropdown with capability filtering
- [ ] Move `TTS Voice` and preview controls here
- [ ] Add tab intro copy

**Expected outcome:**
- response timing and speech backend live in one place
- TTS configuration is no longer mixed with unrelated settings

---

## Chunk 7: Voice backend routing

**Files:**
- Modify: `src/services/whisper.ts`
- Modify: `src/services/tts.ts`
- Modify: `src/services/voicePipeline.ts`
- Modify: `src/screens/MainScreen.tsx`

- [ ] Introduce backend-aware STT routing
- [ ] Introduce backend-aware TTS routing
- [ ] Ensure voice preview uses the selected TTS backend
- [ ] Update readiness checks in `MainScreen`
- [ ] Make error messages backend-aware

**Expected outcome:**
- settings and runtime actually match
- OpenAI is no longer implicitly required when another supported route is selected

---

## Testing Plan

- [ ] `npx tsc --noEmit`
- [ ] `npm test -- --runInBand --watchman=false __tests__/hooks/useSettings.test.ts`
- [ ] Add tests for provider capability filtering
- [ ] Add tests for STT/TTS backend selection logic
- [ ] Manually verify the modal on a narrow phone viewport
- [ ] Manually verify disabled/enabled dropdown behavior for:
  - no compatible providers enabled
  - one compatible provider enabled
  - several compatible providers enabled

---

## Risks

### Risk 1: TTS voice list becomes misleading

Current `TTS_VOICES` are OpenAI-specific. Once native/provider routing exists, a shared static list may no longer be correct.

**Mitigation:**
- gate the voice picker by active backend
- if needed, split voice selection into backend-specific controls later

### Risk 2: Settings schema churn breaks existing installs

**Mitigation:**
- keep a migration path in `useSettings`
- cover with tests

### Risk 3: UI lands before runtime support

**Mitigation:**
- do not expose nonfunctional backend choices without clear disabled messaging
- or implement the routing in the same milestone

### Risk 4: Tab bar becomes cramped on narrow screens

**Mitigation:**
- use a horizontally scrollable tab row or short labels with careful padding

---

## Recommended Commit Sequence

1. `feat(settings): add tabbed settings shell`
2. `refactor(settings): add voice backend routing fields`
3. `feat(settings): add provider capability filtering`
4. `feat(settings): add stt and tts tabs`
5. `feat(voice): route stt and tts through selected backends`

---

## Short Recommendation

Do not treat this as a pure UI refactor. The moment `STT` and `TTS` become explicit tabs, the app is claiming those are first-class configurable systems. That means the settings schema and the runtime voice pipeline should be redesigned together, not separately.
