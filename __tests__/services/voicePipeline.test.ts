import { splitIntoSentences } from "../../src/services/voicePipeline";

describe("splitIntoSentences", () => {
  it("splits on period", () => { expect(splitIntoSentences("Hello. World.")).toEqual(["Hello.", " World."]); });
  it("splits on question mark", () => { expect(splitIntoSentences("How? Why?")).toEqual(["How?", " Why?"]); });
  it("splits on exclamation mark", () => { expect(splitIntoSentences("Wow! Great!")).toEqual(["Wow!", " Great!"]); });
  it("splits on newline", () => { expect(splitIntoSentences("Line one\nLine two")).toEqual(["Line one\n", "Line two"]); });
  it("returns single chunk for no delimiters", () => { expect(splitIntoSentences("hello world")).toEqual(["hello world"]); });
});
