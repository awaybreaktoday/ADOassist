import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalReviewDraft, localReviewDraftFilename } from "../src/commands/local.js";
import type { AppConfig } from "../src/types.js";
import { sampleReview } from "./fixtures/sampleReview.js";

const baseConfig: AppConfig = {
  azureDevOps: { pat: "pat" },
  provider: { kind: "openai", apiKey: "key", model: "gpt-4.1" },
  reviewEmphasis: ["general", "standards", "quality", "risk"]
};

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("localReviewDraftFilename", () => {
  it("encodes local branch and target names", () => {
    expect(localReviewDraftFilename("feature/aks-upgrade", "origin/main")).toBe(
      "reviews/local-feature%2Faks-upgrade-to-origin%2Fmain.md"
    );
  });
});

describe("createLocalReviewDraft", () => {
  it("reviews local branch changes and writes a pre-PR draft", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-local-"));
    const filename = await createLocalReviewDraft({
      targetBranch: "origin/main",
      outputDir: tempDir,
      mode: "quality",
      config: baseConfig,
      git: {
        async currentBranch() {
          return "feature/aks-upgrade";
        },
        async changedFiles(targetBranch) {
          expect(targetBranch).toBe("origin/main");
          return [{ path: "/aks/dev/main.tf", diff: "@@ -1 +1 @@\n-old\n+new\n" }];
        }
      },
      provider: {
        name: "mock",
        async reviewPullRequest(input) {
          expect(input.pullRequest.metadata.sourceBranch).toBe("feature/aks-upgrade");
          expect(input.pullRequest.metadata.targetBranch).toBe("origin/main");
          expect(input.pullRequest.files[0].path).toBe("/aks/dev/main.tf");
          expect(input.rubric).toContain("Mode: quality");
          return sampleReview;
        }
      }
    });

    const markdown = await readFile(filename, "utf8");
    expect(filename).toContain("local-feature%2Faks-upgrade-to-origin%2Fmain.md");
    expect(markdown).toContain("# ADO Assist Local Review Draft");
    expect(markdown).toContain("## Suggested PR");
    expect(markdown).toContain("### Title");
    expect(markdown).toContain("### Description");
    expect(markdown).toContain("Adds retry behavior for payments.");
  });

  it("rejects local reviews with no changed files", async () => {
    await expect(
      createLocalReviewDraft({
        targetBranch: "origin/main",
        config: baseConfig,
        git: {
          async currentBranch() {
            return "feature/empty";
          },
          async changedFiles() {
            return [];
          }
        },
        provider: {
          name: "mock",
          async reviewPullRequest() {
            return sampleReview;
          }
        }
      })
    ).rejects.toThrow("No local changes found against origin/main");
  });
});
