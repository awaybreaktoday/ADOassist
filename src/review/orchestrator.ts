import { AppError } from "../errors.js";
import type { ReviewProvider } from "../providers/types.js";
import type { PullRequestContext, ReviewComment, ReviewEmphasis, ReviewResult } from "../types.js";
import { buildReviewRubric } from "./rubric.js";

export interface ReviewPullRequestOptions {
  context: PullRequestContext;
  emphasis: ReviewEmphasis[];
  provider: ReviewProvider;
}

export async function reviewPullRequest(options: ReviewPullRequestOptions): Promise<ReviewResult> {
  const rubric = buildReviewRubric(options.emphasis);
  const changedFiles = new Set(options.context.files.map((file) => file.path));
  const result = await options.provider.reviewPullRequest({
    pullRequest: options.context,
    rubric
  });

  validateReviewResult(result, changedFiles);
  return result;
}

function validateReviewResult(result: ReviewResult, changedFiles: Set<string>): void {
  if (!isReviewResult(result)) {
    throw new AppError("Provider returned an invalid review result");
  }

  for (const comment of result.comments) {
    if (comment.filePath && !changedFiles.has(comment.filePath)) {
      throw new AppError("Provider returned a comment for a file outside the PR");
    }
  }
}

function isReviewResult(value: unknown): value is ReviewResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.summary) &&
    isNonEmptyString(value.riskSummary) &&
    Array.isArray(value.comments) &&
    value.comments.every(isReviewComment)
  );
}

function isReviewComment(value: unknown): value is ReviewComment {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.message)) {
    return false;
  }

  if (!["info", "warning", "critical"].includes(String(value.severity))) {
    return false;
  }

  if (!["correctness", "risk", "tests", "maintainability", "standards"].includes(String(value.category))) {
    return false;
  }

  if (value.filePath !== undefined && !isNonEmptyString(value.filePath)) {
    return false;
  }

  if (value.filePath !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
    return false;
  }

  if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
    return false;
  }

  if (value.suggestion !== undefined && typeof value.suggestion !== "string") {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
