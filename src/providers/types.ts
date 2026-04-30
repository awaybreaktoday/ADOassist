import type { PullRequestContext, ReviewResult } from "../types.js";

export interface ReviewInput {
  pullRequest: PullRequestContext;
  rubric: string;
}

export interface ReviewProvider {
  name: string;
  reviewPullRequest(input: ReviewInput): Promise<ReviewResult>;
}
