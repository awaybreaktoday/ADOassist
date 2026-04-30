import { z } from "zod";
import { AppError } from "../errors.js";
import type { PullRequestRef, ReviewComment } from "../types.js";

const commentSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().optional(),
  line: z.number().int().positive().optional(),
  severity: z.enum(["info", "warning", "critical"]),
  category: z.enum(["correctness", "risk", "tests", "maintainability", "standards"]),
  message: z.string().min(1),
  suggestion: z.string().optional()
}).strict();

const draftSchema = z.object({
  pr: z.object({
    organization: z.string().min(1),
    project: z.string().min(1),
    repository: z.string().min(1),
    pullRequestId: z.number().int().positive(),
    url: z.string().url()
  }).strict(),
  comments: z.array(commentSchema)
}).strict();

export interface ParsedReviewDraft {
  pr: PullRequestRef;
  comments: ReviewComment[];
}

export function parseReviewDraft(markdown: string): ParsedReviewDraft {
  const match = markdown.match(/```json ado-assist-approved-comments\r?\n([\s\S]*?)(?:\r?\n)?```/);
  if (!match) {
    throw new AppError("Review draft is missing approved comments JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new AppError("Review draft approved comments JSON is invalid");
  }

  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("Review draft approved comments JSON has an invalid shape");
  }

  return result.data;
}
