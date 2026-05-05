import { describe, expect, it } from "vitest";
import { providerSystemPrompt } from "../src/providers/prompt.js";

describe("providerSystemPrompt", () => {
  it("tells providers to describe the actual branch diff rather than desired fixes", () => {
    const prompt = providerSystemPrompt();

    expect(prompt).toContain("describe what the diff changes as-is");
    expect(prompt).toContain("Avoid words like fix, correct, repair, resolve, or restore");
    expect(prompt).toContain("unless the diff actually repairs an existing issue");
    expect(prompt).toContain("put discovered defects in Risk / Impact, Validation, and comments");
  });
});
