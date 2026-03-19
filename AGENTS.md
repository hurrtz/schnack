# SchnackAI Agent Notes

These notes are specific to this repository and supplement any parent-level instructions.

## Project Shape

- SchnackAI is a voice-first mobile chat app built with Expo, React Native, and Expo Router.
- The real app entry is `app/index.tsx`, which renders `src/screens/MainScreen.tsx`.
- `app/_layout.tsx` is the root wrapper and provides `SettingsProvider`, localization, theme, and gesture handling.
- `App.tsx` is still the Expo template stub and is not the real runtime entry point for the app.

## Main Architecture

- `src/screens/MainScreen.tsx` is the main application surface and orchestrates recording, transcription, LLM requests, playback, setup flow, and settings modal state.
- `src/components/SettingsModal.tsx` is the central configuration UI and owns most provider, response mode, STT, TTS, and UI settings controls.
- `src/components/ResponseModeToggle.tsx` is the home-screen selector for `quick`, `normal`, and `deep`.
- `src/components/ProviderToggle.tsx` still exists, but the primary home-screen switching model is response-mode based, not provider-based.
- `src/constants/models.ts` is the source of truth for provider order, provider metadata, model lists, API key hints, STT/TTS support flags, and provider voice defaults.
- `src/types.ts` is the source of truth for settings types and `DEFAULT_SETTINGS`.
- `src/utils/responseModes.ts` contains the response-mode routing helpers and provider model validation logic.
- `src/hooks/useSettings.ts` handles settings persistence, migrations, SecureStore API key loading, and response-mode migration logic.
- `src/hooks/useConversations.ts` handles conversation persistence and conversation metadata.
- `src/services/llm.ts` contains provider request routing for text generation.
- `src/services/whisper.ts` contains provider speech-to-text integrations.
- `src/services/tts.ts` contains provider and local text-to-speech routing.
- `src/services/speech/` and `src/services/localTts/` contain diagnostics and local speech support.

## State And Persistence

- Public settings are stored in AsyncStorage under `@schnackai/settings`.
- Provider API keys are stored separately in `expo-secure-store` using the `schnackai.provider_key.<provider>` prefix.
- Conversations are stored in AsyncStorage under `@schnackai/conversations` plus per-conversation keys `@schnackai/conversation/<id>`.
- Do not move provider API keys into AsyncStorage or any plain-text project config.
- When changing settings shape, update `src/types.ts` and `src/hooks/useSettings.ts` together and preserve migration behavior for existing installs.

## Response Modes

- The app now routes the main experience through response modes, not direct provider selection.
- A response mode is a `(provider, model)` pair stored in `settings.responseModes`.
- `activeResponseMode` controls which route the home screen uses.
- If response-mode behavior changes, the following files usually need to stay in sync:
  - `src/types.ts`
  - `src/utils/responseModes.ts`
  - `src/hooks/useSettings.ts`
  - `src/components/ResponseModeToggle.tsx`
  - `src/components/SettingsModal.tsx`
  - `src/screens/MainScreen.tsx`

## Provider And Model Maintenance

- The provider picker and provider capabilities are driven from `src/constants/models.ts`.
- When adding or changing a provider, audit all of:
  - `src/constants/models.ts`
  - `src/utils/providerCapabilities.ts`
  - `src/types.ts`
  - `src/hooks/useSettings.ts`
  - `src/components/SettingsModal.tsx`
  - `src/screens/MainScreen.tsx`
  - `src/services/llm.ts`
  - `src/services/whisper.ts`
  - `src/services/tts.ts`
  - `src/constants/usagePricing.ts`
  - `src/components/ProviderIcon.tsx`
- Model lists in `src/constants/models.ts` are user-facing pickers, not raw dumps of every possible provider SKU. Only add models that are actually usable with the app's current integration path.
- For OpenAI, the app currently uses `v1/chat/completions` in `src/services/llm.ts`. Do not add specialized models that require a different API shape unless the service layer is updated too.
- For Anthropic, the app currently uses `v1/messages` in `src/services/llm.ts`. Keep the picker aligned with models that work on that path.
- When updating provider model lists, also check defaults and tests for hard-coded model IDs. Common follow-up files are:
  - `src/types.ts`
  - `src/screens/MainScreen.tsx`
  - `__tests__/utils/responseModes.test.ts`
  - `__tests__/hooks/useSettings.test.ts`
  - `__tests__/hooks/useConversations.test.ts`
  - `__tests__/services/llm.test.ts`

## Alias Model Rule

- Exclude alias model IDs from user-facing pickers when a provider also exposes a canonical stable snapshot for the same model.
- Prefer canonical stable model IDs over rolling aliases.
- If a provider documents both a snapshot model ID and an alias for the same model, keep only the snapshot in the picker.
- Only keep an alias if the provider does not expose a separate canonical model ID for that same model.

## Voice Pipeline Notes

- STT provider support is currently wired in `src/services/whisper.ts`.
- TTS provider support is currently wired in `src/services/tts.ts`.
- OpenAI, Gemini, Together, and xAI currently have provider TTS routes in code.
- OpenAI, Groq, Gemini, Mistral, and Together currently have provider STT routes in code.
- Local speech support relies on native dependencies including `react-native-sherpa-onnx` and `onnxruntime-react-native`.
- Native speech changes often require `npx pod-install` and a fresh native rebuild, especially on iOS.

## UI And Copy

- User-visible strings live in `src/i18n.tsx`. When changing visible copy, update both English and German entries.
- Theme and color behavior live in `src/theme/`.
- Settings UI work usually belongs in `src/components/SettingsModal.tsx`.
- Home-screen interaction changes usually belong in `src/screens/MainScreen.tsx` and `src/components/ResponseModeToggle.tsx`.

## Testing And Verification

- There is no lint script in `package.json`.
- Use `npx tsc --noEmit` as the baseline repo-wide verification step for UI and type changes.
- Use targeted Jest runs for affected areas instead of defaulting to the entire suite when only a small area changed.
- Common focused tests:
  - `__tests__/utils/responseModes.test.ts`
  - `__tests__/hooks/useSettings.test.ts`
  - `__tests__/hooks/useConversations.test.ts`
  - `__tests__/services/llm.test.ts`
  - `__tests__/services/tts.test.ts`
  - `__tests__/services/whisper.test.ts`
- Run `npm test` when changes are broad enough to justify the full suite.

## Native And Build Notes

- Install dependencies with `npm install`.
- Run iOS pods with `npx pod-install`.
- App scripts:
  - `npm run ios`
  - `npm run android`
  - `npm test`
- Home screen icons, launcher assets, and many native dependency changes require a native rebuild. OTA updates are not enough.
- Be careful around `ios/Podfile.lock` and native dependency versions. Do not churn native lockfiles unless the change actually requires it.
