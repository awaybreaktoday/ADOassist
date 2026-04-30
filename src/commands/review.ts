import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AzureDevOpsClient } from "../azureDevOps/client.js";
import { parsePullRequestUrl } from "../azureDevOps/url.js";
import { formatReviewDraft, reviewDraftFilename } from "../drafts/format.js";
import { AppError } from "../errors.js";
import type { ReviewProvider } from "../providers/types.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import { reviewEmphasisForMode } from "../review/rubric.js";
import type { AppConfig, PullRequestRef, ReviewMode } from "../types.js";

export interface ReviewTargetOptions {
  prUrl?: string;
  project?: string;
  repo?: string;
  pr?: string | number;
}

export interface ReviewCommandOptions {
  target: ReviewTargetOptions;
  mode?: ReviewMode;
  config: AppConfig;
  client: AzureDevOpsClient;
  provider: ReviewProvider;
}

export async function createReviewDraft(options: ReviewCommandOptions): Promise<string> {
  const ref = resolvePullRequestRef(options.target, options.config);
  const metadata = await options.client.getPullRequestMetadata(ref);
  const files = await options.client.getChangedFiles(ref);
  const context = { ref, metadata, files };
  const review = await reviewPullRequest({
    context,
    emphasis: options.mode ? reviewEmphasisForMode(options.mode) : options.config.reviewEmphasis,
    provider: options.provider
  });
  const markdown = formatReviewDraft(context, review);
  const filename = reviewDraftFilename(context);

  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, markdown, "utf8");
  return filename;
}

export function resolveReviewMode(mode: string | undefined): ReviewMode {
  if (mode === undefined) {
    return "full";
  }

  if (mode === "full" || mode === "code" || mode === "quality" || mode === "risk") {
    return mode;
  }

  throw new AppError("--mode must be one of: full, code, quality, risk");
}

export function resolvePullRequestRef(target: ReviewTargetOptions, config: AppConfig): PullRequestRef {
  if (target.prUrl) {
    return parsePullRequestUrl(target.prUrl);
  }

  if (!target.project || !target.repo || target.pr === undefined) {
    throw new AppError("review without a PR URL requires --project, --repo, and --pr");
  }

  const organization = config.azureDevOps.organization;
  if (!organization) {
    throw new AppError("ADO_ASSIST_AZURE_DEVOPS_ORG is required when reviewing without a PR URL");
  }

  const pullRequestIdRaw = String(target.pr).trim();
  if (!/^[1-9]\d*$/.test(pullRequestIdRaw)) {
    throw new AppError("Pull request id must be numeric");
  }

  return parsePullRequestUrl(
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(
      target.project
    )}/_git/${encodeURIComponent(target.repo)}/pullrequest/${pullRequestIdRaw}`
  );
}
