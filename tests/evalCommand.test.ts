import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runProviderEval } from "../src/commands/evaluate.js";
import { AppError } from "../src/errors.js";
import type { AppConfig, ProviderConfig, ReviewResult } from "../src/types.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function configForProvider(provider: ProviderConfig): AppConfig {
  return {
    azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
    provider,
    reviewEmphasis: ["general", "standards", "quality", "risk"]
  };
}

describe("runProviderEval", () => {
  it("runs selected providers, writes drafts, and summarizes comparison markers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-eval-"));
    let now = 1000;
    let docCheckCount = 0;

    const result = await runProviderEval({
      targetBranch: "origin/main",
      outputDir: tempDir,
      mode: "full",
      checkDocs: "azure",
      providerKinds: ["openai", "anthropic"],
      expectedTerms: ["missing quote", "invalid CIDR"],
      now: () => {
        now += 125;
        return now;
      },
      configForProvider(kind) {
        if (kind === "openai") {
          return configForProvider({ kind: "openai", apiKey: "key", model: "gpt-5.4" });
        }

        return configForProvider({ kind: "anthropic", apiKey: "key", model: "claude-opus-4-7", maxTokens: 4096 });
      },
      git: {
        async currentBranch() {
          return "feature/infra";
        },
        async changedFilesIncludingWorkingTree() {
          return [
            {
              path: "/aks/dev/vars/westeurope.tfvars",
              diff: "@@ -1 +1 @@\n-os_disk_type = \"Ephemeral\"\n+os_disk_type = \"Ephemerals\n"
            }
          ];
        },
        async hasWorkingTreeChanges() {
          return true;
        },
        async remoteUrl() {
          return "ssh.dev.azure.com:v3/acme/Payments/api-service";
        },
        async stageAll() {
          throw new Error("eval should not stage files");
        },
        async commit() {
          throw new Error("eval should not commit");
        },
        async pushCurrentBranch() {
          throw new Error("eval should not push");
        }
      },
      client: {
        async createPullRequest() {
          throw new Error("eval should not create PRs");
        }
      },
      docChecker: async (profile) => {
        docCheckCount += 1;
        return {
          profile,
          checkedAt: "2026-05-05T12:00:00.000Z",
          sources: [{ title: "AKS upgrade", url: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster" }],
          facts: [{ text: "AKS sourced fact.", sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster" }]
        };
      },
      providerFactory(config) {
        return {
          name: `${config.provider.kind}:model`,
          async reviewPullRequest(): Promise<ReviewResult> {
            return {
              summary: `${config.provider.kind} saw missing quote and invalid CIDR risk.`,
              riskSummary: "High risk.",
              suggestedTitle: `${config.provider.kind} update infra values`,
              suggestedDescription: "## Summary\nUpdate infra.\n\n## Validation\nConfirm plan.\n\n## Risk / Impact\nHigh.\n\n## Rollback\nRevert.",
              suggestedCommitMessage: `chore: ${config.provider.kind} update infra values`,
              comments: [
                {
                  id: "1",
                  severity: "critical",
                  category: "correctness",
                  filePath: "/aks/dev/vars/westeurope.tfvars",
                  line: 1,
                  message: "The value has a missing quote and invalid CIDR wording for marker detection."
                }
              ]
            };
          }
        };
      }
    });

    expect(result.results).toHaveLength(2);
    expect(result.results.every((entry) => entry.status === "success")).toBe(true);
    expect(docCheckCount).toBe(1);

    const summary = await readFile(result.summaryFile, "utf8");
    expect(summary).toContain("| openai:gpt-5.4 | success | 125ms | 1 | 0 | 0 |");
    expect(summary).toContain("| anthropic:claude-opus-4-7 | success | 125ms | 1 | 0 | 0 |");
    expect(summary).toContain("| openai:gpt-5.4 | yes | yes |");
    expect(summary).toContain("| anthropic:claude-opus-4-7 | yes | yes |");
  });

  it("records provider setup failures and continues evaluating other providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-eval-"));

    const result = await runProviderEval({
      targetBranch: "origin/main",
      outputDir: tempDir,
      providerKinds: ["openai", "gemini"],
      now: () => 1000,
      configForProvider(kind) {
        if (kind === "gemini") {
          throw new Error("ADO_ASSIST_GEMINI_API_KEY is required");
        }

        return configForProvider({ kind: "openai", apiKey: "key", model: "gpt-5.4" });
      },
      git: {
        async currentBranch() {
          return "feature/infra";
        },
        async changedFilesIncludingWorkingTree() {
          return [{ path: "/README.md", diff: "+hello" }];
        },
        async hasWorkingTreeChanges() {
          return true;
        },
        async remoteUrl() {
          return "ssh.dev.azure.com:v3/acme/Payments/api-service";
        },
        async stageAll() {
          throw new Error("eval should not stage files");
        },
        async commit() {
          throw new Error("eval should not commit");
        },
        async pushCurrentBranch() {
          throw new Error("eval should not push");
        }
      },
      client: {
        async createPullRequest() {
          throw new Error("eval should not create PRs");
        }
      },
      providerFactory(config) {
        return {
          name: `${config.provider.kind}:model`,
          async reviewPullRequest(): Promise<ReviewResult> {
            return {
              summary: "Updated README.",
              riskSummary: "Low risk.",
              suggestedTitle: "Update README",
              suggestedDescription: "Summary:\nUpdate README.\n\nRisk:\nLow.",
              suggestedCommitMessage: "docs: update readme",
              comments: []
            };
          }
        };
      }
    });

    expect(result.results.map((entry) => [entry.provider, entry.status])).toEqual([
      ["openai:gpt-5.4", "success"],
      ["gemini", "failed"]
    ]);

    const summary = await readFile(result.summaryFile, "utf8");
    expect(summary).toContain("ADO_ASSIST_GEMINI_API_KEY is required");
  });

  it("continues provider eval without docs when auto-detection misses and doc checks are optional", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-eval-"));

    const result = await runProviderEval({
      targetBranch: "origin/main",
      outputDir: tempDir,
      checkDocs: "azure",
      checkDocsOptional: true,
      providerKinds: ["openai"],
      now: () => 1000,
      configForProvider() {
        return configForProvider({ kind: "openai", apiKey: "key", model: "gpt-5.4" });
      },
      git: {
        async currentBranch() {
          return "feature/entra";
        },
        async changedFilesIncludingWorkingTree() {
          return [{ path: "/entra-groups/prd/main.tf", diff: '+resource "azuread_group" "this" {' }];
        },
        async hasWorkingTreeChanges() {
          return true;
        },
        async remoteUrl() {
          return "ssh.dev.azure.com:v3/acme/Entra/iac-platform-entra-groups";
        },
        async stageAll() {
          throw new Error("eval should not stage files");
        },
        async commit() {
          throw new Error("eval should not commit");
        },
        async pushCurrentBranch() {
          throw new Error("eval should not push");
        }
      },
      client: {
        async createPullRequest() {
          throw new Error("eval should not create PRs");
        }
      },
      docChecker: async () => {
        throw new AppError(
          "Could not detect a supported Azure doc profile from the PR context. Use --check-docs azure-aks for AKS changes."
        );
      },
      providerFactory(config) {
        return {
          name: `${config.provider.kind}:model`,
          async reviewPullRequest(input): Promise<ReviewResult> {
            expect(input.docEvidence).toBeUndefined();
            return {
              summary: "Updated Entra groups.",
              riskSummary: "Low risk.",
              suggestedTitle: "Update Entra groups",
              suggestedDescription: "Summary:\nUpdate Entra groups.",
              suggestedCommitMessage: "chore: update entra groups",
              comments: []
            };
          }
        };
      }
    });

    expect(result.results[0]).toMatchObject({ provider: "openai:gpt-5.4", status: "success" });
    const summary = await readFile(result.summaryFile, "utf8");
    expect(summary).toContain("- Check docs: azure");
  });
});
