import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import type { TranslationKey } from "../../i18n";
import { buildErrorMessage, getRecognitionLocale } from "./shared";

interface TranscribeRecordedFileParams {
  fileUri: string;
  finalTranscriptRef: React.MutableRefObject<string>;
  latestTranscriptRef: React.MutableRefObject<string>;
  t: (
    key: TranslationKey,
    params?: Record<string, string | number | undefined>,
  ) => string;
}

export function transcribeRecordedFile({
  fileUri,
  finalTranscriptRef,
  latestTranscriptRef,
  t,
}: TranscribeRecordedFileParams) {
  return new Promise<string | null>((resolve, reject) => {
    latestTranscriptRef.current = "";
    finalTranscriptRef.current = "";

    const cleanup = () => {
      resultSubscription.remove();
      errorSubscription.remove();
      endSubscription.remove();
    };

    const finish = (value: string | null) => {
      cleanup();
      resolve(value);
    };

    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };

    const resultSubscription = ExpoSpeechRecognitionModule.addListener(
      "result",
      (event) => {
        const transcript = event.results[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          return;
        }

        latestTranscriptRef.current = transcript;
        if (event.isFinal) {
          finalTranscriptRef.current = transcript;
        }
      },
    );

    const errorSubscription = ExpoSpeechRecognitionModule.addListener(
      "error",
      (event) => {
        if (event.error === "aborted" || event.error === "no-speech") {
          finish(null);
          return;
        }

        fail(new Error(buildErrorMessage(event, t)));
      },
    );

    const endSubscription = ExpoSpeechRecognitionModule.addListener("end", () => {
      const transcript =
        finalTranscriptRef.current.trim() || latestTranscriptRef.current.trim() || null;
      finish(transcript);
    });

    try {
      ExpoSpeechRecognitionModule.start({
        lang: getRecognitionLocale(),
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
        audioSource: {
          uri: fileUri,
        },
      });
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error(t("nativeSpeechRecognitionFailed")),
      );
    }
  });
}
