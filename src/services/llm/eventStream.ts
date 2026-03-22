export async function readEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: { type: string; data: string }) => void | Promise<void>,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushEventBlocks = async () => {
    let separatorMatch = buffer.match(/\r?\n\r?\n/);

    while (separatorMatch && separatorMatch.index !== undefined) {
      const separatorIndex = separatorMatch.index;
      const separatorLength = separatorMatch[0].length;
      const rawBlock = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + separatorLength);

      if (rawBlock) {
        let type = "message";
        const dataLines: string[] = [];

        for (const line of rawBlock.split(/\r?\n/)) {
          if (line.startsWith("event:")) {
            type = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        await onEvent({
          type,
          data: dataLines.join("\n"),
        });
      }

      separatorMatch = buffer.match(/\r?\n\r?\n/);
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      await flushEventBlocks();
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    await flushEventBlocks();
  }
}
