import React from "react";
import * as Speech from "expo-speech";
import { TextInput } from "react-native";

import {
  LocalTtsVoiceSelections,
  Provider,
  ResponseMode,
  ResponseModeRoute,
  Settings,
  TtsListenLanguage,
  VoicePreviewRequest,
} from "../../types";

export interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  focusProvider?: Provider;
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onUpdateResponseModeRoute: (
    mode: ResponseMode,
    route: ResponseModeRoute,
  ) => void;
  onUpdateProviderSttModel: (provider: Provider, model: string) => void;
  onUpdateProviderTtsModel: (provider: Provider, model: string) => void;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onUpdateLocalTtsVoice: (
    language: keyof LocalTtsVoiceSelections,
    voice: string,
  ) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  localTtsPackStates: LocalTtsPackStates;
  onInstallLocalTtsLanguagePack: (language: TtsListenLanguage) => Promise<void>;
  onPreviewVoice: (
    request: VoicePreviewRequest,
    callbacks?: {
      onPlaybackStarted?: () => void;
    },
  ) => Promise<void>;
  onStopPreviewVoice: () => Promise<void>;
  onValidateProvider: (provider: Provider) => Promise<void>;
  onClose: () => void;
}

export type SettingsTab = "instructions" | "providers" | "stt" | "tts" | "ui";

export type TextInputFocusHandler = NonNullable<
  React.ComponentProps<typeof TextInput>["onFocus"]
>;

export type ProviderValidationState = {
  status: "idle" | "validating" | "success" | "error";
  message?: string;
  apiKey?: string;
  model?: string;
};

export type PreviewButtonPhase = "idle" | "generating" | "playing";

export type NativeSpeechVoice = Awaited<
  ReturnType<typeof Speech.getAvailableVoicesAsync>
>[number];

export type LocalTtsPackStates = Partial<
  Record<
    TtsListenLanguage,
    {
      supported: boolean;
      downloaded: boolean;
      verified: boolean;
      installed: boolean;
      downloading: boolean;
      progress: number;
      error: string | null;
    }
  >
>;
