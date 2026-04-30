import { describe, expect, it } from "vitest";
import { GitClient } from "../src/git/client.js";

describe("GitClient", () => {
  it("reads the current branch", async () => {
    const calls: string[][] = [];
    const client = new GitClient({
      async execGit(args) {
        calls.push(args);
        return "feature/local-review\n";
      }
    });

    await expect(client.currentBranch()).resolves.toBe("feature/local-review");
    expect(calls).toEqual([["rev-parse", "--abbrev-ref", "HEAD"]]);
  });

  it("builds changed file diffs against a target branch", async () => {
    const calls: string[][] = [];
    const client = new GitClient({
      async execGit(args) {
        calls.push(args);
        if (args[0] === "diff" && args[1] === "--name-only") {
          return "src/app.ts\nREADME.md\n";
        }
        return `diff for ${args.at(-1)}\n`;
      }
    });

    const files = await client.changedFiles("origin/main");

    expect(files).toEqual([
      { path: "/src/app.ts", diff: "diff for src/app.ts\n" },
      { path: "/README.md", diff: "diff for README.md\n" }
    ]);
    expect(calls).toContainEqual(["diff", "--name-only", "origin/main...HEAD"]);
    expect(calls).toContainEqual(["diff", "--no-ext-diff", "--unified=200", "origin/main...HEAD", "--", "src/app.ts"]);
  });

  it("builds review diffs including uncommitted working tree changes", async () => {
    const calls: string[][] = [];
    const client = new GitClient({
      async execGit(args) {
        calls.push(args);
        if (args[0] === "merge-base") {
          return "base-sha\n";
        }
        if (args[0] === "diff" && args[1] === "--name-only") {
          return "src/app.ts\n";
        }
        return `diff from base for ${args.at(-1)}\n`;
      }
    });

    const files = await client.changedFilesIncludingWorkingTree("origin/main");

    expect(files).toEqual([{ path: "/src/app.ts", diff: "diff from base for src/app.ts\n" }]);
    expect(calls).toContainEqual(["merge-base", "origin/main", "HEAD"]);
    expect(calls).toContainEqual(["diff", "--name-only", "base-sha"]);
    expect(calls).toContainEqual(["diff", "--no-ext-diff", "--unified=200", "base-sha", "--", "src/app.ts"]);
  });

  it("runs git commands for committing and pushing the current branch", async () => {
    const calls: string[][] = [];
    const client = new GitClient({
      async execGit(args) {
        calls.push(args);
        if (args[0] === "status") {
          return " M src/app.ts\n";
        }
        if (args[0] === "remote") {
          return "ssh.dev.azure.com:v3/acme/Payments/api-service\n";
        }
        return "";
      }
    });

    await expect(client.hasWorkingTreeChanges()).resolves.toBe(true);
    await expect(client.remoteUrl("origin")).resolves.toBe("ssh.dev.azure.com:v3/acme/Payments/api-service");
    await client.stageAll();
    await client.commit("test: update app");
    await client.pushCurrentBranch("feature/retry");

    expect(calls).toContainEqual(["status", "--porcelain"]);
    expect(calls).toContainEqual(["remote", "get-url", "origin"]);
    expect(calls).toContainEqual(["add", "--all"]);
    expect(calls).toContainEqual(["commit", "-m", "test: update app"]);
    expect(calls).toContainEqual(["push", "--set-upstream", "origin", "feature/retry"]);
  });
});
