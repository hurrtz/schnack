---
status: active
code_paths:
  - src/services/llm.ts
  - src/services/llm/**
dependencies:
  - src/constants/providers/runtimeManifest.ts
  - src/services/providerResilience.ts
  - src/services/imageAttachmentFiles.ts
validations:
  - npm test -- --runInBand --watchman=false __tests__/services/llm.test.ts __tests__/services/llmImagePayloads.test.ts __tests__/services/llmMessageProvenance.test.ts __tests__/services/llmPrompt.test.ts
  - npm run typecheck:app
provenance:
  intent: history-backfilled
  validation: test-backed
last_validated_sha: b33648e
---

# LLM Service Specification

## Ownership

The LLM service turns a normalized response route, conversation messages, and
explicit context layers into hosted-provider requests. It owns prompt assembly,
transport selection, reasoning-effort mapping, streaming, image payload
preparation, provenance, usage estimation, internal tasks, and response
fallback metadata.

Every normalized response route is a hosted BYOK provider route. Local models
may transcribe or synthesize speech, but do not enter this service as response
generators.

## Transport Boundary

`requestRouter.ts` maps runtime-manifest transports to concrete adapters:

- OpenAI-compatible JSON chat;
- OpenAI Realtime WebSocket;
- Anthropic Messages; and
- Gemini Generate Content.

Provider-specific headers, endpoints, request bodies, stream parsing, and
response metadata stay inside `llm/providers/`. Qwen region selection occurs at
the adapter boundary.

**Decision:** A model is unavailable when its manifest transport is not wired;
the router must not guess an approximately compatible API.

## Prompt Layers and Trust

`buildSystemPrompt` combines only explicitly passed layers:

- assistant instructions and requested response style;
- current provider/model identity and spoken-output guidance;
- compact active-conversation summary;
- source-labelled past-conversation knowledge;
- web-search context; and
- private Model Council synthesis context.

Historical, retrieved, image, search, and deliberation material is labelled as
untrusted data. It cannot override system instructions. Internal context is not
shown to the user unless a product surface explicitly exposes safe provenance
metadata.

Per-conversation response length and tone are the most specific user-selected
style layer. Tone is emitted last in the system prompt and explicitly outranks
broader assistant-style preferences when they conflict; choosing ELI5 must
therefore reach every provider request as a binding plain-language instruction,
not merely as picker metadata.

`contextLeakGuard.ts` inspects streaming output and final text for serialized
internal context. A suspected leak fails the reply rather than displaying or
speaking protected material. Protected text is indexed once and matched with a
rolling stream window; the guard must never rescan the complete response and
private context after every chunk.

## Message Provenance

Assistant messages retain provider/model provenance. Before a conversation is
sent again, provenance markers are normalized so a provider can distinguish
which earlier system produced each assistant answer without labels
accumulating through repeated turns.

Actual-route metadata records fallback model, gateway/upstream identity,
attempts, and context compression where available.

**Decision:** Requested route and actual route are separate facts. Fallback
improves resilience but must not rewrite history as if the original model
answered.

## Images

Before a hosted request with attachments:

1. every selected route must declare image support;
2. the user-facing submission flow must disclose new recipient providers;
3. app-owned file paths are resolved and bytes prepared for the specific
   transport; and
4. image safety instructions are added without trusting image-contained text as
   commands.

Unsupported image routes fail before a paid provider request.

## Streaming and Completion

Hosted replies allow up to five minutes for their first stream activity, so a
transport that accepts a request but never returns data cannot hold a turn
indefinitely. After activity begins, replies use a ten-minute inactivity
timeout. Any stream activity resets that timer on every streaming transport,
including thinking-only phases; an abort signal ends parsing and downstream
callbacks. A timeout always reports through `onError`; it must not lose the
race to a null abort result and return silently.
Chunks may render immediately and feed paragraph TTS, while only the completed
guarded response is persisted.

Callers may impose a provider-independent visible-character ceiling on a
stream. Crossing it aborts the transport and reports an incomplete reply rather
than allowing runaway output to monopolize the JavaScript runtime.

**Decision:** Every exit path cancels the transport. The stream reader is
cancelled when an event handler throws, and the request abort controller is
aborted in the terminal cleanup, so an abandoned stream never keeps a provider
generating a completion the user already paid for and will not receive.

**Decision:** An error-only stream event is not stream progress. Errors are
checked before activity is recorded so retry, effort failover, and model
failover stay available for a turn that produced no content. In-stream error
payloads propagate the provider's status code, and Anthropic stream error
types map to their HTTP equivalents so an overloaded stream classifies like a
5xx response.

Empty replies, malformed streams, unsupported routes, timeout, and provider
errors are localized and classified. Usage remains estimated token counts
unless a route provides compatible usage metadata; provider billing is not
inferred from those counts. Provider-wide quota circuits self-heal after a
bounded pause; authentication and credit circuits persist until the key
changes or the user re-validates.

## Resilience

Requests execute through `providerResilience.ts` and the manifest-derived
candidate list.

- Authentication and credit failures are terminal.
- Explicit unsupported-model/effort responses can create a precise runtime
  override.
- Rate-limit, quota, capacity, network, timeout, and server failures may retry
  or advance through a bounded candidate chain according to failure class.
- Every attempt and actual successful route is retained in metadata.

## Internal Tasks

Conversation summaries, generated titles, and provider connection validation
reuse the same transport and resilience boundaries but have purpose-specific
prompts and result validation.

**Decision:** Internal generated text never becomes hidden authoritative user
data. Summaries remain editable conversation state; titles remain cosmetic;
validation results describe only the tested capability and configuration.

## Evidence

- [`streamChat.ts`](./streamChat.ts)
- [`requestRouter.ts`](./requestRouter.ts)
- [`prompts.ts`](./prompts.ts)
- [`contextLeakGuard.ts`](./contextLeakGuard.ts)
- [`messageProvenance.ts`](./messageProvenance.ts)
- [`../../../__tests__/services/llm.test.ts`](../../../__tests__/services/llm.test.ts)
