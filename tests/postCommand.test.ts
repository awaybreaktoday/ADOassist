import { describe, expect, it, vi } from "vitest";
import { postReviewDraft } from "../src/commands/post.js";
import { formatReviewDraft } from "../src/drafts/format.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("postReviewDraft", () => {
  it("posts only comments that remain in the review draft", async () => {
    const markdown = formatReviewDraft(sampleContext, {
      ...sampleReview,
      comments: [sampleReview.comments[0]]
    });
    const postComments = vi.fn().mockResolvedValue(undefined);

    await postReviewDraft({
      markdown,
      client: { postComments }
    });

    expect(postComments).toHaveBeenCalledWith(sampleContext.ref, [sampleReview.comments[0]]);
  });
});
