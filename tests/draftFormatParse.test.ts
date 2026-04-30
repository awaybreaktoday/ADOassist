import { describe, expect, it } from "vitest";
import { formatReviewDraft } from "../src/drafts/format.js";
import { parseReviewDraft } from "../src/drafts/parse.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("review draft format and parse", () => {
  it("round-trips approved comments through the machine-readable block", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const parsed = parseReviewDraft(draft);

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
});
