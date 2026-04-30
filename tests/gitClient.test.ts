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
});
