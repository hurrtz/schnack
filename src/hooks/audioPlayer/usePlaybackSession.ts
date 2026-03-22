import { useCallback, useRef } from "react";
import { setAudioModeAsync, setIsAudioActiveAsync } from "expo-audio";

export function usePlaybackSession() {
  const audioSessionReadyRef = useRef(false);
  const audioSessionPromiseRef = useRef<Promise<void> | null>(null);

  const resetPlaybackSession = useCallback(() => {
    audioSessionReadyRef.current = false;
    audioSessionPromiseRef.current = null;
    void setIsAudioActiveAsync(false).catch(() => {
      // Ignore audio-session teardown failures; the next playback attempt will re-prime it.
    });
  }, []);

  const ensurePlaybackSession = useCallback(async () => {
    if (audioSessionReadyRef.current) {
      return;
    }

    if (!audioSessionPromiseRef.current) {
      audioSessionPromiseRef.current = setIsAudioActiveAsync(true)
        .then(() =>
          setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          }),
        )
        .then(() => {
          audioSessionReadyRef.current = true;
        })
        .finally(() => {
          audioSessionPromiseRef.current = null;
        });
    }

    await audioSessionPromiseRef.current;
  }, []);

  return {
    ensurePlaybackSession,
    resetPlaybackSession,
  };
}
