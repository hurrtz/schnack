import * as FileSystem from "expo-file-system/legacy";
import { LOCAL_TTS_VERIFY_SAMPLE_TEXT } from "./localTts/constants";
import type { TtsListenLanguage } from "../types";
import {
  clearLocalTtsVerification,
  getLocalTtsVerification,
  setLocalTtsVerification,
} from "./localTts/verificationCache";
import {
  getLocalTtsRuntimeUnavailableReason,
  cancelLocalTtsIdleRelease,
  scheduleLocalTtsIdleRelease,
} from "./localTts/runtime";
import {
  getLocalTtsStrategy,
  getRawLocalTtsInstallStatus,
} from "./localTts/strategies";
import { releaseLocalTtsSessions } from "./localTts/sessions";

export type LocalTtsInstallStatus = {
  supported: boolean;
  downloaded: boolean;
  verified: boolean;
  installed: boolean;
  verificationError: string | null;
  [key: string]: unknown;
};

export async function verifyLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  force?: boolean;
}) {
  if (!params.force) {
    const cached = getLocalTtsVerification(params.language, params.voice);

    if (cached) {
      return cached;
    }
  }

  const rawStatus = await getRawLocalTtsInstallStatus({
    language: params.language,
    voice: params.voice,
  });
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();

  if (unavailableReason) {
    const unsupportedOnDevice = {
      verified: false,
      error: unavailableReason,
    };
    setLocalTtsVerification(params.language, params.voice, unsupportedOnDevice);
    return unsupportedOnDevice;
  }

  if (!rawStatus.installed) {
    const missing = {
      verified: false,
      error: "The local voice pack is not installed yet.",
    };
    setLocalTtsVerification(params.language, params.voice, missing);
    return missing;
  }

  const strategy = getLocalTtsStrategy(params.language);

  if (!strategy || params.language === "ja") {
    const unsupported = {
      verified: false,
      error: "A local voice pack is not available for this language yet.",
    };
    setLocalTtsVerification(params.language, params.voice, unsupported);
    return unsupported;
  }

  const sampleText = LOCAL_TTS_VERIFY_SAMPLE_TEXT[params.language];

  try {
    const outputPath = await strategy.synthesize({
      text: sampleText,
      voice: params.voice,
    });
    const outputInfo = await FileSystem.getInfoAsync(outputPath);

    if (!outputInfo.exists) {
      throw new Error(
        "The local voice pack produced no audio during verification.",
      );
    }

    await FileSystem.deleteAsync(outputPath, {
      idempotent: true,
    }).catch(() => undefined);

    const success = {
      verified: true,
      error: null,
    };
    setLocalTtsVerification(params.language, params.voice, success);
    return success;
  } catch (error) {
    const failure = {
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : "The local voice pack could not be verified on this device.",
    };
    setLocalTtsVerification(params.language, params.voice, failure);
    return failure;
  }
}

export async function getLocalTtsInstallStatus(params: {
  language: TtsListenLanguage;
  voice: string;
}): Promise<LocalTtsInstallStatus> {
  const rawStatus = await getRawLocalTtsInstallStatus(params);
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();

  if (!rawStatus.supported) {
    return {
      ...rawStatus,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    };
  }

  if (unavailableReason) {
    return {
      ...rawStatus,
      downloaded: rawStatus.installed,
      verified: false,
      installed: rawStatus.installed,
      verificationError: unavailableReason,
    };
  }

  if (!rawStatus.installed) {
    clearLocalTtsVerification(params.language, params.voice);
    return {
      ...rawStatus,
      downloaded: false,
      verified: false,
      installed: false,
      verificationError: null,
    };
  }

  const cachedVerification = getLocalTtsVerification(
    params.language,
    params.voice,
  );

  return {
    ...rawStatus,
    downloaded: true,
    verified: cachedVerification?.verified ?? false,
    installed: rawStatus.installed,
    verificationError: cachedVerification?.error ?? null,
  };
}

export async function installLocalTtsPack(params: {
  language: TtsListenLanguage;
  voice: string;
  onProgress?: (progress: number) => void;
}) {
  const unavailableReason = getLocalTtsRuntimeUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  const strategy = getLocalTtsStrategy(params.language);

  if (!strategy) {
    throw new Error(
      "A local voice pack is not available for this language yet.",
    );
  }

  await strategy.install({
    voice: params.voice,
    onProgress: params.onProgress,
  });

  clearLocalTtsVerification(params.language, params.voice);
}

export async function releaseLocalTtsResources() {
  cancelLocalTtsIdleRelease();
  await releaseLocalTtsSessions();
}

export async function synthesizeLocalSpeech(params: {
  text: string;
  language: TtsListenLanguage;
  voice: string;
}) {
  try {
    const unavailableReason = getLocalTtsRuntimeUnavailableReason();
    if (unavailableReason) {
      throw new Error(unavailableReason);
    }

    const strategy = getLocalTtsStrategy(params.language);

    if (!strategy) {
      throw new Error(
        "A local voice pack is not available for this language yet.",
      );
    }

    const audioPath = await strategy.synthesize({
      text: params.text,
      voice: params.voice,
    });
    setLocalTtsVerification(params.language, params.voice, {
      verified: true,
      error: null,
    });
    return audioPath;
  } catch (error) {
    setLocalTtsVerification(params.language, params.voice, {
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : "The local voice pack failed during synthesis.",
    });
    throw error;
  } finally {
    scheduleLocalTtsIdleRelease(releaseLocalTtsResources);
  }
}
