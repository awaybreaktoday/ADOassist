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
  const normalizedResult = normalizeReviewResult(result);

  validateReviewResult(normalizedResult, changedFiles);
  return normalizedResult;
}

function validateReviewResult(result: ReviewResult, changedFiles: Set<string>): void {
  const validationError = reviewResultValidationError(result);
  if (validationError) {
    throw new AppError(`Provider returned an invalid review result: ${validationError}`);
  }

  for (const comment of result.comments) {
    if (comment.filePath && !changedFiles.has(comment.filePath)) {
      throw new AppError("Provider returned a comment for a file outside the PR");
    }
  }
}

function normalizeReviewResult(result: ReviewResult): ReviewResult {
  if (!isRecord(result) || !Array.isArray(result.comments)) {
    return result;
  }

  return {
    ...result,
    comments: result.comments.map(normalizeReviewComment)
  };
}

function normalizeReviewComment(comment: ReviewComment): ReviewComment {
  if (!isRecord(comment)) {
    return comment;
  }

  const normalized: Record<string, unknown> = { ...comment };
  const filePath = optionalString(normalized.filePath);
  const suggestion = optionalString(normalized.suggestion);

  if (filePath === undefined) {
    delete normalized.filePath;
    delete normalized.line;
  } else {
    normalized.filePath = filePath;
  }

  if (suggestion === undefined) {
    delete normalized.suggestion;
  } else {
    normalized.suggestion = suggestion;
  }

  return normalized as unknown as ReviewComment;
}

function reviewResultValidationError(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "result must be an object";
  }

  if (!isNonEmptyString(value.summary)) {
    return "summary must be a non-empty string";
  }

  if (!isNonEmptyString(value.riskSummary)) {
    return "riskSummary must be a non-empty string";
  }

  if (!Array.isArray(value.comments)) {
    return "comments must be an array";
  }

  for (const [index, comment] of value.comments.entries()) {
    const commentError = reviewCommentValidationError(comment, index);
    if (commentError) {
      return commentError;
    }
  }

  return undefined;
}

function reviewCommentValidationError(value: unknown, index: number): string | undefined {
  const path = `comments[${index}]`;

  if (!isRecord(value)) {
    return `${path} must be an object`;
  }

  if (!isNonEmptyString(value.id)) {
    return `${path}.id must be a non-empty string`;
  }

  if (!isNonEmptyString(value.message)) {
    return `${path}.message must be a non-empty string`;
  }

  if (!["info", "warning", "critical"].includes(String(value.severity))) {
    return `${path}.severity must be one of: info, warning, critical`;
  }

  if (!["correctness", "risk", "tests", "maintainability", "standards"].includes(String(value.category))) {
    return `${path}.category must be one of: correctness, risk, tests, maintainability, standards`;
  }

  if (value.filePath !== undefined && !isNonEmptyString(value.filePath)) {
    return `${path}.filePath must be a non-empty string when present`;
  }

  if (value.filePath !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
    return `${path}.line must be a positive integer when filePath is set`;
  }

  if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
    return `${path}.line must be a positive integer when present`;
  }

  if (value.suggestion !== undefined && typeof value.suggestion !== "string") {
    return `${path}.suggestion must be a string when present`;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return String(value);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
