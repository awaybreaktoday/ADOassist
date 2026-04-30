import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export class GitClient {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    async currentBranch() {
        return (await this.execGit(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    }
    async changedFiles(targetBranch) {
        const range = `${targetBranch}...HEAD`;
        const names = (await this.execGit(["diff", "--name-only", range]))
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const files = [];
        for (const name of names) {
            const diff = await this.execGit(["diff", "--no-ext-diff", "--unified=200", range, "--", name]);
            files.push({ path: `/${name}`, diff });
        }
        return files;
    }
    async execGit(args) {
        if (this.options.execGit) {
            return this.options.execGit(args);
        }
        const result = await execFileAsync("git", args);
        return result.stdout;
    }
}
