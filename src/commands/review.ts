import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AzureDevOpsClient } from "../azureDevOps/client.js";
import { parsePullRequestUrl } from "../azureDevOps/url.js";
import { formatReviewDraft, reviewDraftFilename } from "../drafts/format.js";
import type { ReviewProvider } from "../providers/types.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import type { AppConfig } from "../types.js";

export interface ReviewCommandOptions {
  prUrl: string;
  config: AppConfig;
  client: AzureDevOpsClient;
  provider: ReviewProvider;
}

export async function createReviewDraft(options: ReviewCommandOptions): Promise<string> {
  const ref = parsePullRequestUrl(options.prUrl);
  const metadata = await options.client.getPullRequestMetadata(ref);
  const files = await options.client.getChangedFiles(ref);
  const context = { ref, metadata, files };
  const review = await reviewPullRequest({
    context,
    emphasis: options.config.reviewEmphasis,
    provider: options.provider
  });
  const markdown = formatReviewDraft(context, review);
  const filename = reviewDraftFilename(context);

  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, markdown, "utf8");
  return filename;
}
