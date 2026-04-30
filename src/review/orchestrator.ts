import { AppError } from "../errors.js";
import type { ReviewProvider } from "../providers/types.js";
import type { PullRequestContext, ReviewEmphasis, ReviewResult } from "../types.js";
import { buildReviewRubric } from "./rubric.js";

export interface ReviewPullRequestOptions {
  context: PullRequestContext;
  emphasis: ReviewEmphasis[];
  provider: ReviewProvider;
}

export async function reviewPullRequest(options: ReviewPullRequestOptions): Promise<ReviewResult> {
  const rubric = buildReviewRubric(options.emphasis);
  const result = await options.provider.reviewPullRequest({
    pullRequest: options.context,
    rubric
  });

  validateReviewResult(result, options.context);
  return result;
}

function validateReviewResult(result: ReviewResult, context: PullRequestContext): void {
  if (!result.summary.trim()) {
    throw new AppError("Provider returned an empty review summary");
  }

  const changedFiles = new Set(context.files.map((file) => file.path));
  for (const comment of result.comments) {
    if (comment.filePath && !changedFiles.has(comment.filePath)) {
      throw new AppError("Provider returned a comment for a file outside the PR");
    }
  }
}
