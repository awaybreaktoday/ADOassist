import type { PullRequestContext, ReviewResult } from "../../src/types.js";

export const sampleContext: PullRequestContext = {
  ref: {
    organization: "acme",
    project: "Payments",
    repository: "api-service",
    pullRequestId: 42,
    url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
  },
  metadata: {
    title: "Add payment retry",
    author: "A. Developer",
    sourceBranch: "refs/heads/feature/retry",
    targetBranch: "refs/heads/main",
    url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
  },
  files: [
    {
      path: "/src/payments/retry.ts",
      diff: "@@ -1,2 +1,3 @@\n export function retry() {\n+  return true;\n }"
    }
  ]
};

export const sampleReview: ReviewResult = {
  summary: "Adds retry behavior for payments.",
  riskSummary: "Retry behavior can duplicate charges if idempotency is missing.",
  comments: [
    {
      id: "comment-1",
      filePath: "/src/payments/retry.ts",
      line: 2,
      severity: "critical",
      category: "risk",
      message: "Confirm the retry path is idempotent before charging again.",
      suggestion: "Use an idempotency key for each payment attempt."
    },
    {
      id: "comment-2",
      severity: "warning",
      category: "tests",
      message: "Add a test for retry exhaustion."
    }
  ]
};
