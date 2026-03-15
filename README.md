# schnack

schnack is a voice-first mobile chat app built with Expo and React Native. It is designed around fast spoken interaction: hold or tap to record, transcribe speech, send the result to the selected LLM provider, and play the reply back with OpenAI TTS.

The app is intentionally user-key driven. No provider API keys are shipped in the app bundle. Each user adds their own keys in Settings, and providers stay disabled until configured.

## Highlights

- Voice-first interaction with live recording and playback states
- User-managed API keys stored securely on device with `expo-secure-store`
- Multi-provider support with branded provider selection
- Per-provider model selection in Settings
- Configurable assistant instructions, response length, and response tone
- Rolling conversation compaction for long sessions to reduce token cost
- Premium, animated mobile UI tuned for spoken conversation

## Supported Providers

- OpenAI
- Anthropic
- Google Gemini
- xAI
- Groq
- DeepSeek
- Mistral
- Cohere
- Together
- NVIDIA

Important: voice input, voice preview, and spoken replies currently depend on an OpenAI API key because transcription uses Whisper and playback uses OpenAI TTS.

## Stack

- Expo SDK 55
- React Native 0.83
- React 19
- Expo Router
- Expo Audio
- React Native Reanimated
- React Native SVG

## Getting Started

### Requirements

- Node.js and npm
- Xcode for iOS builds
- Android Studio for Android builds
- CocoaPods for iOS native dependencies

### Install

```bash
npm install
npx pod-install
```

### Run

```bash
npm run ios
```

```bash
npm run android
```

```bash
npm test
```

## How Credentials Work

- Provider API keys are entered in the Settings modal by the user.
- Keys are stored in `expo-secure-store`.
- General settings are stored in AsyncStorage.
- Providers without a configured key are hidden or disabled in the main experience.

There is a legacy [src/config.example.ts](src/config.example.ts) file in the repo, but the app runtime is now centered around user-supplied keys in Settings rather than shipping secrets with the app.

## Conversation Behavior

- The active conversation thread is sent back to the model, not unrelated threads.
- Long conversations are compacted automatically.
- Older turns are summarized into a rolling `contextSummary`.
- Only a bounded recent window is sent verbatim once the thread grows large.

This keeps cost and latency more stable during long voice sessions.

## Project Structure

```text
app/                    Expo Router entry points
assets/branding/        App icon and provider branding assets
src/components/         UI components
src/context/            Shared React context
src/hooks/              Settings, conversations, audio hooks
src/screens/            Main screen
src/services/           LLM, transcription, TTS, and context logic
__tests__/              Focused hook and service tests
```

## Notes

- Home screen icons and launcher assets require a new native build. OTA updates alone will not change them.
- The current tracked iOS bundle identifier is `com.tobiaswinkler.app.voxai`.
- The current tracked Android package remains `com.tobiaswinkler.voxai`.

## License

No license file is currently included in this repository.
