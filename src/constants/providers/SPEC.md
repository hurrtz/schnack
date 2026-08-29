---
status: active
code_paths:
  - src/constants/providers/**
  - src/constants/models.ts
  - src/utils/providerCapabilities.ts
  - src/utils/responseModes.ts
dependencies:
  - data/providers/
  - src/services/runtimeCapabilityOverrides.ts
validations:
  - npm test -- --runInBand --watchman=false __tests__/constants/providers/runtimeManifest.test.ts __tests__/utils/responseModes.test.ts __tests__/utils/modelEffort.test.ts
  - npm run typecheck:app
provenance:
  intent: owner-confirmed and history-backfilled
  validation: test-backed
last_validated_sha: b33648e
---

# Runtime Provider Manifest Specification

## Ownership

`runtimeManifest.ts` is the runtime authority for hosted provider identity,
order, transports, curated model routes, reasoning-effort mapping, key guidance,
STT/TTS capability, speech languages, voice defaults, and voice directories.

`src/constants/models.ts`, picker helpers, route normalization, request
services, and release validation derive from this manifest. `data/providers/`
contains broader researched catalogue material; being present there does not
make a model or provider executable in the app.

## Runtime Provider Set

The runtime contains nine provider IDs:

- LLM-capable: `openai`, `openrouter`, `anthropic`, `gemini`, `xai`,
  `mistral`, `deepseek`, and `alibaba-qwen-dashscope`;
- speech-only: `elevenlabs`.

The ordering is user-visible and stable unless intentionally migrated.
Per-provider maps use the complete runtime provider union so TypeScript catches
an incomplete addition or removal.

## Curated Model Rule

Model lists are an executable product contract, not provider inventory dumps.
A listed route must:

- work through an implemented transport and endpoint shape;
- have a usable, user-facing identity;
- expose only supported reasoning-effort options;
- correctly describe image, STT, TTS, language, and instruction capability;
- participate in defaults, fallback candidates, Settings normalization, and
  release testing; and
- satisfy current provider terms and distribution constraints.

**Decision:** Prefer a canonical stable snapshot over a rolling alias when a
provider offers both for the same model. Keep an alias only when no distinct
stable ID exists. This makes saved routes, diagnostics, and release evidence
reproducible.

OpenAI models currently use the implemented Chat Completions shape; Anthropic
uses Messages; Gemini uses Generate Content. A model requiring a different API
is excluded until its service path exists. OpenAI Realtime model IDs remain
mapped to the incomplete WebSocket adapter for leftover stored routes and
tests, but they are withheld from the user-facing picker until the Realtime
session protocol (`OpenAI-Beta: realtime=v1` and `session.update`) is
implemented.

## Capability Boundaries

LLM, STT, TTS, search, and voice discovery are independent capabilities. A
provider can support any subset, and a key can have permission for one while
failing another.

- `support: none` means the route is not offered.
- A transport value selects the concrete request adapter.
- Default and fallback model IDs must be members of the corresponding curated
  model list.
- Speech language lists describe the provider route, not guaranteed system
  speech availability.
- Voice-directory providers retain a safe fallback list for restricted keys or
  temporarily unavailable directories.

## Runtime Overrides

Device-local overrides remove a precise model or effort only after an explicit
provider response confirms it is unsupported. They filter candidate routes and
Settings options and may trigger normalization.

**Decision:** Overrides are evidence, not remote feature flags. They stay local,
inspectable, and resettable. Authentication, credit, quota, rate-limit,
capacity, network, timeout, generic 404, and server failures are not durable
compatibility evidence.

## Provider Change Checklist

Adding, removing, or changing a provider requires reviewing:

- this manifest, runtime order/state, defaults, and retired-provider migration;
- `src/constants/models.ts` and provider capability helpers;
- response-mode and reasoning-effort normalization;
- Settings connection, picker, readiness, and voice-directory behavior;
- LLM, STT, TTS, and web-search request services;
- provider branding assets;
- API-key SecureStore migration and backup exclusions;
- live matrix derivation, cost reservation, and provider terms; and
- focused manifest, route, settings, and service tests.

## Evidence

- [`runtimeManifest.ts`](./runtimeManifest.ts)
- [`runtimeState.ts`](./runtimeState.ts)
- [`defaults.ts`](./defaults.ts)
- [`retiredProviders.ts`](./retiredProviders.ts)
- [`../../../__tests__/constants/providers/runtimeManifest.test.ts`](../../../__tests__/constants/providers/runtimeManifest.test.ts)
