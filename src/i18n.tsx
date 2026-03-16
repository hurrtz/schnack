import React, { createContext, useContext, useMemo } from "react";
import { AppLanguage } from "./types";

type TranslationParams = Record<string, string | number | undefined>;
type TranslationValue =
  | string
  | ((params: TranslationParams) => string);

const translations = {
  en: {
    retry: "Retry",
    unavailable: "Unavailable",
    selection: "Selection",
    chooseCompatibleProviderFirst: "Choose a compatible provider first",
    settings: "Settings",
    instructions: "Instructions",
    providers: "Providers",
    stt: "STT",
    tts: "TTS",
    ui: "UI",
    theme: "Theme",
    language: "Language",
    model: "Model",
    english: "English",
    german: "German",
    light: "Light",
    dark: "Dark",
    system: "System",
    languageCoverage: ({ note }) => `Language coverage: ${note}`,
    instructionsTabDescription:
      "Shape the hidden guidance that steers the assistant before any provider sees the request.",
    providersTabDescription:
      "Connect providers, store keys on-device, and decide which model each provider should use.",
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
    assistantInstructions: "Assistant Instructions",
    assistantInstructionsIntro:
      "Shape the hidden guidance the model receives before every reply.",
    baseInstructions: "Base Instructions",
    assistantInstructionsPlaceholder:
      "Define how the assistant should behave.",
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
    providerTtsDescription:
      "Use a configured provider for spoken replies and preview.",
    ttsProvider: "TTS Provider",
    ttsProviderEnabledHint:
      "Only enabled providers with spoken-reply support appear here.",
    ttsProviderMissingHint:
      "Enable a provider with TTS support in the Providers tab to choose it here.",
    nativeTtsHint:
      "Native TTS uses the system voice stack and does not require a provider key.",
    ttsVoice: "TTS Voice",
    voiceSelection: "Voice Selection",
    nativeVoiceSelectionHint:
      "Native playback uses the device voice chosen by the operating system.",
    providerDefaultVoiceHint:
      "This provider currently uses its default voice for preview and spoken replies.",
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
    messageCopied: "Message copied.",
    noConversationToCopyYet: "No conversation to copy yet.",
    threadCopied: "Thread copied.",
    addProviderKeyToUseProvider: ({ provider }) =>
      `Add your ${provider} API key in Settings to use this provider.`,
    speechRecognitionUnavailableOnDevice:
      "Speech recognition is unavailable on this device.",
    chooseSttBeforeVoiceSession:
      "Choose an enabled STT provider in Settings before starting a voice session.",
    chooseTtsBeforeSpokenReplies:
      "Choose an enabled TTS provider in Settings before using spoken replies.",
    couldntCatchThatTryAgain: "Couldn't catch that, try again.",
    couldntStartVoiceInput: "Couldn't start voice input.",
    couldntProcessVoiceInput: "Couldn't process voice input.",
    addProviderKeyToEnableProvider: ({ provider }) =>
      `Add your ${provider} API key in Settings to enable it.`,
    stopSessionBeforePreview:
      "Stop the active voice session before previewing a voice.",
    chooseTtsToPreviewVoices:
      "Choose an enabled TTS provider in Settings to preview voices.",
    couldntPreviewVoice: "Couldn't preview voice.",
    liveInput: "Live Input",
    parsingInput: "Parsing Input",
    awaitingModel: "Awaiting Model",
    voiceOutput: "Voice Output",
    controlRoom: "Control Room",
    listeningToYourVoice: "Listening to your voice",
    parsingYourVoiceInput: "Parsing your voice input",
    waitingForProvider: ({ provider }) => `Waiting for ${provider}`,
    speakingBackToYou: "Speaking back to you",
    readyForNextThought: "Ready for the next thought",
    freshSession: "Fresh session",
    messageCount: ({ count }) =>
      Number(count) === 1 ? "1 message" : `${count} messages`,
    conversation: "Conversation",
    open: "Open",
    copyThread: "Copy Thread",
    noTranscriptYet: "No transcript yet",
    previewTranscriptEmptyDescription:
      "Start with the voice stage above. Your messages and the model reply will land here instantly.",
    transcript: "Transcript",
    noConversationYet: "No conversation yet",
    expandedTranscriptEmptyDescription:
      "Speak with the control above. Pull the drawer handle down when you want to return to the main stage.",
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
    yesterday: "Yesterday",
    noProviderYet: "No provider yet",
    noModelYet: "No model yet",
    saved: "Saved",
    copy: "Copy",
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
    noBase64EncoderAvailable: "No base64 encoder available.",
    noBase64DecoderAvailable: "No base64 decoder available.",
    nativeTtsDoesNotSynthesizeAudioFiles:
      "Native TTS does not synthesize audio files.",
    chooseTextToSpeechProviderInSettings:
      "Choose a text-to-speech provider in Settings.",
    ttsNotSupportedYet: ({ provider }) => `${provider} TTS is not supported yet.`,
    ttsError: ({ provider, status, errorText }) =>
      `${provider} TTS error (${status}): ${errorText}`,
    ttsDidNotReturnAudio: ({ provider }) => `${provider} TTS did not return audio.`,
    nativeSttHandledInApp: "Native STT is handled directly in the app.",
    chooseSpeechToTextProviderInSettings:
      "Choose a speech-to-text provider in Settings.",
    sttNotSupportedYet: ({ provider }) => `${provider} STT is not supported yet.`,
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
    retry: "Erneut",
    unavailable: "Nicht verfuegbar",
    selection: "Auswahl",
    chooseCompatibleProviderFirst:
      "Waehle zuerst einen kompatiblen Anbieter",
    settings: "Einstellungen",
    instructions: "Anweisungen",
    providers: "Anbieter",
    stt: "STT",
    tts: "TTS",
    ui: "UI",
    theme: "Design",
    language: "Sprache",
    model: "Modell",
    english: "Englisch",
    german: "Deutsch",
    light: "Hell",
    dark: "Dunkel",
    system: "System",
    languageCoverage: ({ note }) => `Sprachabdeckung: ${note}`,
    instructionsTabDescription:
      "Lege die verborgene Anleitung fest, die den Assistenten steuert, bevor ein Anbieter die Anfrage sieht.",
    providersTabDescription:
      "Verbinde Anbieter, speichere Schluessel lokal auf dem Geraet und bestimme, welches Modell pro Anbieter verwendet wird.",
    sttTabDescription:
      "Steuere, wie Sprache aufgenommen wird und welches Backend Audio in Text umwandelt, bevor es das Modell erreicht.",
    ttsTabDescription:
      "Steuere, wann Antworten vorgelesen werden und welches Backend die Sprachausgabe uebernimmt.",
    brief: "Kurz",
    briefDescription:
      "Halte die Antwort knapp. Nutze nur so viele Saetze wie noetig, um die Anfrage vollstaendig zu beantworten.",
    normal: "Normal",
    normalDescription:
      "Ziele auf eine ausgewogene Antwortlaenge. Decke die wichtigen Punkte ab, ohne die Antwort unnoetig in die Laenge zu ziehen.",
    thorough: "Ausfuehrlich",
    thoroughDescription:
      "Gehe tief rein und sei umfassend. Beruecksichtige Nuancen, Details, Abwaegungen und die relevante Begruendung.",
    professional: "Professionell",
    professionalDescription:
      "Sprich wie ein Senior-Berater im Kundengespraech. Praezise Sprache, kein Slang, ruhig und autoritaer.",
    casual: "Locker",
    casualDescription:
      "Sprich wie ein kluger Freund im Cafe. Locker, natuerlich, gespraechig. Verkuerzungen und kleine Abschweifungen sind okay.",
    nerdy: "Nerdig",
    nerdyDescription:
      "Sprich wie ein begeisterter Experte, der gerne in die Tiefe geht. Nutze Fachbegriffe frei und geh entspannt ins Detail.",
    concise: "Praegnant",
    conciseDescription:
      "Sei so kurz wie moeglich und trotzdem vollstaendig. Keine Einleitung, kein Fuelltext, nur die Antwort.",
    socratic: "Sokratisch",
    socraticDescription:
      "Fordere das Denken der Nutzerin oder des Nutzers heraus. Stelle Gegenfragen und biete alternative Perspektiven an.",
    eli5: "Einfach erklaert",
    eli5Description:
      "Erklaere alles so einfach wie moeglich. Nutze Analogien, Alltagssprache und vermeide Fachjargon.",
    openProviderSettings: ({ provider }) =>
      `${provider}-Einstellungen oeffnen`,
    createProviderApiKey: ({ provider }) =>
      `API-Schluessel fuer ${provider} erstellen`,
    useProvider: ({ provider }) => `${provider} verwenden`,
    createApiKey: "API-Schluessel erstellen",
    assistantInstructions: "Assistenten-Anweisungen",
    assistantInstructionsIntro:
      "Lege die verborgene Anleitung fest, die das Modell vor jeder Antwort erhaelt.",
    baseInstructions: "Basis-Anweisungen",
    assistantInstructionsPlaceholder:
      "Definiere, wie sich der Assistent verhalten soll.",
    assistantInstructionsHint:
      "Das wird immer vor der gewaehlten Antwortlaenge und dem Stil vorangestellt.",
    adaptiveLength: "Antwortlaenge",
    responseTone: "Antwortstil",
    inputMode: "Eingabemodus",
    pushToTalk: "Gedrueckt sprechen",
    pushToTalkDescription:
      "Halte die Haupttaste waehrend des Sprechens gedrueckt und lasse los, um zu senden.",
    toggleToTalk: "Antippen sprechen",
    toggleToTalkDescription:
      "Tippe einmal zum Starten der Aufnahme und noch einmal, wenn du fertig bist.",
    speechToText: "Sprache zu Text",
    appNative: "App-intern",
    nativeSttDescription:
      "Verwende die im Geraet eingebaute Spracherkennung. Kein Anbieter-Schluessel noetig.",
    provider: "Anbieter",
    providerSttDescription:
      "Verwende einen konfigurierten Anbieter, um deine Sprache zu transkribieren, bevor sie an das Modell gesendet wird.",
    sttProvider: "STT-Anbieter",
    sttProviderEnabledHint:
      "Hier erscheinen nur aktivierte Anbieter mit Transkriptionsunterstuetzung.",
    sttProviderMissingHint:
      "Aktiviere im Tab Anbieter einen Dienst mit STT-Unterstuetzung, um ihn hier auszuwaehlen.",
    nativeSttHint:
      "Native STT nutzt direkt die Spracherkennung des Geraets und funktioniert unabhaengig von deinen Anbieter-Schluesseln.",
    replyPlayback: "Antwort-Wiedergabe",
    sentencesArrive: "Saetze sofort",
    sentencesArriveDescription:
      "Beginne mit der Sprachausgabe, sobald vollstaendige Saetze bereitstehen.",
    fullReplyFirst: "Komplette Antwort zuerst",
    fullReplyFirstDescription:
      "Erzeuge zuerst die komplette Antwort und spiele sie dann in einem Durchgang ab.",
    textToSpeech: "Text zu Sprache",
    nativeTtsDescription:
      "Verwende die Sprachengine des Geraets fuer gesprochene Antworten und die Stimmvorschau.",
    providerTtsDescription:
      "Verwende einen konfigurierten Anbieter fuer gesprochene Antworten und Vorschau.",
    ttsProvider: "TTS-Anbieter",
    ttsProviderEnabledHint:
      "Hier erscheinen nur aktivierte Anbieter mit Sprachausgabe-Unterstuetzung.",
    ttsProviderMissingHint:
      "Aktiviere im Tab Anbieter einen Dienst mit TTS-Unterstuetzung, um ihn hier auszuwaehlen.",
    nativeTtsHint:
      "Native TTS nutzt die Systemstimmen des Geraets und benoetigt keinen Anbieter-Schluessel.",
    ttsVoice: "TTS-Stimme",
    voiceSelection: "Stimmenauswahl",
    nativeVoiceSelectionHint:
      "Native Wiedergabe nutzt die vom Betriebssystem ausgewaehlte Geraetestimme.",
    providerDefaultVoiceHint:
      "Dieser Anbieter nutzt aktuell seine Standardstimme fuer Vorschau und Sprachausgabe.",
    voicePreviewText: "Text fuer Stimmvorschau",
    voicePreviewPlaceholder:
      "Gib einen Satz ein, um diese Stimme zu hoeren.",
    voicePreviewHint:
      "Verwendet das aktuell gewaehlte Sprach-Backend, ohne etwas an das Sprachmodell zu senden.",
    previewVoice: "Stimme testen",
    generatingPreview: "Vorschau wird erzeugt...",
    systemVoice: "Systemstimme",
    noTtsProvider: "Kein TTS-Anbieter",
    nothingToCopyYet: "Noch nichts zum Kopieren.",
    couldntCopyText: "Der Text konnte nicht kopiert werden.",
    messageCopied: "Nachricht kopiert.",
    noConversationToCopyYet: "Noch keine Konversation zum Kopieren.",
    threadCopied: "Verlauf kopiert.",
    addProviderKeyToUseProvider: ({ provider }) =>
      `Fuege in den Einstellungen deinen API-Schluessel fuer ${provider} hinzu, um diesen Anbieter zu nutzen.`,
    speechRecognitionUnavailableOnDevice:
      "Spracherkennung ist auf diesem Geraet nicht verfuegbar.",
    chooseSttBeforeVoiceSession:
      "Waehle in den Einstellungen einen aktivierten STT-Anbieter, bevor du eine Sprachsitzung startest.",
    chooseTtsBeforeSpokenReplies:
      "Waehle in den Einstellungen einen aktivierten TTS-Anbieter, bevor du gesprochene Antworten nutzt.",
    couldntCatchThatTryAgain:
      "Das konnte nicht sauber erkannt werden. Versuch es noch einmal.",
    couldntStartVoiceInput: "Spracheingabe konnte nicht gestartet werden.",
    couldntProcessVoiceInput:
      "Spracheingabe konnte nicht verarbeitet werden.",
    addProviderKeyToEnableProvider: ({ provider }) =>
      `Fuege in den Einstellungen deinen API-Schluessel fuer ${provider} hinzu, um diesen Anbieter zu aktivieren.`,
    stopSessionBeforePreview:
      "Beende zuerst die laufende Sprachsitzung, bevor du eine Stimme testest.",
    chooseTtsToPreviewVoices:
      "Waehle in den Einstellungen einen aktivierten TTS-Anbieter, um Stimmen zu testen.",
    couldntPreviewVoice: "Die Stimmvorschau konnte nicht abgespielt werden.",
    liveInput: "Live-Eingabe",
    parsingInput: "Eingabe wird verarbeitet",
    awaitingModel: "Modell wartet",
    voiceOutput: "Sprachausgabe",
    controlRoom: "Steuerzentrale",
    listeningToYourVoice: "Ich hoere dir zu",
    parsingYourVoiceInput: "Deine Sprache wird verarbeitet",
    waitingForProvider: ({ provider }) => `Warte auf ${provider}`,
    speakingBackToYou: "Antwort wird gesprochen",
    readyForNextThought: "Bereit fuer den naechsten Gedanken",
    freshSession: "Neue Sitzung",
    messageCount: ({ count }) =>
      Number(count) === 1 ? "1 Nachricht" : `${count} Nachrichten`,
    conversation: "Konversation",
    open: "Oeffnen",
    copyThread: "Verlauf kopieren",
    noTranscriptYet: "Noch kein Transkript",
    previewTranscriptEmptyDescription:
      "Starte oben mit der Sprachbuehne. Deine Nachrichten und die Modellantwort erscheinen hier sofort.",
    transcript: "Transkript",
    noConversationYet: "Noch keine Konversation",
    expandedTranscriptEmptyDescription:
      "Sprich ueber die Steuerung oben. Ziehe den Griff des Drawers nach unten, um zur Hauptansicht zurueckzukehren.",
    startWithGroq: "Mit Groq starten",
    groqStarterDescription:
      "Groq bietet einen kostenlosen Tarif und ist damit der schnellste Weg, die App freizuschalten. Fuege in den Einstellungen den API-Schluessel hinzu, dann erscheint der Anbieter-Umschalter sofort hier.",
    live: "Live",
    idle: "Bereit",
    yourConversationAppearsHere: "Deine Konversation erscheint hier",
    defaultTranscriptEmptyDescription:
      "Halte die Sprachsteuerung gedrueckt und sprich ganz natuerlich. SchnackAI behaelt den Verlauf und antwortet dir per Stimme.",
    delete: "Loeschen",
    memory: "Speicher",
    conversations: "Konversationen",
    drawerSubtitle:
      "Wechsle zwischen aktiven Verlaeufen oder starte einen neuen Raum.",
    newSession: "Neue Sitzung",
    noSavedConversationsYet: "Noch keine gespeicherten Konversationen",
    drawerEmptyDescription:
      "Sprich in der Hauptansicht los und SchnackAI erstellt automatisch eine Sitzung.",
    yesterday: "Gestern",
    noProviderYet: "Noch kein Anbieter",
    noModelYet: "Noch kein Modell",
    saved: "Gespeichert",
    copy: "Kopieren",
    listening: "Hoert",
    parsing: "Verarbeitet",
    thinking: "Denkt",
    speaking: "Spricht",
    hold: "Halten",
    tap: "Tippen",
    holdToSpeak: "Zum Sprechen halten",
    tapToSpeak: "Zum Sprechen tippen",
    waitingOnModel: "Warte auf das Modell",
    convertingSpeech: "Sprache wird umgewandelt",
    waitingForReply: "Warte auf Antwort",
    parsingYourVoice: "Deine Sprache wird verarbeitet",
    providerConfiguredInSettings: ({ provider }) =>
      `${provider} ist in den Einstellungen nicht konfiguriert.`,
    noBase64EncoderAvailable: "Kein Base64-Encoder verfuegbar.",
    noBase64DecoderAvailable: "Kein Base64-Decoder verfuegbar.",
    nativeTtsDoesNotSynthesizeAudioFiles:
      "Native TTS erzeugt keine Audiodateien.",
    chooseTextToSpeechProviderInSettings:
      "Waehle in den Einstellungen einen Text-zu-Sprache-Anbieter.",
    ttsNotSupportedYet: ({ provider }) =>
      `TTS wird fuer ${provider} noch nicht unterstuetzt.`,
    ttsError: ({ provider, status, errorText }) =>
      `TTS-Fehler bei ${provider} (${status}): ${errorText}`,
    ttsDidNotReturnAudio: ({ provider }) =>
      `${provider} hat kein Audio zurueckgegeben.`,
    nativeSttHandledInApp:
      "Native STT wird direkt in der App verarbeitet.",
    chooseSpeechToTextProviderInSettings:
      "Waehle in den Einstellungen einen Sprache-zu-Text-Anbieter.",
    sttNotSupportedYet: ({ provider }) =>
      `STT wird fuer ${provider} noch nicht unterstuetzt.`,
    sttError: ({ provider, status, errorText }) =>
      `STT-Fehler bei ${provider} (${status}): ${errorText}`,
    apiError: ({ provider, status, errorText }) =>
      `API-Fehler bei ${provider} (${status}): ${errorText}`,
    providerNotWiredUpYet: ({ provider }) =>
      `${provider} ist noch nicht angebunden.`,
    user: "Nutzer",
    you: "Du",
    assistant: "Assistent",
    untitledConversation: "Unbenannte Konversation",
    conversationExportHeader: ({ title }) => `Konversation: ${title}`,
    speechRecognitionPermissionNotGranted:
      "Berechtigung fuer Spracherkennung wurde nicht erteilt.",
    speechRecognitionUnavailableForDeviceLanguage:
      "Spracherkennung ist fuer die aktuelle Geraetesprache nicht verfuegbar.",
    nativeSpeechRecognitionNeedsNetwork:
      "Die native Spracherkennung benoetigt gerade eine Netzwerkverbindung.",
    noSpeechDetected: "Es wurde keine Sprache erkannt.",
    nativeSpeechRecognitionFailed:
      "Die native Spracherkennung ist fehlgeschlagen.",
    couldntStartNativeSpeechRecognition:
      "Die native Spracherkennung konnte nicht gestartet werden.",
    microphonePermissionNotGranted:
      "Berechtigung fuer das Mikrofon wurde nicht erteilt",
  },
} satisfies Record<AppLanguage, Record<string, TranslationValue>>;

export type TranslationKey = keyof typeof translations.en;

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  params: TranslationParams = {}
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

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

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
    [language]
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
    throw new Error("useLocalization must be used within a LocalizationProvider");
  }

  return context;
}
