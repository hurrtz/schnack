---
status: active
code_paths:
  - src/hooks/useSettings.ts
  - src/hooks/settings/**
dependencies:
  - src/types.ts
  - src/constants/providers/
  - AsyncStorage
  - expo-secure-store
validations:
  - npm test -- --runInBand --watchman=false __tests__/hooks/useSettings.test.ts __tests__/hooks/useSettingsNormalization.test.ts __tests__/hooks/settingsStorage.test.ts
  - npm run typecheck:app
provenance:
  intent: history-backfilled
  validation: test-backed
last_validated_sha: b33648e
---

# Settings Persistence Specification

## Ownership

`useSettings` is the public settings hook. The files in this directory own
storage, legacy migration, normalization, and mutations for the canonical
`Settings` shape declared in `src/types.ts`.

Feature components must use the hook actions rather than writing settings or
provider keys directly.

## Storage Contract

- Public settings use AsyncStorage key `@mrbroccoli/settings`.
- Provider keys use SecureStore keys
  `mrbroccoli.provider_key.<sanitized-provider-id>`.
- `apiKeys` is present in the in-memory `Settings` object for convenient route
  composition but is removed by `toPublicSettings` before JSON persistence.
- Provider validation results are device-local public settings, but are
  intentionally excluded from portable backup.

Writes are serialized per storage key. Reads wait for queued writes to finish,
preventing a stale read or slow earlier mutation from overwriting later state.
Storage failures produce sanitized diagnostics and a user-visible persistence
alert; they do not silently pretend success.

## Load and Migration

Startup loads public settings, SecureStore keys, and runtime capability
overrides before producing the normalized settings snapshot.

A public-settings JSON parse failure is isolated from SecureStore hydration.
Corrupt public JSON still loads provider keys, reports a persistence alert,
and must not be overwritten with defaults. In-memory settings then use current
defaults plus the hydrated keys until the stored public file is valid again.

It also performs a best-effort one-time cleanup of the retired local-response
directory. Cleanup targets only `local-models/llm`; downloaded STT and TTS
artifacts are preserved.

`mergeSettings` owns compatibility with historical installs, including:

- removed or renamed provider IDs and their per-provider maps;
- the historical standalone Grok key, migrated to xAI;
- legacy response-mode names and route shapes;
- provider model aliases and retired model selections;
  - historical scalar fields, invalid enum values, and removed settings;
  - the retired `drive-session` input mode, migrated to `toggle-to-talk`
    because Hands free is now session state rather than a stored mode;
- speech language, voice, and fallback normalization; and
- removal of retired introduction fields and local-response routes while
  preserving local STT/TTS choices; and
- defaults for fields introduced after the stored snapshot was written.

The normalized public shape is written forward after load when it differs from
the stored JSON.

**Decision:** Runtime readers consume one valid current shape. Compatibility is
centralized at hydration rather than implemented as scattered null checks and
fallbacks in screens and services.

## Runtime Capability Overrides

When provider-confirmed incompatibility state changes, `useSettings`
renormalizes response routes and provider selections against the current
manifest and persists the resulting public settings.

Only exact provider evidence may create an override. Temporary authentication,
credit, quota, rate-limit, capacity, network, timeout, generic 404, or server
errors must not permanently remove a model or effort.

## Mutation Rules

- Updating an API key persists only to SecureStore and updates the in-memory
  route state.
- Response modes retain stable IDs while their route may change.
- Adding and removing modes preserves the configured minimum but has no fixed
  maximum; every saved route remains reachable in scrolling Settings and home
  lists.
- Removing the active mode selects a remaining mode atomically.
- Provider/model updates normalize reasoning effort and capability before
  becoming active.
- The legacy-named `ulraModeRounds` field persists Council review rounds. The
  UI presents total rounds (`review rounds + 1`), so zero is a valid stored
  value for a one-round Council and legacy values above four are capped at five
  total rounds.
- Portable restore merges only the approved public subset and preserves local
  secrets and operational diagnostics.

## Change Contract

When `Settings` changes, review together:

- `src/types.ts` and `DEFAULT_SETTINGS`;
- legacy types and both normalization stages in this directory;
- mutation helpers and persistence exclusion rules;
- app-data backup portability;
- Settings UI and main-screen route composition;
- retired-field and retired-artifact cleanup; and
- focused settings, response-mode, and backup tests.

## Evidence

- [`../useSettings.ts`](../useSettings.ts)
- [`storage.ts`](./storage.ts)
- [`mergeStoredSettings.ts`](./mergeStoredSettings.ts)
- [`normalizeStoredScalars.ts`](./normalizeStoredScalars.ts)
- [`../../../__tests__/hooks/settingsStorage.test.ts`](../../../__tests__/hooks/settingsStorage.test.ts)
- [`../../../__tests__/hooks/useSettingsNormalization.test.ts`](../../../__tests__/hooks/useSettingsNormalization.test.ts)
