import { OPENAI_API_KEY } from "../config";

export async function transcribeAudio(fileUri: string): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", { uri: fileUri, type: "audio/m4a", name: "recording.m4a" } as any);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.text?.trim();
  return text ? text : null;
}
