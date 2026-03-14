import * as FileSystem from "expo-file-system/legacy";

let ttsCounter = 0;

function requireOpenAIKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("OpenAI is not configured in Settings.");
  }

  return apiKey;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:...;base64," prefix
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function synthesizeSpeech(
  text: string,
  voice: string,
  apiKey: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireOpenAIKey(apiKey)}`,
    },
    body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3" }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error (${response.status}): ${errorText}`);
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const path = `${FileSystem.cacheDirectory}tts-${Date.now()}-${ttsCounter++}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" });
  return path;
}
