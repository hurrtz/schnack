# SchnackAI User Experience Backlog

## Must

- Voice recovery and trust
  Add a clear way to repeat the last assistant reply, retry speech playback without rerunning the whole model request, and recover from TTS/STT failures without restarting the app.
- Safer credentials UX
  Obfuscate stored API keys by default, allow intentional reveal, and make the current configuration state obvious without exposing secrets.
- Transcript utility
  Let users select and copy specific text from a conversation instead of forcing full-thread copy. Add thread sharing from the live transcript and saved history.
- Provider transparency
  Make the active route explicit: which provider handles speech input, which model handles the reply, and which voice system handles playback.

## Should

- Guided setup
  Add a first-run flow that validates at least one known-good provider stack and explains which voice features require which provider configuration.
- Conversation management
  Add rename, pin, and better export affordances for saved threads so important conversations are easier to find and reuse.
- Human-readable failures
  Convert provider-specific JSON and transport errors into short explanations with concrete next actions.

## Later

- Drive mode
  Explore lock-screen-friendly controls, a simpler in-car interaction model, and interruption-safe recovery.
- Memory controls
  Expose what the app remembers, allow forgetting a session or summary, and make long-session compaction more legible to the user.
- Deeper sharing flows
  Add richer export targets such as Markdown, plain text snippets, and structured summaries.
