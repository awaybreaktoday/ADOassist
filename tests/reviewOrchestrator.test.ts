import { describe, expect, it } from "vitest";
import { reviewPullRequest } from "../src/review/orchestrator.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("reviewPullRequest", () => {
  it("passes PR context and rubric to the configured provider", async () => {
    const result = await reviewPullRequest({
      context: sampleContext,
      emphasis: ["general", "standards", "risk"],
      provider: {
        name: "mock",
        async reviewPullRequest(input) {
          expect(input.pullRequest).toEqual(sampleContext);
          expect(input.rubric).toContain("Correctness bugs and regressions");
          expect(input.rubric).toContain("Team standards");
          expect(input.rubric).toContain("PR description");
          expect(input.rubric).toContain("validation, tests, rollout, rollback");
          return sampleReview;
        }
      }
    });

    expect(result).toEqual(sampleReview);
  });

  it("rejects comments for files not in the PR", async () => {
    await expect(
      reviewPullRequest({
        context: sampleContext,
        emphasis: ["general"],
        provider: {
          name: "mock",
          async reviewPullRequest() {
            return {
              ...sampleReview,
              comments: [
                {
                  id: "bad",
                  filePath: "/src/other.ts",
                  line: 1,
                  severity: "warning",
                  category: "correctness",
                  message: "This file is not in the PR."
                }
              ]
            };
          }
        }
      })
    ).rejects.toThrow("Provider returned a comment for a file outside the PR");
  });

  it("does not let providers mutate PR context to bypass file validation", async () => {
    await expect(
      reviewPullRequest({
        context: sampleContext,
        emphasis: ["general"],
        provider: {
          name: "mock",
          async reviewPullRequest(input) {
            input.pullRequest.files.push({ path: "/src/other.ts", diff: "@@ fake @@" });
            return {
              ...sampleReview,
              comments: [
                {
                  id: "bad",
                  filePath: "/src/other.ts",
                  line: 1,
                  severity: "warning",
                  category: "correctness",
                  message: "This file is not in the original PR."
                }
              ]
            };
          }
        }
      })
    ).rejects.toThrow("Provider returned a comment for a file outside the PR");
  });

  it("rejects malformed provider output with the invalid field path", async () => {
    await expect(
      reviewPullRequest({
        context: sampleContext,
        emphasis: ["general"],
        provider: {
          name: "mock",
          async reviewPullRequest() {
            return {
              summary: " ",
              riskSummary: "",
              comments: "not comments"
            } as never;
          }
        }
      })
    ).rejects.toThrow("Provider returned an invalid review result: summary must be a non-empty string");
  });

  it("rejects inline comments without a positive line with the comment path", async () => {
    await expect(
      reviewPullRequest({
        context: sampleContext,
        emphasis: ["general"],
        provider: {
          name: "mock",
          async reviewPullRequest() {
            return {
              ...sampleReview,
              comments: [
                {
                  id: "bad",
                  filePath: "/src/payments/retry.ts",
                  severity: "warning",
                  category: "correctness",
                  message: "Missing a line."
                }
              ]
            };
          }
        }
      })
    ).rejects.toThrow("Provider returned an invalid review result: comments[0].line must be a positive integer when filePath is set");
  });
});
