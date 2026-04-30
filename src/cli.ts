import { Command } from "commander";
import { AzureDevOpsClient } from "./azureDevOps/client.js";
import { loadAzureDevOpsConfigFromEnv, loadConfigFromEnv } from "./config.js";
import { createLocalReviewDraft } from "./commands/local.js";
import { postReviewDraftFile } from "./commands/post.js";
import { listOpenPullRequests, resolveLimit, reviewOpenPullRequests } from "./commands/prs.js";
import { createReviewDraft, resolveReviewMode } from "./commands/review.js";
import { GitClient } from "./git/client.js";
import { createReviewProvider } from "./providers/factory.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version("0.1.0");

  program
    .command("review")
    .argument("[pr-url]")
    .option("--project <project>")
    .option("--repo <repo>")
    .option("--pr <pull-request-id>")
    .option("--mode <mode>", "review mode: full, code, quality, or risk")
    .option("--output <dir>", "directory for generated review drafts")
    .action(
      async (
        prUrl: string | undefined,
        options: { project?: string; repo?: string; pr?: string; mode?: string; output?: string }
      ) => {
        const config = loadConfigFromEnv();
        const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
        const provider = createReviewProvider(config);
        const filename = await createReviewDraft({
          target: { prUrl, project: options.project, repo: options.repo, pr: options.pr },
          mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
          outputDir: options.output,
          config,
          client,
          provider
        });
        console.log(`Review draft written to ${filename}`);
      }
    );

  program
    .command("review-local")
    .description("Review local branch changes against a target branch and draft a suggested PR")
    .option("--target <branch>", "target branch to compare against", "origin/main")
    .option("--mode <mode>", "review mode: full, code, quality, or risk")
    .option("--output <dir>", "directory for generated review drafts")
    .action(async (options: { target: string; mode?: string; output?: string }) => {
      const config = loadConfigFromEnv();
      const provider = createReviewProvider(config);
      const git = new GitClient();
      const filename = await createLocalReviewDraft({
        targetBranch: options.target,
        mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
        outputDir: options.output,
        config,
        git,
        provider
      });
      console.log(`Local review draft written to ${filename}`);
    });

  program
    .command("prs")
    .description("List active Azure DevOps pull requests for a repository")
    .requiredOption("--project <project>")
    .requiredOption("--repo <repo>")
    .action(async (options: { project: string; repo: string }) => {
      const azureDevOps = loadAzureDevOpsConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: azureDevOps.pat });
      const pullRequests = await listOpenPullRequests({
        target: { project: options.project, repo: options.repo },
        config: { azureDevOps },
        client
      });

      if (pullRequests.length === 0) {
        console.log("No active pull requests found.");
        return;
      }

      for (const pullRequest of pullRequests) {
        console.log(
          `#${pullRequest.ref.pullRequestId} ${pullRequest.title} (${pullRequest.author}) ${pullRequest.sourceBranch} -> ${pullRequest.targetBranch}`
        );
        console.log(`  ${pullRequest.ref.url}`);
      }
    });

  program
    .command("review-open")
    .description("Create review drafts for active Azure DevOps pull requests in a repository")
    .requiredOption("--project <project>")
    .requiredOption("--repo <repo>")
    .option("--mode <mode>", "review mode: full, code, quality, or risk")
    .option("--limit <count>", "maximum number of open pull requests to review")
    .option("--output <dir>", "directory for generated review drafts")
    .action(async (options: { project: string; repo: string; mode?: string; limit?: string; output?: string }) => {
      const config = loadConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
      const provider = createReviewProvider(config);
      const filenames = await reviewOpenPullRequests({
        target: { project: options.project, repo: options.repo },
        mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
        limit: resolveLimit(options.limit),
        outputDir: options.output,
        config,
        client,
        provider
      });

      if (filenames.length === 0) {
        console.log("No active pull requests found.");
        return;
      }

      for (const filename of filenames) {
        console.log(`Review draft written to ${filename}`);
      }
    });

  program
    .command("post")
    .argument("<review-file>")
    .action(async (reviewFile: string) => {
      const azureDevOps = loadAzureDevOpsConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: azureDevOps.pat });
      const count = await postReviewDraftFile(reviewFile, client);
      console.log(`Posted ${count} approved comment${count === 1 ? "" : "s"}`);
    });

  return program;
}
