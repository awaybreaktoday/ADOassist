import { createRequire } from "node:module";
import { Command } from "commander";
import { AzureDevOpsClient } from "./azureDevOps/client.js";
import { runConfigSetup } from "./commands/configSetup.js";
import {
  defaultUserConfigPath,
  initUserConfig,
  loadAzureDevOpsConfigFromFileAndEnv,
  loadConfigFromFileAndEnv,
  loadUserConfigFile
} from "./config.js";
import { resolveDocCheckProfile } from "./docs/check.js";
import { createLocalReviewDraft } from "./commands/local.js";
import { postReviewDraftFile } from "./commands/post.js";
import { preparePullRequest } from "./commands/prepare.js";
import { listOpenPullRequests, resolveLimit, reviewOpenPullRequests } from "./commands/prs.js";
import { createReviewDraft, resolveReviewMode } from "./commands/review.js";
import { GitClient } from "./git/client.js";
import { createReviewProvider } from "./providers/factory.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version(packageJson.version)
    .option("--config <file>", "path to the user config file");

  const selectedConfigPath = (): string => {
    const options = program.opts<{ config?: string }>();
    return options.config ?? defaultUserConfigPath();
  };

  program
    .command("review")
    .argument("[pr-url]")
    .option("--project <project>")
    .option("--repo <repo>")
    .option("--pr <pull-request-id>")
    .option("--mode <mode>", "review mode: full, code, quality, or risk")
    .option("--output <dir>", "directory for generated review drafts")
    .option("--check-docs [profile]", "fetch trusted docs and add sourced factual checks: azure or azure-aks")
    .action(
      async (
        prUrl: string | undefined,
        options: { project?: string; repo?: string; pr?: string; mode?: string; output?: string; checkDocs?: string | boolean }
      ) => {
        const config = await loadConfigFromFileAndEnv(selectedConfigPath());
        const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
        const provider = createReviewProvider(config);
        const filename = await createReviewDraft({
          target: { prUrl, project: options.project, repo: options.repo, pr: options.pr },
          mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
          outputDir: options.output,
          checkDocs: resolveDocCheckProfile(options.checkDocs),
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
    .option("--check-docs [profile]", "fetch trusted docs and add sourced factual checks: azure or azure-aks")
    .action(async (options: { target: string; mode?: string; output?: string; checkDocs?: string | boolean }) => {
      const config = await loadConfigFromFileAndEnv(selectedConfigPath());
      const provider = createReviewProvider(config);
      const git = new GitClient();
      const filename = await createLocalReviewDraft({
        targetBranch: options.target,
        mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
        outputDir: options.output,
        checkDocs: resolveDocCheckProfile(options.checkDocs),
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
      const azureDevOps = await loadAzureDevOpsConfigFromFileAndEnv(selectedConfigPath());
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
      const config = await loadConfigFromFileAndEnv(selectedConfigPath());
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
      const azureDevOps = await loadAzureDevOpsConfigFromFileAndEnv(selectedConfigPath());
      const client = new AzureDevOpsClient({ pat: azureDevOps.pat });
      const count = await postReviewDraftFile(reviewFile, client);
      console.log(`Posted ${count} approved comment${count === 1 ? "" : "s"}`);
    });

  const pr = program.command("pr").description("Prepare and create Azure DevOps pull requests");

  pr.command("prepare")
    .description("Review local changes, draft PR text, and optionally commit, push, and create the PR")
    .option("--target <branch>", "target branch to compare against", "origin/main")
    .option("--mode <mode>", "review mode: full, code, quality, or risk")
    .option("--output <dir>", "directory for generated review drafts")
    .option("--apply", "stage, commit, push, and create the Azure DevOps PR")
    .option("--check-docs [profile]", "fetch trusted docs and add sourced factual checks: azure or azure-aks")
    .action(async (options: { target: string; mode?: string; output?: string; apply?: boolean; checkDocs?: string | boolean }) => {
      const config = await loadConfigFromFileAndEnv(selectedConfigPath());
      const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
      const provider = createReviewProvider(config);
      const git = new GitClient();
      const result = await preparePullRequest({
        targetBranch: options.target,
        mode: options.mode === undefined ? undefined : resolveReviewMode(options.mode),
        outputDir: options.output,
        apply: options.apply === true,
        checkDocs: resolveDocCheckProfile(options.checkDocs),
        config,
        git,
        client,
        provider
      });

      console.log(`Review draft written to ${result.draftFile}`);
      console.log(`Repository: ${result.repository.organization}/${result.repository.project}/${result.repository.repository}`);
      console.log(`Commit message: ${result.commitMessage}`);
      console.log(`PR title: ${result.title}`);

      if (result.applied) {
        console.log(result.commitCreated ? "Committed local changes." : "No local working tree changes to commit.");
        console.log(`Pushed ${result.sourceBranch}.`);
        console.log(`Pull request created: ${result.pullRequestUrl}`);
      } else {
        console.log("Dry run only. Re-run with --apply to stage, commit, push, and create the pull request.");
      }
    });

  const config = program.command("config").description("Manage ADO Assist user configuration");

  config
    .command("path")
    .description("Print the active user config file path")
    .action(() => {
      console.log(selectedConfigPath());
    });

  config
    .command("init")
    .description("Create a sample non-secret user config file")
    .action(async () => {
      const filename = await initUserConfig(selectedConfigPath());
      console.log(`Config written to ${filename}`);
    });

  config
    .command("setup")
    .description("Interactively create or update the non-secret user config file")
    .action(async () => {
      const filename = await runConfigSetup(selectedConfigPath());
      console.log(`Config written to ${filename}`);
      console.log("Keep ADO_ASSIST_AZURE_DEVOPS_PAT and provider API keys in environment variables.");
    });

  config
    .command("show")
    .description("Print the non-secret user config file contents")
    .action(async () => {
      const filename = selectedConfigPath();
      const userConfig = await loadUserConfigFile(filename);
      console.log(JSON.stringify({ path: filename, config: userConfig }, null, 2));
    });

  return program;
}
