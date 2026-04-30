import { Command } from "commander";
import { AzureDevOpsClient } from "./azureDevOps/client.js";
import { runConfigSetup } from "./commands/configSetup.js";
import { defaultUserConfigPath, initUserConfig, loadAzureDevOpsConfigFromFileAndEnv, loadConfigFromFileAndEnv, loadUserConfigFile } from "./config.js";
import { createLocalReviewDraft } from "./commands/local.js";
import { postReviewDraftFile } from "./commands/post.js";
import { listOpenPullRequests, resolveLimit, reviewOpenPullRequests } from "./commands/prs.js";
import { createReviewDraft, resolveReviewMode } from "./commands/review.js";
import { GitClient } from "./git/client.js";
import { createReviewProvider } from "./providers/factory.js";
export function createCli() {
    const program = new Command();
    program
        .name("ado-assist")
        .description("Draft and post AI-assisted Azure DevOps PR review comments")
        .version("0.1.0")
        .option("--config <file>", "path to the user config file");
    const selectedConfigPath = () => {
        const options = program.opts();
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
        .action(async (prUrl, options) => {
        const config = await loadConfigFromFileAndEnv(selectedConfigPath());
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
    });
    program
        .command("review-local")
        .description("Review local branch changes against a target branch and draft a suggested PR")
        .option("--target <branch>", "target branch to compare against", "origin/main")
        .option("--mode <mode>", "review mode: full, code, quality, or risk")
        .option("--output <dir>", "directory for generated review drafts")
        .action(async (options) => {
        const config = await loadConfigFromFileAndEnv(selectedConfigPath());
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
        .action(async (options) => {
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
            console.log(`#${pullRequest.ref.pullRequestId} ${pullRequest.title} (${pullRequest.author}) ${pullRequest.sourceBranch} -> ${pullRequest.targetBranch}`);
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
        .action(async (options) => {
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
        .action(async (reviewFile) => {
        const azureDevOps = await loadAzureDevOpsConfigFromFileAndEnv(selectedConfigPath());
        const client = new AzureDevOpsClient({ pat: azureDevOps.pat });
        const count = await postReviewDraftFile(reviewFile, client);
        console.log(`Posted ${count} approved comment${count === 1 ? "" : "s"}`);
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
