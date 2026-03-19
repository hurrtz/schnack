import React, { createContext, useContext, useMemo } from "react";
import { AppLanguage } from "./types";

type TranslationParams = Record<string, string | number | undefined>;
type TranslationValue = string | ((params: TranslationParams) => string);

const translations = {
  en: {
    retry: "Retry",
    dismiss: "Dismiss",
    unavailable: "Unavailable",
    selection: "Selection",
    chooseCompatibleProviderFirst: "Choose a compatible provider first",
    settings: "Settings",
    firstRun: "First Run",
    instructions: "Instructions",
    providers: "Providers",
    stt: "STT",
    tts: "TTS",
    ui: "UI",
    theme: "Theme",
    language: "Language",
    usageStats: "Usage Stats",
    model: "Model",
    english: "English",
    german: "German",
    light: "Light",
    dark: "Dark",
    system: "System",
    languageCoverage: ({ note }) => `Language coverage: ${note}`,
    replyGenerationAction: "reply generation",
    speechTranscriptionAction: "speech transcription",
    instructionsTabDescription:
      "Shape the hidden guidance that steers the assistant before any provider sees the request.",
    providersTabDescription:
      "Connect providers, store keys on-device, and map each home-screen response mode to a provider and model.",
    responseModes: "Response Modes",
    responseModesDescription:
      "Map each home-screen response category to its own provider and model.",
    quickAndShallow: "Quick",
    deepThinking: "Deep",
    quickModeHint: "Fastest route",
    normalModeHint: "Balanced default",
    deepModeHint: "Most capable route",
    quickModeDescription:
      "Use this for fast answers where speed matters more than nuance.",
    normalModeDescription:
      "Use this for most conversations when you want a balanced answer.",
    deepModeDescription:
      "Use this when you want the strongest model for detail, tradeoffs, and reasoning.",
    activeResponseMode: "Active",
    useResponseMode: ({ mode }) => `Use ${mode}`,
    responseModeReadyHint: ({ provider }) =>
      `${provider} is ready for this response mode.`,
    responseModeMissingKeyHint: ({ provider }) =>
      `Add a ${provider} API key below to use this response mode.`,
    setupChecklist: "Voice Setup Checklist",
    setupChecklistReady:
      "This setup is ready for reply generation, speech input, and spoken playback.",
    setupChecklistNeedsWork:
      "Finish these three routes first for a reliable voice session.",
    sttTabDescription:
      "Control how speech is captured and which backend turns audio into text before it reaches the model.",
    ttsTabDescription:
      "Control when replies start speaking and which backend handles spoken output.",
    brief: "Brief",
    briefDescription:
      "Keep the answer tight. Use the minimum number of sentences needed to fully answer the user.",
    normal: "Normal",
    normalDescription:
      "Aim for a balanced response length. Cover the important points without dragging the answer out.",
    thorough: "Thorough",
    thoroughDescription:
      "Go deep and be comprehensive. Include nuance, detail, tradeoffs, and the reasoning that matters.",
    professional: "Professional",
    professionalDescription:
      "Speak like a senior consultant briefing a client. Precise language, no slang, measured and authoritative.",
    casual: "Casual",
    casualDescription:
      "Speak like a smart friend at a coffee shop. Relaxed, natural, conversational. Contractions are fine, tangents are fine.",
    nerdy: "Nerdy",
    nerdyDescription:
      "Speak like an enthusiastic expert who loves going deep. Use technical terminology freely, geek out about details, assume the user can keep up.",
    concise: "Concise",
    conciseDescription:
      "Be as brief as possible while still being complete. No preamble, no filler, just the answer. Think telegram style.",
    socratic: "Socratic",
    socraticDescription:
      "Challenge the user's thinking. Ask counter-questions, offer alternative perspectives, don't just confirm what they said. Be a sparring partner, not a yes-machine.",
    eli5: "ELI5",
    eli5Description:
      "Explain everything as simply as possible. Use analogies, everyday language, zero jargon. Assume no prior knowledge on any topic.",
    openProviderSettings: ({ provider }) => `Open ${provider} settings`,
    createProviderApiKey: ({ provider }) => `Create ${provider} API key`,
    useProvider: ({ provider }) => `Use ${provider}`,
    createApiKey: "Create API key",
    validateKey: "Validate key",
    validatingKey: "Validating...",
    configured: "Configured",
    missing: "Missing",
    showKey: "Show key",
    hideKey: "Hide key",
    apiKeyProtectedHint:
      "Stored keys stay hidden by default. Reveal them only when you need to verify or edit a value.",
    assistantInstructions: "Assistant Instructions",
    assistantInstructionsIntro:
      "Shape the hidden guidance the model receives before every reply.",
    baseInstructions: "Base Instructions",
    assistantInstructionsPlaceholder: "Define how the assistant should behave.",
    assistantInstructionsHint:
      "This is always prepended before the selected response length and tone.",
    adaptiveLength: "Adaptive Length",
    responseTone: "Response Tone",
    inputMode: "Input Mode",
    pushToTalk: "Push to Talk",
    pushToTalkDescription:
      "Hold the main button while speaking, then release to send.",
    toggleToTalk: "Toggle to Talk",
    toggleToTalkDescription:
      "Tap once to start recording and tap again when you are done.",
    speechToText: "Speech to Text",
    appNative: "App Native",
    nativeSttDescription:
      "Use the system speech recognizer built into the device. No provider key is required.",
    provider: "Provider",
    providerSttDescription:
      "Use a configured provider to transcribe your voice before it is sent to the model.",
    sttProvider: "STT Provider",
    sttProviderEnabledHint:
      "Only enabled providers with transcription support appear here.",
    sttProviderMissingHint:
      "Enable a provider with STT support in the Providers tab to choose it here.",
    nativeSttHint:
      "Native STT uses the device speech recognizer directly and works independently of your provider keys.",
    replyPlayback: "Reply Playback",
    sentencesArrive: "Sentences Arrive",
    sentencesArriveDescription:
      "Start speaking as soon as complete sentences are ready.",
    fullReplyFirst: "Full Reply First",
    fullReplyFirstDescription:
      "Generate the entire answer first, then play it in one pass.",
    textToSpeech: "Text to Speech",
    nativeTtsDescription:
      "Use the device speech engine for spoken replies and voice preview.",
    localTts: "Local",
    localTtsDescription:
      "Try a matching downloaded local voice first, then the selected provider if available, then the system voice.",
    providerTtsDescription:
      "Try the selected provider first, then a matching downloaded local voice, then the system voice.",
    ttsProvider: "TTS Provider",
    ttsProviderEnabledHint:
      "Only enabled providers with spoken-reply support appear here.",
    ttsProviderMissingHint:
      "Enable a provider with TTS support in the Providers tab to choose it here.",
    localTtsOrderHint:
      "Playback order: matching local voice first, then the selected provider if configured, then the system voice.",
    providerTtsOrderHint:
      "Playback order: selected provider first, then a matching downloaded local voice, then the system voice.",
    nativeTtsHint:
      "Native TTS uses the system voice stack and does not require a provider key.",
    localTtsLanguageCoverageHint:
      "Local packs currently cover English, German, Simplified Chinese, Spanish, Portuguese, Hindi, French, and Italian. Japanese still falls back automatically.",
    ttsVoice: "TTS Voice",
    voiceSelection: "Voice Selection",
    nativeVoiceSelectionHint:
      "Native playback uses the device voice chosen by the operating system.",
    localTtsVoiceSelectionHint:
      "Each selected language below keeps its own local voice. Preview follows the language detected from the preview text.",
    providerDefaultVoiceHint:
      "This provider currently uses its default voice for preview and spoken replies.",
    listenLanguages: "Listen Languages",
    listenLanguagesHint:
      "Pick the reply languages you want to sound good. SchnackAI tries them in this order when routing speech output.",
    localVoicePacks: "Local Voice Packs",
    localVoicePacksHint:
      "Each language keeps its own local voice. Choose the voice you want for that language, then download only the packs you actually care about.",
    localVoiceForLanguage: ({ languageLabel }) => `Voice for ${languageLabel}`,
    providerVoicePreviews: "Provider Voice Previews",
    providerVoicePreviewsHint:
      "Each enabled TTS provider can be tested here with its own voice and sample text, without changing the active reply route.",
    nativeVoicePreviewSection: "Native Voice Preview",
    nativeVoicePreviewSectionHint:
      "This speaks directly through the phone's built-in speech synthesizer so you can compare it against local and cloud voices.",
    nativeVoiceUnavailable:
      "This device did not report any native system voices for preview.",
    speechDiagnostics: "Recent Speech Activity",
    speechDiagnosticsHint:
      "Shows the latest speech requests, the route they asked for, the route they actually used, and any fallback reason.",
    speechDiagnosticsEmpty:
      "No recent speech requests yet. Preview a voice or play a reply to see routing details here.",
    speechDiagnosticSourceConversation: "Conversation reply",
    speechDiagnosticSourceRepeat: "Repeat reply",
    speechDiagnosticSourcePreview: "Voice preview",
    speechDiagnosticSourceUnknown: "Speech request",
    speechDiagnosticRouteLine: ({ requested, actual }) =>
      `Requested: ${requested} -> Actual: ${actual}`,
    speechDiagnosticStageLine: ({ stage }) => `Latest stage: ${stage}`,
    speechDiagnosticLanguageLine: ({ languageLabel }) =>
      `Language: ${languageLabel}`,
    speechDiagnosticProviderLine: ({ provider }) => `Provider: ${provider}`,
    speechDiagnosticVoiceLine: ({ voice }) => `Voice: ${voice}`,
    localTtsPackReady: "Installed on this device.",
    localTtsPackBroken:
      "Downloaded, but this voice failed local verification on this device. Re-download it or choose another voice.",
    localTtsPackMissing:
      "Not installed yet. Cloud TTS or the system voice will be used until you download it.",
    localTtsUnsupportedLanguageFallback:
      "A local pack is not available yet for this language. Cloud TTS or the system voice will handle it.",
    downloadingLocalTtsPack: ({ progress }) =>
      `Downloading local pack... ${progress}%`,
    download: "Download",
    downloadingShort: "Loading...",
    voicePreviewText: "Voice Preview Text",
    voicePreviewPlaceholder: "Type a phrase to hear this voice.",
    voicePreviewHint:
      "Uses the currently selected reply voice backend without sending anything to the language model.",
    previewVoice: "Preview Voice",
    generatingPreview: "Generating Preview...",
    systemVoice: "System voice",
    noTtsProvider: "No TTS provider",
    nothingToCopyYet: "Nothing to copy yet.",
    couldntCopyText: "Couldn't copy that text.",
    nothingToShareYet: "Nothing to share yet.",
    couldntShareText: "Couldn't share that text.",
    couldntReplayReply: "Couldn't replay that reply.",
    messageCopied: "Message copied.",
    noConversationToCopyYet: "No conversation to copy yet.",
    noConversationToShareYet: "No conversation to share yet.",
    noReplyToRepeatYet: "No reply to replay yet.",
    threadCopied: "Thread copied.",
    threadRenamed: "Thread renamed.",
    threadPinned: "Thread pinned.",
    threadUnpinned: "Thread unpinned.",
    addProviderKeyToUseProvider: ({ provider }) =>
      `Add your ${provider} API key in Settings to use this provider.`,
    speechRecognitionUnavailableOnDevice:
      "Speech recognition is unavailable on this device.",
    chooseSttBeforeVoiceSession:
      "Choose an enabled STT provider in Settings before starting a voice session.",
    chooseTtsBeforeSpokenReplies:
      "Choose an enabled TTS provider in Settings before using spoken replies.",
    stopSessionBeforeReplay:
      "Stop the active voice session before replaying the last reply.",
    couldntCatchThatTryAgain: "Couldn't catch that, try again.",
    couldntStartVoiceInput: "Couldn't start voice input.",
    couldntProcessVoiceInput: "Couldn't process voice input.",
    addProviderKeyToEnableProvider: ({ provider }) =>
      `Add your ${provider} API key in Settings to enable it.`,
    stopSessionBeforePreview:
      "Stop the active voice session before previewing a voice.",
    chooseTtsToPreviewVoices:
      "Choose an enabled TTS provider in Settings to preview voices.",
    downloadSelectedLocalVoiceFirst: ({ languageLabel }) =>
      `Download the selected ${languageLabel} local voice first.`,
    couldntPreviewVoice: "Couldn't preview voice.",
    providerVoiceFallback:
      "Provider voice failed. Switched this reply to the system voice.",
    providerVoicePreviewFallback:
      "Provider voice failed. Preview switched to the system voice.",
    localVoiceFallback:
      "Local voice was unavailable. Switched this reply to the best fallback voice.",
    localVoicePreviewFallback:
      "Local voice was unavailable. Preview switched to the best fallback voice.",
    localTtsPackInstalled: ({ languageLabel }) =>
      `${languageLabel} local voice pack installed.`,
    localTtsPackInstallFailed: "Couldn't install the local voice pack.",
    clear: "Clear",
    liveInput: "Live Input",
    parsingInput: "Parsing Input",
    awaitingModel: "Awaiting Model",
    voiceOutput: "Voice Output",
    controlRoom: "Control Room",
    currentSetup: "Current Setup",
    listeningToYourVoice: "Listening to your voice",
    parsingYourVoiceInput: "Parsing your voice input",
    waitingForProvider: ({ provider }) => `Waiting for ${provider}`,
    preparingVoiceWithProvider: ({ provider }) =>
      `Preparing voice with ${provider}`,
    speakingBackToYou: "Speaking back to you",
    readyForNextThought: "Ready for the next thought",
    freshSession: "Fresh session",
    messageCount: ({ count }) =>
      Number(count) === 1 ? "1 message" : `${count} messages`,
    speechInputRoute: ({ route }) => `Speech in: ${route}`,
    replyModelRoute: ({ route }) => `Reply model: ${route}`,
    voiceOutputRoute: ({ route }) => `Voice out: ${route}`,
    conversation: "Conversation",
    show: "Show",
    showTranscript: "Show transcript",
    hide: "Hide",
    open: "Open",
    copyThread: "Copy Thread",
    shareThread: "Share Thread",
    repeatReply: "Repeat Reply",
    renameThread: "Rename Thread",
    renameThreadHint:
      "Give this conversation a title you can find quickly later.",
    threadTitle: "Thread title",
    noTranscriptYet: "No transcript yet",
    previewTranscriptEmptyDescription:
      "Start with the voice stage above. Your messages and the model reply will land here instantly.",
    transcript: "Transcript",
    noConversationYet: "No conversation yet",
    expandedTranscriptEmptyDescription:
      "Speak with the control above. Close this screen when you want to return to the main stage.",
    transcriptSelectionHint:
      "Select any message text directly, or share and copy individual messages below.",
    usageStatsHiddenDescription:
      "Keep token and cost estimates out of the transcript UI.",
    usageStatsVisibleDescription:
      "Show estimated token usage and estimated cost for replies and conversation totals.",
    estimatedUsageTitle: "Estimated Usage",
    estimatedUsageCounts: ({ replies, summaries }) =>
      `${replies} replies · ${summaries} memory updates`,
    estimatedUsageConversationScope:
      "Totals include every provider and model used inside this conversation.",
    estimatedPromptTokens: ({ count }) => `Prompt: ${count}`,
    estimatedReplyTokens: ({ count }) => `Reply: ${count}`,
    estimatedTotalTokens: ({ count }) => `Total: ${count}`,
    estimatedCost: ({ cost }) => `Cost: ${cost}`,
    estimatedCostPartial: ({ cost }) => `Cost: ${cost} partial`,
    estimatedUsageInline: ({ prompt, completion, total }) =>
      `Est. ${prompt} in · ${completion} out · ${total} total`,
    estimatedRouteUsage: ({ tokens, cost }) => `${tokens} tokens · ${cost}`,
    estimatedRouteUsagePartial: ({ tokens, cost }) =>
      `${tokens} tokens · ${cost} partial`,
    estimatedRouteUsageTokensOnly: ({ tokens }) => `${tokens} tokens`,
    unknownUsageRoute: "Unknown route",
    pricingAssumptions: "Pricing Assumptions",
    pricingAssumptionsHint: ({ date }) =>
      `Last reviewed ${date}. Costs are only shown when the active model matches one of these source-backed assumptions.`,
    pricingAssumptionRates: ({ input, output }) =>
      `$${input}/1M input · $${output}/1M output`,
    pricingAssumptionCheckedAt: ({ date }) => `Checked: ${date}`,
    openPricingSource: ({ source }) => `Open pricing source: ${source}`,
    source: "Source",
    startWithGroq: "Start with Groq",
    groqStarterDescription:
      "Groq offers a free tier, so it is the fastest way to unlock the app. Add its API key in Settings and the provider switcher will appear here right away.",
    live: "Live",
    idle: "Idle",
    yourConversationAppearsHere: "Your conversation appears here",
    defaultTranscriptEmptyDescription:
      "Press and hold the voice control, then speak naturally. SchnackAI will keep the thread and speak back.",
    delete: "Delete",
    memory: "Memory",
    conversations: "Conversations",
    drawerSubtitle: "Jump between live threads or start a fresh room.",
    newSession: "New Session",
    noSavedConversationsYet: "No saved conversations yet",
    drawerEmptyDescription:
      "Start speaking from the main view and SchnackAI will build a session automatically.",
    setupGuideTitle: "Choose a starting setup",
    setupGuideSubtitle:
      "Pick the stack you want first. You can change every route later in Settings.",
    fastestStartPreset: "Fastest start",
    fastestStartDescription:
      "Groq handles replies, while the device handles listening and speaking. Lowest setup friction.",
    fullVoicePreset: "Full provider voice",
    fullVoiceDescription:
      "OpenAI handles replies, transcription, and spoken output. Best if you want one provider stack.",
    setupGuideNote:
      "We will open Settings next so you can paste and validate the provider key.",
    useThisSetup: "Use this setup",
    notNow: "Not now",
    searchConversationsPlaceholder: "Search titles, models, and message text",
    noMatchingConversations: "No matching conversations",
    noMatchingConversationsDescription:
      "Try a different title, provider, model, or phrase from the transcript.",
    memoryModalTitle: "Conversation memory",
    memoryModalDescription:
      "This is the compact summary SchnackAI carries forward once a thread gets long enough to compress older turns.",
    memorySummary: "Saved summary",
    memorySummaryEmpty:
      "No compact memory yet. Once this thread gets longer, older turns will be summarized here.",
    summarizedTurnsCount: ({ count }) =>
      Number(count) === 1 ? "1 summarized turn" : `${count} summarized turns`,
    copyMemory: "Copy memory",
    forgetMemory: "Forget memory",
    memoryCopied: "Memory copied.",
    memoryCleared: "Conversation memory cleared.",
    noConversationToManageYet: "No conversation memory available yet.",
    paste: "Paste",
    pasted: "Pasted",
    copied: "Copied",
    clipboardEmpty: "Clipboard is empty.",
    yesterday: "Yesterday",
    noProviderYet: "No provider yet",
    noModelYet: "No model yet",
    saved: "Saved",
    pinned: "Pinned",
    copy: "Copy",
    share: "Share",
    rename: "Rename",
    pin: "Pin",
    unpin: "Unpin",
    save: "Save",
    cancel: "Cancel",
    stop: "Stop",
    listening: "Listening",
    parsing: "Parsing",
    thinking: "Thinking",
    speaking: "Speaking",
    hold: "Hold",
    tap: "Tap",
    holdToSpeak: "Hold to speak",
    tapToSpeak: "Tap to speak",
    waitingOnModel: "Waiting on model",
    convertingSpeech: "Converting speech",
    waitingForReply: "Waiting for reply",
    parsingYourVoice: "Parsing your voice",
    providerConfiguredInSettings: ({ provider }) =>
      `${provider} is not configured in Settings.`,
    providerNetworkError: ({ provider, action }) =>
      `Couldn't reach ${provider} for ${action}. Check the connection and try again.`,
    providerAuthError: ({ provider, action }) =>
      `${provider} rejected the credentials for ${action}. Check the API key and permissions.`,
    providerRateLimitError: ({ provider, action }) =>
      `${provider} is rate limiting ${action} right now. Try again in a moment.`,
    providerTemporaryError: ({ provider, action }) =>
      `${provider} had a temporary problem during ${action}. Try again shortly.`,
    providerContextTooLong: ({ provider }) =>
      `${provider} rejected the reply because the conversation got too long. Start a fresh thread or shorten the request.`,
    providerRequestRejected: ({ provider, action, detail }) =>
      detail
        ? `${provider} rejected the ${action} request: ${detail}`
        : `${provider} rejected the ${action} request.`,
    providerValidationSuccess: ({ provider }) => `${provider} is ready to use.`,
    providerValidationFailed: "Provider validation failed.",
    noBase64EncoderAvailable: "No base64 encoder available.",
    noBase64DecoderAvailable: "No base64 decoder available.",
    nativeTtsDoesNotSynthesizeAudioFiles:
      "Native TTS does not synthesize audio files.",
    localTtsUnavailableForLanguage: ({ languageLabel }) =>
      `No local or cloud voice route is ready for ${languageLabel}.`,
    chooseTextToSpeechProviderInSettings:
      "Choose a text-to-speech provider in Settings.",
    ttsNotSupportedYet: ({ provider }) =>
      `${provider} TTS is not supported yet.`,
    ttsError: ({ provider, status, errorText }) =>
      `${provider} TTS error (${status}): ${errorText}`,
    ttsReplyTooLong: ({ provider }) =>
      `${provider} speech output rejected the reply because it was too long.`,
    ttsTimeout: ({ provider }) => `${provider} speech output took too long.`,
    ttsDidNotReturnAudio: ({ provider }) =>
      `${provider} TTS did not return audio.`,
    nativeSttHandledInApp: "Native STT is handled directly in the app.",
    chooseSpeechToTextProviderInSettings:
      "Choose a speech-to-text provider in Settings.",
    sttNotSupportedYet: ({ provider }) =>
      `${provider} STT is not supported yet.`,
    sttError: ({ provider, status, errorText }) =>
      `${provider} STT error (${status}): ${errorText}`,
    apiError: ({ provider, status, errorText }) =>
      `${provider} API error (${status}): ${errorText}`,
    providerNotWiredUpYet: ({ provider }) => `${provider} is not wired up yet.`,
    user: "User",
    you: "You",
    assistant: "Assistant",
    untitledConversation: "Untitled conversation",
    conversationExportHeader: ({ title }) => `Conversation: ${title}`,
    speechRecognitionPermissionNotGranted:
      "Speech recognition permission not granted.",
    speechRecognitionUnavailableForDeviceLanguage:
      "Speech recognition is not available for the current device language.",
    nativeSpeechRecognitionNeedsNetwork:
      "Native speech recognition needs network access right now.",
    noSpeechDetected: "No speech was detected.",
    nativeSpeechRecognitionFailed: "Native speech recognition failed.",
    couldntStartNativeSpeechRecognition:
      "Couldn't start native speech recognition.",
    microphonePermissionNotGranted: "Microphone permission not granted",
  },
  de: {
    retry: "Wiederholen",
    dismiss: "Schließen",
    unavailable: "Nicht verfügbar",
    selection: "Auswahl",
    chooseCompatibleProviderFirst: "Wähle zuerst einen kompatiblen Anbieter",
    settings: "Einstellungen",
    firstRun: "Erster Start",
    instructions: "Anweisungen",
    providers: "Anbieter",
    stt: "STT",
    tts: "TTS",
    ui: "UI",
    theme: "Design",
    language: "Sprache",
    usageStats: "Nutzungsdaten",
    model: "Modell",
    english: "Englisch",
    german: "Deutsch",
    light: "Hell",
    dark: "Dunkel",
    system: "System",
    languageCoverage: ({ note }) => `Sprachabdeckung: ${note}`,
    replyGenerationAction: "Antwortgenerierung",
    speechTranscriptionAction: "Sprachtranskription",
    instructionsTabDescription:
      "Bestimme die unsichtbare Anweisung, die den Assistenten lenkt, noch bevor ein Anbieter die Anfrage erhält.",
    providersTabDescription:
      "Verbinde Anbieter, speichere Schlüssel auf dem Gerät und ordne jedem Antwortmodus auf dem Home-Bildschirm einen Anbieter und ein Modell zu.",
    responseModes: "Antwortmodi",
    responseModesDescription:
      "Ordne jeder Antwort-Kategorie auf dem Home-Bildschirm ihren eigenen Anbieter und ihr eigenes Modell zu.",
    quickAndShallow: "Zackig",
    deepThinking: "Tiefgründig",
    quickModeHint: "Schnellste Route",
    normalModeHint: "Ausgewogener Standard",
    deepModeHint: "Stärkste Route",
    quickModeDescription:
      "Nutze das für schnelle Antworten, wenn Tempo wichtiger ist als Nuancen.",
    normalModeDescription:
      "Nutze das für die meisten Gespräche, wenn du eine ausgewogene Antwort willst.",
    deepModeDescription:
      "Nutze das, wenn du das stärkste Modell für Details, Abwägungen und Reasoning willst.",
    activeResponseMode: "Aktiv",
    useResponseMode: ({ mode }) => `${mode} verwenden`,
    responseModeReadyHint: ({ provider }) =>
      `${provider} ist für diesen Antwortmodus bereit.`,
    responseModeMissingKeyHint: ({ provider }) =>
      `Füge unten einen API-Schlüssel für ${provider} hinzu, um diesen Antwortmodus zu nutzen.`,
    setupChecklist: "Sprach-Checkliste",
    setupChecklistReady:
      "Dieses Setup ist bereit für Antworten, Spracheingabe und Sprachausgabe.",
    setupChecklistNeedsWork:
      "Schließe zuerst diese drei Routen ab, damit Sprachsitzungen zuverlässig laufen.",
    sttTabDescription:
      "Steuere, wie Sprache aufgenommen wird und welches Backend Audio in Text umwandelt, bevor es das Modell erreicht.",
    ttsTabDescription:
      "Steuere, wann Antworten vorgelesen werden und welches Backend die Sprachausgabe übernimmt.",
    brief: "Kurz",
    briefDescription:
      "Halte die Antwort knapp. Nutze nur so viele Sätze wie nötig, um die Frage vollständig zu beantworten.",
    normal: "Normal",
    normalDescription:
      "Strebe eine ausgewogene Antwortlänge an. Decke die wichtigsten Punkte ab, ohne die Antwort unnötig in die Länge zu ziehen.",
    thorough: "Ausführlich",
    thoroughDescription:
      "Geh in die Tiefe und sei umfassend. Berücksichtige Nuancen, Details, Abwägungen und die relevante Begründung.",
    professional: "Professionell",
    professionalDescription:
      "Sprich wie ein erfahrener Berater im Kundengespräch. Präzise Wortwahl, kein Slang, souverän und bestimmt.",
    casual: "Locker",
    casualDescription:
      "Sprich wie ein kluger Freund im Café. Entspannt, natürlich, gesprächig. Abkürzungen und kleine Abschweifungen sind völlig okay.",
    nerdy: "Nerdig",
    nerdyDescription:
      "Sprich wie ein begeisterter Experte, der gerne in die Tiefe geht. Nutze Fachbegriffe frei und geh entspannt ins Detail.",
    concise: "Prägnant",
    conciseDescription:
      "Sei so kurz wie möglich und trotzdem vollständig. Keine Einleitung, kein Fülltext, nur die Antwort. Telegramm-Stil.",
    socratic: "Sokratisch",
    socraticDescription:
      "Fordere das Denken heraus. Stelle Gegenfragen, biete alternative Perspektiven an und bestätige nicht einfach, was gesagt wurde.",
    eli5: "Einfach erklärt",
    eli5Description:
      "Erkläre alles so einfach wie möglich. Nutze Analogien, Alltagssprache und verzichte auf Fachjargon.",
    openProviderSettings: ({ provider }) => `${provider}-Einstellungen öffnen`,
    createProviderApiKey: ({ provider }) =>
      `API-Schlüssel für ${provider} erstellen`,
    useProvider: ({ provider }) => `${provider} verwenden`,
    createApiKey: "API-Schlüssel erstellen",
    validateKey: "Schlüssel prüfen",
    validatingKey: "Prüfe …",
    configured: "Konfiguriert",
    missing: "Fehlt",
    showKey: "Schlüssel anzeigen",
    hideKey: "Schlüssel verbergen",
    apiKeyProtectedHint:
      "Gespeicherte Schlüssel bleiben standardmäßig verborgen. Zeige sie nur an, wenn du einen Wert prüfen oder ändern musst.",
    assistantInstructions: "Assistenten-Anweisungen",
    assistantInstructionsIntro:
      "Bestimme die unsichtbare Anweisung, die das Modell vor jeder Antwort erhält.",
    baseInstructions: "Basis-Anweisungen",
    assistantInstructionsPlaceholder:
      "Definiere, wie sich der Assistent verhalten soll.",
    assistantInstructionsHint:
      "Dieser Text wird immer vor der gewählten Antwortlänge und dem Stil vorangestellt.",
    adaptiveLength: "Antwortlänge",
    responseTone: "Antwortstil",
    inputMode: "Eingabemodus",
    pushToTalk: "Gedrückt sprechen",
    pushToTalkDescription:
      "Halte die Haupttaste während des Sprechens gedrückt und lass los, um zu senden.",
    toggleToTalk: "Tippen zum Sprechen",
    toggleToTalkDescription:
      "Tippe einmal zum Starten der Aufnahme und noch einmal, wenn du fertig bist.",
    speechToText: "Sprache zu Text",
    appNative: "App-intern",
    nativeSttDescription:
      "Verwende die eingebaute Spracherkennung des Geräts. Kein Anbieter-Schlüssel nötig.",
    provider: "Anbieter",
    providerSttDescription:
      "Verwende einen konfigurierten Anbieter, um deine Sprache zu transkribieren, bevor sie an das Modell geht.",
    sttProvider: "STT-Anbieter",
    sttProviderEnabledHint:
      "Hier erscheinen nur aktivierte Anbieter mit Transkriptionsunterstützung.",
    sttProviderMissingHint:
      'Aktiviere im Tab "Anbieter" einen Dienst mit STT-Unterstützung, um ihn hier auszuwählen.',
    nativeSttHint:
      "Native STT nutzt die Spracherkennung des Geräts direkt und funktioniert unabhängig von deinen Anbieter-Schlüsseln.",
    replyPlayback: "Antwort-Wiedergabe",
    sentencesArrive: "Satzweise",
    sentencesArriveDescription:
      "Beginne mit der Sprachausgabe, sobald vollständige Sätze bereitstehen.",
    fullReplyFirst: "Komplette Antwort zuerst",
    fullReplyFirstDescription:
      "Erzeuge erst die vollständige Antwort und spiele sie dann in einem Durchgang ab.",
    textToSpeech: "Text zu Sprache",
    nativeTtsDescription:
      "Verwende die Sprachausgabe des Geräts für gesprochene Antworten und die Stimmvorschau.",
    localTts: "Lokal",
    localTtsDescription:
      "Nutze zuerst eine passende lokale Stimme, dann den ausgewählten Anbieter, falls vorhanden, und zuletzt die Systemstimme.",
    providerTtsDescription:
      "Nutze zuerst den ausgewählten Anbieter, dann eine passende lokale Stimme und zuletzt die Systemstimme.",
    ttsProvider: "TTS-Anbieter",
    ttsProviderEnabledHint:
      "Hier erscheinen nur aktivierte Anbieter mit Sprachausgabe-Unterstützung.",
    ttsProviderMissingHint:
      'Aktiviere im Tab "Anbieter" einen Dienst mit TTS-Unterstützung, um ihn hier auszuwählen.',
    localTtsOrderHint:
      "Reihenfolge: passende lokale Stimme zuerst, dann der ausgewählte Anbieter (falls konfiguriert), dann die Systemstimme.",
    providerTtsOrderHint:
      "Reihenfolge: ausgewählter Anbieter zuerst, dann eine passende heruntergeladene lokale Stimme, dann die Systemstimme.",
    nativeTtsHint:
      "Native TTS nutzt die Systemstimmen des Geräts und benötigt keinen Anbieter-Schlüssel.",
    localTtsLanguageCoverageHint:
      "Lokale Sprachpakete decken derzeit Englisch, Deutsch, vereinfachtes Chinesisch, Spanisch, Portugiesisch, Hindi, Französisch und Italienisch ab. Japanisch fällt weiterhin automatisch zurück.",
    ttsVoice: "TTS-Stimme",
    voiceSelection: "Stimmenauswahl",
    nativeVoiceSelectionHint:
      "Native Wiedergabe nutzt die vom Betriebssystem gewählte Gerätestimme.",
    localTtsVoiceSelectionHint:
      "Jede ausgewählte Sprache unten behält ihre eigene lokale Stimme. Die Vorschau folgt der Sprache, die aus dem Vorschautext erkannt wird.",
    providerDefaultVoiceHint:
      "Dieser Anbieter nutzt aktuell seine Standardstimme für Vorschau und Sprachausgabe.",
    listenLanguages: "Hörsprachen",
    listenLanguagesHint:
      "Wähle die Antwortsprachen aus, die gut klingen sollen. SchnackAI probiert sie in dieser Reihenfolge für die Sprachausgabe.",
    localVoicePacks: "Lokale Sprachpakete",
    localVoicePacksHint:
      "Jede Sprache hat ihre eigene lokale Stimme. Wähle zuerst die Stimme pro Sprache und lade dann nur die Pakete herunter, die dir wirklich wichtig sind.",
    localVoiceForLanguage: ({ languageLabel }) => `Stimme für ${languageLabel}`,
    providerVoicePreviews: "Anbieter-Stimmvorschau",
    providerVoicePreviewsHint:
      "Jeder aktivierte TTS-Anbieter kann hier mit eigener Stimme und eigenem Beispieltext getestet werden, ohne die aktive Antwort-Route zu ändern.",
    nativeVoicePreviewSection: "Native Stimmvorschau",
    nativeVoicePreviewSectionHint:
      "Nutzt direkt die eingebaute Sprachsynthese des Geräts, damit du sie mit lokalen und Cloud-Stimmen vergleichen kannst.",
    nativeVoiceUnavailable:
      "Dieses Gerät hat keine nativen Systemstimmen für die Vorschau gemeldet.",
    speechDiagnostics: "Letzte Sprachaktivität",
    speechDiagnosticsHint:
      "Zeigt die letzten Sprachanfragen, die gewünschte Route, die tatsächlich genutzte Route und den jeweiligen Grund für einen Fallback.",
    speechDiagnosticsEmpty:
      "Noch keine aktuellen Sprachanfragen. Teste eine Stimme oder spiele eine Antwort ab, um hier Routing-Details zu sehen.",
    speechDiagnosticSourceConversation: "Antwort aus dem Schnack",
    speechDiagnosticSourceRepeat: "Antwort wiederholen",
    speechDiagnosticSourcePreview: "Stimmvorschau",
    speechDiagnosticSourceUnknown: "Sprachanfrage",
    speechDiagnosticRouteLine: ({ requested, actual }) =>
      `Angefragt: ${requested} -> Tatsächlich: ${actual}`,
    speechDiagnosticStageLine: ({ stage }) => `Letzte Stufe: ${stage}`,
    speechDiagnosticLanguageLine: ({ languageLabel }) =>
      `Sprache: ${languageLabel}`,
    speechDiagnosticProviderLine: ({ provider }) => `Anbieter: ${provider}`,
    speechDiagnosticVoiceLine: ({ voice }) => `Stimme: ${voice}`,
    localTtsPackReady: "Auf diesem Gerät installiert.",
    localTtsPackBroken:
      "Heruntergeladen, aber diese Stimme hat die lokale Prüfung auf diesem Gerät nicht bestanden. Lade sie erneut herunter oder wähle eine andere Stimme.",
    localTtsPackMissing:
      "Noch nicht installiert. Bis zum Download werden Cloud-TTS oder die Systemstimme genutzt.",
    localTtsUnsupportedLanguageFallback:
      "Für diese Sprache gibt es noch kein lokales Paket. Cloud-TTS oder die Systemstimme übernehmen.",
    downloadingLocalTtsPack: ({ progress }) =>
      `Lokales Paket wird geladen … ${progress} %`,
    download: "Download",
    downloadingShort: "Lädt …",
    voicePreviewText: "Text für Stimmvorschau",
    voicePreviewPlaceholder: "Gib einen Satz ein, um diese Stimme zu hören.",
    voicePreviewHint:
      "Verwendet das aktuell gewählte Sprach-Backend, ohne etwas an das Sprachmodell zu senden.",
    previewVoice: "Stimme testen",
    generatingPreview: "Vorschau wird erzeugt …",
    systemVoice: "Systemstimme",
    noTtsProvider: "Kein TTS-Anbieter",
    nothingToCopyYet: "Noch nichts zum Kopieren.",
    couldntCopyText: "Der Text konnte nicht kopiert werden.",
    nothingToShareYet: "Noch nichts zum Teilen.",
    couldntShareText: "Der Text konnte nicht geteilt werden.",
    couldntReplayReply: "Die Antwort konnte nicht erneut abgespielt werden.",
    messageCopied: "Nachricht kopiert.",
    noConversationToCopyYet: "Noch kein Schnack zum Kopieren.",
    noConversationToShareYet: "Noch kein Schnack zum Teilen.",
    noReplyToRepeatYet: "Noch keine Antwort zum Wiederholen.",
    threadCopied: "Schnack kopiert.",
    threadRenamed: "Schnack umbenannt.",
    threadPinned: "Schnack angeheftet.",
    threadUnpinned: "Nicht mehr angeheftet.",
    addProviderKeyToUseProvider: ({ provider }) =>
      `Füge in den Einstellungen deinen API-Schlüssel für ${provider} hinzu, um diesen Anbieter zu nutzen.`,
    speechRecognitionUnavailableOnDevice:
      "Spracherkennung ist auf diesem Gerät nicht verfügbar.",
    chooseSttBeforeVoiceSession:
      "Wähle in den Einstellungen einen aktivierten STT-Anbieter, bevor du eine Sprachsitzung startest.",
    chooseTtsBeforeSpokenReplies:
      "Wähle in den Einstellungen einen aktivierten TTS-Anbieter, bevor du gesprochene Antworten nutzt.",
    stopSessionBeforeReplay:
      "Beende die laufende Sprachsitzung, bevor du die letzte Antwort erneut abspielst.",
    couldntCatchThatTryAgain:
      "Das wurde nicht richtig erkannt – versuch es noch einmal.",
    couldntStartVoiceInput: "Spracheingabe konnte nicht gestartet werden.",
    couldntProcessVoiceInput: "Spracheingabe konnte nicht verarbeitet werden.",
    addProviderKeyToEnableProvider: ({ provider }) =>
      `Füge in den Einstellungen deinen API-Schlüssel für ${provider} hinzu, um ihn zu aktivieren.`,
    stopSessionBeforePreview:
      "Beende die laufende Sprachsitzung, bevor du eine Stimme testest.",
    chooseTtsToPreviewVoices:
      "Wähle in den Einstellungen einen aktivierten TTS-Anbieter, um Stimmen zu testen.",
    downloadSelectedLocalVoiceFirst: ({ languageLabel }) =>
      `Lade zuerst die ausgewählte lokale Stimme für ${languageLabel} herunter.`,
    couldntPreviewVoice: "Die Stimmvorschau konnte nicht abgespielt werden.",
    providerVoiceFallback:
      "Die Anbieter-Stimme ist ausgefallen. Diese Antwort wird mit der Systemstimme abgespielt.",
    providerVoicePreviewFallback:
      "Die Anbieter-Stimme ist ausgefallen. Die Vorschau nutzt jetzt die Systemstimme.",
    localVoiceFallback:
      "Die lokale Stimme war nicht verfügbar. Diese Antwort nutzt die beste verfügbare Ersatzstimme.",
    localVoicePreviewFallback:
      "Die lokale Stimme war nicht verfügbar. Die Vorschau nutzt die beste verfügbare Ersatzstimme.",
    localTtsPackInstalled: ({ languageLabel }) =>
      `Lokales Sprachpaket für ${languageLabel} installiert.`,
    localTtsPackInstallFailed:
      "Das lokale Sprachpaket konnte nicht installiert werden.",
    clear: "Leeren",
    liveInput: "Live-Eingabe",
    parsingInput: "Eingabe wird verarbeitet",
    awaitingModel: "Warte auf Modell",
    voiceOutput: "Sprachausgabe",
    controlRoom: "Steuerzentrale",
    currentSetup: "Aktuelles Setup",
    listeningToYourVoice: "Ich höre dir zu",
    parsingYourVoiceInput: "Deine Sprache wird verarbeitet",
    waitingForProvider: ({ provider }) => `Warte auf ${provider}`,
    preparingVoiceWithProvider: ({ provider }) =>
      `Bereite Stimme mit ${provider} vor`,
    speakingBackToYou: "Antwort wird gesprochen",
    readyForNextThought: "Bereit für den nächsten Gedanken",
    freshSession: "Neue Sitzung",
    messageCount: ({ count }) =>
      Number(count) === 1 ? "1 Nachricht" : `${count} Nachrichten`,
    speechInputRoute: ({ route }) => `Sprache rein: ${route}`,
    replyModelRoute: ({ route }) => `Antwortmodell: ${route}`,
    voiceOutputRoute: ({ route }) => `Stimme raus: ${route}`,
    conversation: "Schnack",
    show: "Anzeigen",
    showTranscript: "Schnack anzeigen",
    hide: "Ausblenden",
    open: "Öffnen",
    copyThread: "Schnack kopieren",
    shareThread: "Schnack teilen",
    repeatReply: "Antwort wiederholen",
    renameThread: "Schnack umbenennen",
    renameThreadHint:
      "Gib diesem Schnack einen Titel, den du später schnell wiederfindest.",
    threadTitle: "Schnack-Titel",
    noTranscriptYet: "Noch kein Transkript",
    previewTranscriptEmptyDescription:
      "Starte oben mit der Sprachsteuerung. Deine Nachrichten und die Modellantwort erscheinen hier sofort.",
    transcript: "Transkript",
    noConversationYet: "Noch kein Schnack",
    expandedTranscriptEmptyDescription:
      "Sprich über die Steuerung oben. Schließe diesen Bildschirm, wenn du zur Hauptansicht zurückkehren willst.",
    transcriptSelectionHint:
      "Du kannst Text direkt markieren oder einzelne Nachrichten unten teilen und kopieren.",
    usageStatsHiddenDescription:
      "Blende Token- und Kostenschätzungen im Transkript aus.",
    usageStatsVisibleDescription:
      "Zeige geschätzte Token-Nutzung und geschätzte Kosten pro Antwort sowie für den gesamten Schnack.",
    estimatedUsageTitle: "Geschätzte Nutzung",
    estimatedUsageCounts: ({ replies, summaries }) =>
      `${replies} Antworten · ${summaries} Speicher-Updates`,
    estimatedUsageConversationScope:
      "Die Summen enthalten alle Anbieter und Modelle, die in diesem Schnack verwendet wurden.",
    estimatedPromptTokens: ({ count }) => `Prompt: ${count}`,
    estimatedReplyTokens: ({ count }) => `Antwort: ${count}`,
    estimatedTotalTokens: ({ count }) => `Gesamt: ${count}`,
    estimatedCost: ({ cost }) => `Kosten: ${cost}`,
    estimatedCostPartial: ({ cost }) => `Kosten: ${cost} teilweise`,
    estimatedUsageInline: ({ prompt, completion, total }) =>
      `Geschätzt: ${prompt} rein · ${completion} raus · ${total} gesamt`,
    estimatedRouteUsage: ({ tokens, cost }) => `${tokens} Token · ${cost}`,
    estimatedRouteUsagePartial: ({ tokens, cost }) =>
      `${tokens} Token · ${cost} teilweise`,
    estimatedRouteUsageTokensOnly: ({ tokens }) => `${tokens} Token`,
    unknownUsageRoute: "Unbekannte Route",
    pricingAssumptions: "Preisannahmen",
    pricingAssumptionsHint: ({ date }) =>
      `Zuletzt geprüft am ${date}. Kosten werden nur gezeigt, wenn das aktive Modell zu einer dieser quellenbasierten Annahmen passt.`,
    pricingAssumptionRates: ({ input, output }) =>
      `$${input}/1M Input · $${output}/1M Output`,
    pricingAssumptionCheckedAt: ({ date }) => `Geprüft: ${date}`,
    openPricingSource: ({ source }) => `Preisquelle öffnen: ${source}`,
    source: "Quelle",
    startWithGroq: "Mit Groq starten",
    groqStarterDescription:
      "Groq bietet einen kostenlosen Tarif und ist damit der schnellste Weg, die App freizuschalten. Füge in den Einstellungen den API-Schlüssel hinzu – der Anbieter-Umschalter erscheint dann sofort hier.",
    live: "Live",
    idle: "Bereit",
    yourConversationAppearsHere: "Dein Schnack erscheint hier",
    defaultTranscriptEmptyDescription:
      "Halte die Sprachsteuerung gedrückt und sprich ganz natürlich. SchnackAI behält den Schnack und antwortet dir per Stimme.",
    delete: "Löschen",
    memory: "Speicher",
    conversations: "Schnacks",
    drawerSubtitle:
      "Wechsle zwischen aktiven Schnacks oder starte einen neuen Raum.",
    newSession: "Neue Sitzung",
    noSavedConversationsYet: "Noch keine gespeicherten Schnacks",
    drawerEmptyDescription:
      "Sprich in der Hauptansicht los und SchnackAI erstellt automatisch einen Schnack.",
    setupGuideTitle: "Wähle ein Start-Setup",
    setupGuideSubtitle:
      "Such dir zuerst einen Stack aus. Später kannst du jede Route in den Einstellungen ändern.",
    fastestStartPreset: "Schnellster Start",
    fastestStartDescription:
      "Groq übernimmt die Antworten, das Gerät kümmert sich ums Hören und Sprechen. Minimaler Aufwand.",
    fullVoicePreset: "Kompletter Anbieter-Stack",
    fullVoiceDescription:
      "OpenAI übernimmt Antworten, Transkription und Sprachausgabe. Ideal, wenn du alles über einen Anbieter laufen lassen willst.",
    setupGuideNote:
      "Danach öffnen wir die Einstellungen, damit du den Anbieter-Schlüssel einfügen und prüfen kannst.",
    useThisSetup: "Dieses Setup nutzen",
    notNow: "Jetzt nicht",
    searchConversationsPlaceholder:
      "Suche nach Titeln, Modellen und Nachrichtentext",
    noMatchingConversations: "Keine passenden Schnacks",
    noMatchingConversationsDescription:
      "Versuch es mit einem anderen Titel, Anbieter, Modell oder Satz aus dem Transkript.",
    memoryModalTitle: "Schnack-Speicher",
    memoryModalDescription:
      "Das ist die kompakte Zusammenfassung, die SchnackAI weiterträgt, sobald ein Schnack lang genug wird und ältere Beiträge zusammengefasst werden.",
    memorySummary: "Gespeicherte Zusammenfassung",
    memorySummaryEmpty:
      "Noch kein kompakter Speicher. Sobald dieser Schnack länger wird, werden ältere Beiträge hier zusammengefasst.",
    summarizedTurnsCount: ({ count }) =>
      Number(count) === 1
        ? "1 zusammengefasster Beitrag"
        : `${count} zusammengefasste Beiträge`,
    copyMemory: "Speicher kopieren",
    forgetMemory: "Speicher vergessen",
    memoryCopied: "Speicher kopiert.",
    memoryCleared: "Schnack-Speicher gelöscht.",
    noConversationToManageYet: "Noch kein Schnack-Speicher verfügbar.",
    paste: "Einfügen",
    pasted: "Eingefügt",
    copied: "Kopiert",
    clipboardEmpty: "Die Zwischenablage ist leer.",
    yesterday: "Gestern",
    noProviderYet: "Noch kein Anbieter",
    noModelYet: "Noch kein Modell",
    saved: "Gespeichert",
    pinned: "Angeheftet",
    copy: "Kopieren",
    share: "Teilen",
    rename: "Umbenennen",
    pin: "Anheften",
    unpin: "Lösen",
    save: "Speichern",
    cancel: "Abbrechen",
    stop: "Stopp",
    listening: "Hört zu",
    parsing: "Verarbeitet",
    thinking: "Denkt nach",
    speaking: "Spricht",
    hold: "Halten",
    tap: "Tippen",
    holdToSpeak: "Zum Sprechen halten",
    tapToSpeak: "Zum Schnacken tippen",
    waitingOnModel: "Warte auf das Modell",
    convertingSpeech: "Sprache wird umgewandelt",
    waitingForReply: "Warte auf Antwort",
    parsingYourVoice: "Deine Sprache wird verarbeitet",
    providerConfiguredInSettings: ({ provider }) =>
      `${provider} ist in den Einstellungen nicht konfiguriert.`,
    providerNetworkError: ({ provider, action }) =>
      `${provider} war für ${action} nicht erreichbar. Prüfe die Verbindung und versuch es erneut.`,
    providerAuthError: ({ provider, action }) =>
      `${provider} hat die Zugangsdaten für ${action} abgelehnt. Prüfe API-Schlüssel und Berechtigungen.`,
    providerRateLimitError: ({ provider, action }) =>
      `${provider} drosselt ${action} gerade. Versuch es gleich noch einmal.`,
    providerTemporaryError: ({ provider, action }) =>
      `${provider} hatte während ${action} ein vorübergehendes Problem. Versuch es in Kürze erneut.`,
    providerContextTooLong: ({ provider }) =>
      `${provider} hat die Antwort abgelehnt, weil der Schnack zu lang geworden ist. Starte einen neuen Schnack oder kürze die Anfrage.`,
    providerRequestRejected: ({ provider, action, detail }) =>
      detail
        ? `${provider} hat die Anfrage für ${action} abgelehnt: ${detail}`
        : `${provider} hat die Anfrage für ${action} abgelehnt.`,
    providerValidationSuccess: ({ provider }) =>
      `${provider} ist einsatzbereit.`,
    providerValidationFailed: "Anbieter-Prüfung fehlgeschlagen.",
    noBase64EncoderAvailable: "Kein Base64-Encoder verfügbar.",
    noBase64DecoderAvailable: "Kein Base64-Decoder verfügbar.",
    nativeTtsDoesNotSynthesizeAudioFiles:
      "Native TTS erzeugt keine Audiodateien.",
    localTtsUnavailableForLanguage: ({ languageLabel }) =>
      `Für ${languageLabel} ist aktuell weder lokal noch in der Cloud eine Sprachroute bereit.`,
    chooseTextToSpeechProviderInSettings:
      "Wähle in den Einstellungen einen Text-zu-Sprache-Anbieter.",
    ttsNotSupportedYet: ({ provider }) =>
      `TTS wird für ${provider} noch nicht unterstützt.`,
    ttsError: ({ provider, status, errorText }) =>
      `TTS-Fehler bei ${provider} (${status}): ${errorText}`,
    ttsReplyTooLong: ({ provider }) =>
      `${provider} hat die Sprachausgabe abgelehnt, weil die Antwort zu lang war.`,
    ttsTimeout: ({ provider }) =>
      `Die Sprachausgabe bei ${provider} hat zu lange gedauert.`,
    ttsDidNotReturnAudio: ({ provider }) =>
      `${provider} hat kein Audio zurückgegeben.`,
    nativeSttHandledInApp: "Native STT wird direkt in der App verarbeitet.",
    chooseSpeechToTextProviderInSettings:
      "Wähle in den Einstellungen einen Sprache-zu-Text-Anbieter.",
    sttNotSupportedYet: ({ provider }) =>
      `STT wird für ${provider} noch nicht unterstützt.`,
    sttError: ({ provider, status, errorText }) =>
      `STT-Fehler bei ${provider} (${status}): ${errorText}`,
    apiError: ({ provider, status, errorText }) =>
      `API-Fehler bei ${provider} (${status}): ${errorText}`,
    providerNotWiredUpYet: ({ provider }) =>
      `${provider} ist noch nicht angebunden.`,
    user: "Nutzer",
    you: "Du",
    assistant: "Assistent",
    untitledConversation: "Unbenannter Schnack",
    conversationExportHeader: ({ title }) => `Schnack: ${title}`,
    speechRecognitionPermissionNotGranted:
      "Berechtigung für Spracherkennung wurde nicht erteilt.",
    speechRecognitionUnavailableForDeviceLanguage:
      "Spracherkennung ist für die aktuelle Gerätesprache nicht verfügbar.",
    nativeSpeechRecognitionNeedsNetwork:
      "Die native Spracherkennung benötigt gerade eine Netzwerkverbindung.",
    noSpeechDetected: "Es wurde keine Sprache erkannt.",
    nativeSpeechRecognitionFailed:
      "Die native Spracherkennung ist fehlgeschlagen.",
    couldntStartNativeSpeechRecognition:
      "Die native Spracherkennung konnte nicht gestartet werden.",
    microphonePermissionNotGranted:
      "Berechtigung für das Mikrofon wurde nicht erteilt",
  },
} satisfies Record<AppLanguage, Record<string, TranslationValue>>;

export type TranslationKey = keyof typeof translations.en;

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  params: TranslationParams = {},
) {
  const value = translations[language][key] ?? translations.en[key];
  return typeof value === "function" ? value(params) : value;
}

export function getLocaleForLanguage(language: AppLanguage) {
  return language === "de" ? "de-DE" : "en-US";
}

interface LocalizationContextValue {
  language: AppLanguage;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  locale: string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(
  null,
);

export function LocalizationProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: React.ReactNode;
}) {
  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      locale: getLocaleForLanguage(language),
      t: (key, params) => translate(language, key, params),
    }),
    [language],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);

  if (!context) {
    throw new Error(
      "useLocalization must be used within a LocalizationProvider",
    );
  }

  return context;
}
