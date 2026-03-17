import { extractProviderErrorMessage } from "../../src/services/providerErrors";

describe("extractProviderErrorMessage", () => {
  it("returns trimmed input for a plain text error", () => {
    expect(extractProviderErrorMessage("something went wrong")).toBe(
      "something went wrong",
    );
  });

  it("collapses whitespace in plain text errors", () => {
    expect(extractProviderErrorMessage("  too   many   spaces  ")).toBe(
      "too many spaces",
    );
  });

  it("extracts error.message from a JSON response", () => {
    const json = JSON.stringify({
      error: { message: "Invalid API key provided" },
    });
    expect(extractProviderErrorMessage(json)).toBe(
      "Invalid API key provided",
    );
  });

  it("extracts a top-level message field from JSON", () => {
    const json = JSON.stringify({ message: "Rate limit exceeded" });
    expect(extractProviderErrorMessage(json)).toBe("Rate limit exceeded");
  });

  it("extracts the first message from an errors array", () => {
    const json = JSON.stringify({
      errors: [
        { message: "Field 'model' is required" },
        { message: "Field 'input' is required" },
      ],
    });
    expect(extractProviderErrorMessage(json)).toBe(
      "Field 'model' is required",
    );
  });

  it("returns trimmed input when JSON has no recognized message fields", () => {
    const json = JSON.stringify({ code: 400, detail: "bad request" });
    expect(extractProviderErrorMessage(json)).toBe(
      '{"code":400,"detail":"bad request"}',
    );
  });

  it("returns trimmed input for invalid JSON", () => {
    expect(extractProviderErrorMessage("{not valid json")).toBe(
      "{not valid json",
    );
  });

  it("handles an empty string", () => {
    expect(extractProviderErrorMessage("")).toBe("");
  });

  it("handles a JSON string value", () => {
    expect(extractProviderErrorMessage('"just a string"')).toBe(
      "just a string",
    );
  });

  it("skips errors array entries without a message field", () => {
    const json = JSON.stringify({
      errors: [{ code: "ERR" }, { message: "actual error" }],
    });
    expect(extractProviderErrorMessage(json)).toBe("actual error");
  });

  it("falls back to raw input when errors array has no message fields", () => {
    const json = JSON.stringify({ errors: [{ code: "ERR" }] });
    expect(extractProviderErrorMessage(json)).toBe(
      '{"errors":[{"code":"ERR"}]}',
    );
  });
});
