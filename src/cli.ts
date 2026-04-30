import { Command } from "commander";
import { AzureDevOpsClient } from "./azureDevOps/client.js";
import { loadAzureDevOpsConfigFromEnv, loadConfigFromEnv } from "./config.js";
import { postReviewDraftFile } from "./commands/post.js";
import { createReviewDraft } from "./commands/review.js";
import { createReviewProvider } from "./providers/factory.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version("0.1.0");

  program
    .command("review")
    .argument("<pr-url>")
    .action(async (prUrl: string) => {
      const config = loadConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
      const provider = createReviewProvider(config);
      const filename = await createReviewDraft({ prUrl, config, client, provider });
      console.log(`Review draft written to ${filename}`);
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
