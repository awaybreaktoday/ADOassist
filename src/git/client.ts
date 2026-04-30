import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile } from "../types.js";

const execFileAsync = promisify(execFile);

export interface GitClientOptions {
  execGit?: (args: string[]) => Promise<string>;
}

export class GitClient {
  constructor(private readonly options: GitClientOptions = {}) {}

  async currentBranch(): Promise<string> {
    return (await this.execGit(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  }

  async changedFiles(targetBranch: string): Promise<ChangedFile[]> {
    const range = `${targetBranch}...HEAD`;
    const names = (await this.execGit(["diff", "--name-only", range]))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const files: ChangedFile[] = [];
    for (const name of names) {
      const diff = await this.execGit(["diff", "--no-ext-diff", "--unified=200", range, "--", name]);
      files.push({ path: `/${name}`, diff });
    }

    return files;
  }

  private async execGit(args: string[]): Promise<string> {
    if (this.options.execGit) {
      return this.options.execGit(args);
    }

    const result = await execFileAsync("git", args);
    return result.stdout;
  }
}
