import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { formatReviewDraft, reviewDraftFilename } from "../src/drafts/format.js";
import { parseReviewDraft } from "../src/drafts/parse.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("review draft format and parse", () => {
  it("round-trips approved comments through the machine-readable block", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const parsed = parseReviewDraft(draft);

    expect(draft).toContain("- Description: Adds retry support and documents rollback expectations.");
    expect(draft).toContain("## PR Quality And Coverage Gaps");
    expect(draft).toContain("Add a test for retry exhaustion.");
    expect(parsed.pr).toEqual(sampleContext.ref);
    expect(parsed.comments).toEqual(sampleReview.comments);
  });

  it("allows users to remove comments before posting", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const edited = draft.replace(/,\n    \{[\s\S]*?comment-2[\s\S]*?\n    \}/, "");
    const parsed = parseReviewDraft(edited);

    expect(parsed.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
  });

  it("rejects drafts without the approved comments block", () => {
    expect(() => parseReviewDraft("# Review")).toThrow("Review draft is missing approved comments JSON");
  });

  it("encodes path-like PR values in draft filenames", () => {
    const filename = reviewDraftFilename({
      ...sampleContext,
      ref: {
        ...sampleContext.ref,
        organization: "../acme",
        project: "Pay/ments",
        repository: "api service"
      }
    });

    expect(filename).toBe(join("reviews", "..%2Facme-Pay%2Fments-api%20service-pr-42.md"));
  });

  it("rejects unexpected edited JSON fields", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const edited = draft.replace('"filePath": "/src/payments/retry.ts"', '"filepath": "/src/payments/retry.ts"');

    expect(() => parseReviewDraft(edited)).toThrow(
      "Review draft approved comments JSON has an invalid shape"
    );
  });

  it("parses CRLF drafts and closing fences without a preceding newline", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview)
      .replace(/\n```$/, "```")
      .replace(/\n/g, "\r\n");
    const parsed = parseReviewDraft(draft);

    expect(parsed.comments).toEqual(sampleReview.comments);
  });

  it("round-trips comments that contain Markdown fences", () => {
    const review = {
      ...sampleReview,
      comments: [
        {
          ...sampleReview.comments[0],
          message: "Consider this example:\n```ts\nretry();\n```"
        }
      ]
    };

    const draft = formatReviewDraft(sampleContext, review);
    const parsed = parseReviewDraft(draft);

    expect(parsed.comments).toEqual(review.comments);
  });
});
