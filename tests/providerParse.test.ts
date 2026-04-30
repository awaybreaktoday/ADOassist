import { describe, expect, it } from "vitest";
import { parseProviderReviewContent } from "../src/providers/parse.js";
import { sampleReview } from "./fixtures/sampleReview.js";

describe("parseProviderReviewContent", () => {
  it("parses raw JSON provider content", () => {
    expect(parseProviderReviewContent("Provider", JSON.stringify(sampleReview))).toEqual(sampleReview);
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const content = ["```json", JSON.stringify(sampleReview, null, 2), "```"].join("\n");

    expect(parseProviderReviewContent("Provider", content)).toEqual(sampleReview);
  });

  it("parses the first complete JSON object from provider prose", () => {
    const content = `Here is the review:\n${JSON.stringify(sampleReview, null, 2)}\nDone.`;

    expect(parseProviderReviewContent("Provider", content)).toEqual(sampleReview);
  });

  it("keeps the provider-specific malformed JSON error", () => {
    expect(() => parseProviderReviewContent("Provider", "{not json")).toThrow(
      "Provider response included invalid review JSON"
    );
  });
});
