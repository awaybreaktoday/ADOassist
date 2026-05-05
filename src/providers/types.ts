import type { DocEvidence, PullRequestContext, ReviewResult } from "../types.js";

export interface ReviewInput {
  pullRequest: PullRequestContext;
  rubric: string;
  docEvidence?: DocEvidence;
}

export interface ReviewProvider {
  name: string;
  reviewPullRequest(input: ReviewInput): Promise<ReviewResult>;
}
