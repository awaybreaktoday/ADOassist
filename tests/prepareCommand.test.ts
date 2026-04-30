import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  preparePullRequest,
  resolveRepositoryRefFromRemote,
  targetBranchNameFromRef
} from "../src/commands/prepare.js";
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

describe("resolveRepositoryRefFromRemote", () => {
  it("parses Azure DevOps SSH remotes", () => {
    expect(resolveRepositoryRefFromRemote("ssh.dev.azure.com:v3/acme/Payments/api-service")).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service"
    });
  });

  it("parses Azure DevOps HTTPS remotes", () => {
    expect(resolveRepositoryRefFromRemote("https://dev.azure.com/acme/Payments/_git/api-service")).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service"
    });
  });
});

describe("targetBranchNameFromRef", () => {
  it("converts common target branch refs to branch names", () => {
    expect(targetBranchNameFromRef("origin/main")).toBe("main");
    expect(targetBranchNameFromRef("refs/heads/release")).toBe("release");
    expect(targetBranchNameFromRef("main")).toBe("main");
  });
});

describe("preparePullRequest", () => {
  it("dry-runs a branch review and reports the planned PR actions", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-prepare-"));

    const result = await preparePullRequest({
      targetBranch: "origin/main",
      outputDir: tempDir,
      mode: "full",
      apply: false,
      config: baseConfig,
      git: {
        async currentBranch() {
          return "feature/retry";
        },
        async changedFilesIncludingWorkingTree() {
          return [{ path: "/src/payments/retry.ts", diff: "@@ -1 +1 @@\n-old\n+new\n" }];
        },
        async hasWorkingTreeChanges() {
          return true;
        },
        async remoteUrl() {
          return "ssh.dev.azure.com:v3/acme/Payments/api-service";
        },
        async stageAll() {
          throw new Error("dry-run should not stage files");
        },
        async commit() {
          throw new Error("dry-run should not commit");
        },
        async pushCurrentBranch() {
          throw new Error("dry-run should not push");
        }
      },
      client: {
        async createPullRequest() {
          throw new Error("dry-run should not create a PR");
        }
      },
      provider: {
        name: "mock",
        async reviewPullRequest(input) {
          expect(input.pullRequest.metadata.sourceBranch).toBe("feature/retry");
          expect(input.pullRequest.metadata.targetBranch).toBe("origin/main");
          return {
            ...sampleReview,
            suggestedTitle: "Add payment retry",
            suggestedDescription: "Adds retry behavior and validates risk.",
            suggestedCommitMessage: "payments: add retry behavior"
          };
        }
      }
    });

    expect(result.applied).toBe(false);
    expect(result.pullRequestUrl).toBeUndefined();
    expect(result.repository).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service"
    });
    expect(result.title).toBe("Add payment retry");
    expect(result.description).toBe("Adds retry behavior and validates risk.");
    expect(result.commitMessage).toBe("payments: add retry behavior");
    await expect(readFile(result.draftFile, "utf8")).resolves.toContain("Add payment retry");
  });

  it("stages, commits, pushes, and creates a pull request when apply is enabled", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-prepare-"));
    const actions: string[] = [];

    const result = await preparePullRequest({
      targetBranch: "origin/main",
      outputDir: tempDir,
      apply: true,
      config: baseConfig,
      git: {
        async currentBranch() {
          return "feature/retry";
        },
        async changedFilesIncludingWorkingTree() {
          return [{ path: "/src/payments/retry.ts", diff: "@@ -1 +1 @@\n-old\n+new\n" }];
        },
        async hasWorkingTreeChanges() {
          return true;
        },
        async remoteUrl() {
          return "ssh.dev.azure.com:v3/acme/Payments/api-service";
        },
        async stageAll() {
          actions.push("stage");
        },
        async commit(message) {
          actions.push(`commit:${message}`);
        },
        async pushCurrentBranch(branch) {
          actions.push(`push:${branch}`);
        }
      },
      client: {
        async createPullRequest(repository, request) {
          actions.push(`pr:${request.sourceRefName}->${request.targetRefName}`);
          expect(repository.repository).toBe("api-service");
          expect(request.title).toBe("Add payment retry");
          return {
            ...repository,
            pullRequestId: 43,
            url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/43"
          };
        }
      },
      provider: {
        name: "mock",
        async reviewPullRequest() {
          return {
            ...sampleReview,
            suggestedTitle: "Add payment retry",
            suggestedDescription: "Adds retry behavior and validates risk.",
            suggestedCommitMessage: "payments: add retry behavior"
          };
        }
      }
    });

    expect(actions).toEqual([
      "stage",
      "commit:payments: add retry behavior",
      "push:feature/retry",
      "pr:refs/heads/feature/retry->refs/heads/main"
    ]);
    expect(result.applied).toBe(true);
    expect(result.pullRequestUrl).toBe("https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/43");
  });
});
