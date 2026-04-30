import { describe, expect, it, vi } from "vitest";
import { AzureDevOpsClient } from "../src/azureDevOps/client.js";
import { sampleContext } from "./fixtures/sampleReview.js";

describe("AzureDevOpsClient", () => {
  it("uses basic auth with the PAT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Add payment retry",
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
});
