import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createReviewDraft, resolvePullRequestRef, resolveReviewMode } from "../src/commands/review.js";
import { AppError } from "../src/errors.js";
import type { AppConfig } from "../src/types.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

const baseConfig: AppConfig = {
  azureDevOps: {
    authMode: "pat",
    token: "pat",
    pat: "pat",
    organization: "acme"
  },
  provider: {
    kind: "openai",
    apiKey: "key",
    model: "gpt-4.1"
  },
  reviewEmphasis: ["general"]
};

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("createReviewDraft", () => {
  it("writes PR review drafts to the selected output directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-review-"));
    const filename = await createReviewDraft({
      target: {
        prUrl: sampleContext.ref.url
      },
      outputDir: tempDir,
      config: baseConfig,
      client: {
        async getPullRequestMetadata() {
          return sampleContext.metadata;
        },
        async getChangedFiles() {
          return sampleContext.files;
        }
      },
      provider: {
        name: "mock",
        async reviewPullRequest() {
          return sampleReview;
        }
      }
    });

    expect(filename).toContain(tempDir);
    await expect(readFile(filename, "utf8")).resolves.toContain("# ADO Assist Review Draft");
  });

  it("continues without docs when auto-detection misses and doc checks are optional", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-review-"));
    const filename = await createReviewDraft({
      target: {
        prUrl: sampleContext.ref.url
      },
      outputDir: tempDir,
      checkDocs: "azure",
      checkDocsOptional: true,
      config: baseConfig,
      client: {
        async getPullRequestMetadata() {
          return sampleContext.metadata;
        },
        async getChangedFiles() {
          return [{ path: "/entra-groups/prd/main.tf", diff: '+resource "azuread_group" "this" {' }];
        }
      },
      docChecker: async () => {
        throw new AppError(
          "Could not detect a supported Azure doc profile from the PR context. Use --check-docs azure-aks for AKS changes."
        );
      },
      provider: {
        name: "mock",
        async reviewPullRequest(input) {
          expect(input.docEvidence).toBeUndefined();
          return { ...sampleReview, comments: [] };
        }
      }
    });

    await expect(readFile(filename, "utf8")).resolves.not.toContain("## Factual Checks");
  });
});

describe("resolvePullRequestRef", () => {
  it("keeps supporting full PR URLs", () => {
    const ref = resolvePullRequestRef(
      {
        prUrl: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
      },
      baseConfig
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("builds a PR ref from project, repo, and PR id using the configured org", () => {
    const ref = resolvePullRequestRef(
      {
        project: "Payments",
        repo: "api-service",
        pr: "42"
      },
      baseConfig
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("URL-encodes shorthand project and repo values", () => {
    const ref = resolvePullRequestRef(
      {
        project: "Customer Payments",
        repo: "api/service",
        pr: 42
      },
      baseConfig
    );

    expect(ref.url).toBe("https://dev.azure.com/acme/Customer%20Payments/_git/api%2Fservice/pullrequest/42");
    expect(ref.project).toBe("Customer Payments");
    expect(ref.repository).toBe("api/service");
  });

  it("requires a configured org when no PR URL is provided", () => {
    expect(() =>
      resolvePullRequestRef(
        {
          project: "Payments",
          repo: "api-service",
          pr: "42"
        },
        {
          ...baseConfig,
          azureDevOps: { authMode: "pat", token: "pat", pat: "pat" }
        }
      )
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_ORG is required when reviewing without a PR URL");
  });

  it("requires project, repo, and PR id when no PR URL is provided", () => {
    expect(() => resolvePullRequestRef({ project: "Payments", pr: "42" }, baseConfig)).toThrow(
      "review without a PR URL requires --project, --repo, and --pr"
    );
  });

  it("rejects non-decimal shorthand PR ids", () => {
    expect(() =>
      resolvePullRequestRef(
        {
          project: "Payments",
          repo: "api-service",
          pr: "1e3"
        },
        baseConfig
      )
    ).toThrow("Pull request id must be numeric");
  });
});

describe("resolveReviewMode", () => {
  it("defaults to full mode", () => {
    expect(resolveReviewMode(undefined)).toBe("full");
  });

  it("accepts supported modes", () => {
    expect(resolveReviewMode("code")).toBe("code");
    expect(resolveReviewMode("quality")).toBe("quality");
    expect(resolveReviewMode("risk")).toBe("risk");
    expect(resolveReviewMode("full")).toBe("full");
  });

  it("rejects unsupported modes", () => {
    expect(() => resolveReviewMode("quick")).toThrow(
      "--mode must be one of: full, code, quality, risk"
    );
  });
});
