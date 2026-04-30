import { describe, expect, it } from "vitest";
import { listOpenPullRequests, resolveLimit, resolveRepositoryRef, reviewOpenPullRequests } from "../src/commands/prs.js";
import type { AppConfig, PullRequestSummary } from "../src/types.js";

const baseConfig: AppConfig = {
  azureDevOps: {
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

const openPullRequests: PullRequestSummary[] = [
  {
    ref: {
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    },
    title: "Add retry",
    author: "A. Developer",
    sourceBranch: "refs/heads/feature/retry",
    targetBranch: "refs/heads/main"
  },
  {
    ref: {
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 43,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/43"
    },
    title: "Update docs",
    author: "B. Developer",
    sourceBranch: "refs/heads/docs",
    targetBranch: "refs/heads/main"
  }
];

describe("resolveRepositoryRef", () => {
  it("builds a repository ref from configured org and target options", () => {
    expect(resolveRepositoryRef({ project: "Payments", repo: "api-service" }, baseConfig)).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service"
    });
  });

  it("requires project and repo", () => {
    expect(() => resolveRepositoryRef({ project: "Payments" }, baseConfig)).toThrow(
      "PR discovery requires --project and --repo"
    );
  });

  it("requires a configured org", () => {
    expect(() => resolveRepositoryRef({ project: "Payments", repo: "api-service" }, {
      ...baseConfig,
      azureDevOps: { pat: "pat" }
    })).toThrow("ADO_ASSIST_AZURE_DEVOPS_ORG is required for PR discovery");
  });
});

describe("resolveLimit", () => {
  it("defaults to all pull requests", () => {
    expect(resolveLimit(undefined)).toBeUndefined();
  });

  it("accepts positive integer limits", () => {
    expect(resolveLimit("5")).toBe(5);
  });

  it("rejects invalid limits", () => {
    expect(() => resolveLimit("0")).toThrow("--limit must be a positive integer");
    expect(() => resolveLimit("1e3")).toThrow("--limit must be a positive integer");
  });
});

describe("listOpenPullRequests", () => {
  it("lists open PRs for the requested repository", async () => {
    const pullRequests = await listOpenPullRequests({
      target: { project: "Payments", repo: "api-service" },
      config: baseConfig,
      client: {
        async listActivePullRequests(repository) {
          expect(repository.repository).toBe("api-service");
          return openPullRequests;
        }
      }
    });

    expect(pullRequests.map((pr) => pr.ref.pullRequestId)).toEqual([42, 43]);
  });
});

describe("reviewOpenPullRequests", () => {
  it("creates review drafts for open PRs up to the limit", async () => {
    const reviewed: string[] = [];
    const filenames = await reviewOpenPullRequests({
      target: { project: "Payments", repo: "api-service" },
      config: baseConfig,
      mode: "quality",
      limit: 1,
      client: {
        async listActivePullRequests() {
          return openPullRequests;
        }
      },
      async createDraft(target, mode) {
        reviewed.push(target.prUrl ?? "");
        expect(mode).toBe("quality");
        return `reviews/pr-${target.prUrl?.split("/").at(-1)}.md`;
      }
    });

    expect(reviewed).toEqual(["https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"]);
    expect(filenames).toEqual(["reviews/pr-42.md"]);
  });
});
