import { describe, expect, it, vi } from "vitest";
import { AzureDevOpsClient } from "../src/azureDevOps/client.js";
import { sampleContext } from "./fixtures/sampleReview.js";

describe("AzureDevOpsClient", () => {
  it("uses basic auth with the PAT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Add payment retry",
        description: "Adds retry support.",
        createdBy: { displayName: "A. Developer" },
        sourceRefName: "refs/heads/feature/retry",
        targetRefName: "refs/heads/main"
      })
    });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    await client.getPullRequestMetadata(sampleContext.ref);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from(":pat").toString("base64")}`
    );
  });

  it("includes the PR description in metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "feature removed",
        description: "feature removed",
        createdBy: { displayName: "A. Developer" },
        sourceRefName: "refs/heads/upgrade-test",
        targetRefName: "refs/heads/main"
      })
    });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    const metadata = await client.getPullRequestMetadata(sampleContext.ref);

    expect(metadata.description).toBe("feature removed");
  });

  it("lists active pull requests for a repository", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          {
            pullRequestId: 42,
            title: "Add payment retry",
            createdBy: { displayName: "A. Developer" },
            sourceRefName: "refs/heads/feature/retry",
            targetRefName: "refs/heads/main"
          }
        ]
      })
    });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    const pullRequests = await client.listActivePullRequests({
      organization: "acme",
      project: "Payments",
      repository: "api-service"
    });

    expect(pullRequests).toEqual([
      {
        ref: {
          organization: "acme",
          project: "Payments",
          repository: "api-service",
          pullRequestId: 42,
          url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
        },
        title: "Add payment retry",
        author: "A. Developer",
        sourceBranch: "refs/heads/feature/retry",
        targetBranch: "refs/heads/main"
      }
    ]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/acme/Payments/_apis/git/repositories/api-service/pullrequests");
    expect(url.searchParams.get("searchCriteria.status")).toBe("active");
    expect(url.searchParams.get("api-version")).toBe("7.1");
  });

  it("creates pull requests for a repository", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pullRequestId: 43
      })
    });
    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });

    const ref = await client.createPullRequest(
      {
        organization: "acme",
        project: "Payments",
        repository: "api-service"
      },
      {
        sourceRefName: "refs/heads/feature/retry",
        targetRefName: "refs/heads/main",
        title: "Add payment retry",
        description: "Adds retry behavior."
      }
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 43,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/43"
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/acme/Payments/_apis/git/repositories/api-service/pullrequests");
    expect(url.searchParams.get("api-version")).toBe("7.1");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      sourceRefName: "refs/heads/feature/retry",
      targetRefName: "refs/heads/main",
      title: "Add payment retry",
      description: "Adds retry behavior."
    });
  });

  it("posts approved comments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });

    await client.postComments(sampleContext.ref, [
      {
        id: "comment-1",
        filePath: "/src/payments/retry.ts",
        line: 2,
        severity: "critical",
        category: "risk",
        message: "Confirm idempotency."
      }
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.comments[0].content).toContain("Confirm idempotency.");
    expect(body.threadContext.filePath).toBe("/src/payments/retry.ts");
    expect(body.threadContext.rightFileStart.line).toBe(2);
  });

  it("fetches changed files and builds unified diffs from PR iteration content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 3,
              commonRefCommit: { commitId: "base-commit" },
              sourceRefCommit: { commitId: "head-commit" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changeEntries: [
            {
              changeType: "edit",
              item: { path: "/src/payments/retry.ts", gitObjectType: "blob" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "export function retry() {\n  return false;\n}\n" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "export function retry() {\n  return true;\n}\n" })
      });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    const files = await client.getChangedFiles(sampleContext.ref);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/src/payments/retry.ts");
    expect(files[0].diff).toContain("-  return false;");
    expect(files[0].diff).toContain("+  return true;");
  });

  it("fetches all pages of PR iteration changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 3,
              commonRefCommit: { commitId: "base-commit" },
              sourceRefCommit: { commitId: "head-commit" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nextSkip: 1,
          nextTop: 1,
          changeEntries: [
            {
              changeType: "edit",
              item: { path: "/src/one.ts", gitObjectType: "blob" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nextSkip: 0,
          nextTop: 0,
          changeEntries: [
            {
              changeType: "edit",
              item: { path: "/src/two.ts", gitObjectType: "blob" }
            }
          ]
        })
      })
      .mockResolvedValue({ ok: true, json: async () => ({ content: "text\n" }) });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    const files = await client.getChangedFiles(sampleContext.ref);

    expect(files.map((file) => file.path)).toEqual(["/src/one.ts", "/src/two.ts"]);
    const secondPageUrl = new URL(fetchMock.mock.calls[2][0]);
    expect(secondPageUrl.searchParams.get("$skip")).toBe("1");
    expect(secondPageUrl.searchParams.get("$top")).toBe("1");
  });

  it("skips deleted files until comment side metadata is supported", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 3,
              commonRefCommit: { commitId: "base-commit" },
              sourceRefCommit: { commitId: "head-commit" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changeEntries: [
            {
              changeType: "delete",
              item: { path: "/src/removed.ts", gitObjectType: "blob" }
            }
          ]
        })
      });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    await expect(client.getChangedFiles(sampleContext.ref)).resolves.toEqual([]);
  });

  it("skips binary files", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 3,
              commonRefCommit: { commitId: "base-commit" },
              sourceRefCommit: { commitId: "head-commit" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changeEntries: [
            {
              changeType: "edit",
              item: { path: "/assets/logo.png", gitObjectType: "blob" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "base64", contentMetadata: { isBinary: true } })
      });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    await expect(client.getChangedFiles(sampleContext.ref)).resolves.toEqual([]);
  });
});
