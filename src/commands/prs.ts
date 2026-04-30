import { AppError } from "../errors.js";
import type { AppConfig, PullRequestSummary, RepositoryRef, ReviewMode } from "../types.js";
import type { ReviewProvider } from "../providers/types.js";
import { createReviewDraft, type ReviewDraftClient, type ReviewTargetOptions } from "./review.js";

type AzureDevOpsConfigOnly = Pick<AppConfig, "azureDevOps">;

export interface PrDiscoveryTargetOptions {
  project?: string;
  repo?: string;
}

export interface PullRequestDiscoveryClient {
  listActivePullRequests(repository: RepositoryRef): Promise<PullRequestSummary[]>;
}

export interface ListOpenPullRequestsOptions {
  target: PrDiscoveryTargetOptions;
  config: AzureDevOpsConfigOnly;
  client: PullRequestDiscoveryClient;
}

export interface ReviewOpenPullRequestsOptions {
  target: PrDiscoveryTargetOptions;
  config: AppConfig;
  client: PullRequestDiscoveryClient;
  mode?: ReviewMode;
  limit?: number;
  outputDir?: string;
  provider?: ReviewProvider;
  createDraft?: (target: ReviewTargetOptions, mode: ReviewMode | undefined) => Promise<string>;
}

export async function listOpenPullRequests(options: ListOpenPullRequestsOptions): Promise<PullRequestSummary[]> {
  return options.client.listActivePullRequests(resolveRepositoryRef(options.target, options.config));
}

export async function reviewOpenPullRequests(options: ReviewOpenPullRequestsOptions): Promise<string[]> {
  const pullRequests = await listOpenPullRequests(options);
  const selectedPullRequests = options.limit === undefined ? pullRequests : pullRequests.slice(0, options.limit);
  const createDraft = options.createDraft ?? defaultCreateDraft(options);
  const filenames: string[] = [];

  for (const pullRequest of selectedPullRequests) {
    filenames.push(await createDraft({ prUrl: pullRequest.ref.url }, options.mode));
  }

  return filenames;
}

export function resolveRepositoryRef(target: PrDiscoveryTargetOptions, config: AzureDevOpsConfigOnly): RepositoryRef {
  if (!target.project || !target.repo) {
    throw new AppError("PR discovery requires --project and --repo");
  }

  const organization = config.azureDevOps.organization;
  if (!organization) {
    throw new AppError("ADO_ASSIST_AZURE_DEVOPS_ORG is required for PR discovery");
  }

  return {
    organization,
    project: target.project,
    repository: target.repo
  };
}

export function resolveLimit(limit: string | undefined): number | undefined {
  if (limit === undefined) {
    return undefined;
  }

  const parsed = Number(limit);
  if (!/^[1-9]\d*$/.test(limit) || !Number.isInteger(parsed)) {
    throw new AppError("--limit must be a positive integer");
  }

  return parsed;
}

function defaultCreateDraft(options: ReviewOpenPullRequestsOptions) {
  return async (target: ReviewTargetOptions, mode: ReviewMode | undefined): Promise<string> => {
    if (!options.provider) {
      throw new AppError("review-open requires a provider");
    }

    return createReviewDraft({
      target,
      mode,
      outputDir: options.outputDir,
      config: options.config,
      client: options.client as PullRequestDiscoveryClient & ReviewDraftClient,
      provider: options.provider
    });
  };
}
