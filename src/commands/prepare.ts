import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { checkDocs } from "../docs/check.js";
import {
  formatLocalReviewDraft,
  localReviewDraftFilename,
  suggestCommitMessage,
  suggestPrDescription,
  suggestPrTitle
} from "../drafts/format.js";
import { AppError } from "../errors.js";
import type { ReviewProvider } from "../providers/types.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import { reviewEmphasisForMode } from "../review/rubric.js";
import { resolveReviewOutputDir } from "../storage/paths.js";
import type {
  AppConfig,
  ChangedFile,
  DocCheckProfile,
  DocEvidence,
  PullRequestContext,
  PullRequestRef,
  RepositoryRef,
  ReviewMode
} from "../types.js";

export interface PrepareGitClient {
  currentBranch(): Promise<string>;
  changedFilesIncludingWorkingTree(targetBranch: string): Promise<ChangedFile[]>;
  hasWorkingTreeChanges(): Promise<boolean>;
  remoteUrl(remote?: string): Promise<string>;
  stageAll(): Promise<void>;
  commit(message: string): Promise<void>;
  pushCurrentBranch(branch: string): Promise<void>;
}

export interface PreparePullRequestClient {
  createPullRequest(
    repository: RepositoryRef,
    request: {
      sourceRefName: string;
      targetRefName: string;
      title: string;
      description: string;
    }
  ): Promise<PullRequestRef>;
}

export interface PreparePullRequestOptions {
  targetBranch: string;
  outputDir?: string;
  mode?: ReviewMode;
  apply: boolean;
  config: AppConfig;
  git: PrepareGitClient;
  client: PreparePullRequestClient;
  provider: ReviewProvider;
  checkDocs?: DocCheckProfile;
  docChecker?: (profile: DocCheckProfile) => Promise<DocEvidence>;
}

export interface PreparePullRequestResult {
  applied: boolean;
  draftFile: string;
  repository: RepositoryRef;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  commitMessage: string;
  commitCreated: boolean;
  pullRequestUrl?: string;
}

export async function preparePullRequest(options: PreparePullRequestOptions): Promise<PreparePullRequestResult> {
  const sourceBranch = await options.git.currentBranch();
  if (sourceBranch === "HEAD") {
    throw new AppError("Cannot prepare a PR from detached HEAD");
  }

  const files = await options.git.changedFilesIncludingWorkingTree(options.targetBranch);
  if (files.length === 0) {
    throw new AppError(`No branch or working tree changes found against ${options.targetBranch}`);
  }

  const repository = resolveRepositoryRefFromRemote(await options.git.remoteUrl("origin"));
  const context = buildLocalPullRequestContext(sourceBranch, options.targetBranch, files);
  const docEvidence = options.checkDocs
    ? await (options.docChecker ?? checkDocs)(options.checkDocs)
    : undefined;
  const review = await reviewPullRequest({
    context,
    emphasis: options.mode ? reviewEmphasisForMode(options.mode) : options.config.reviewEmphasis,
    provider: options.provider,
    docEvidence
  });
  const title = suggestPrTitle(context, review);
  const description = suggestPrDescription(context, review);
  const commitMessage = suggestCommitMessage(context, review);
  const draftFile = localReviewDraftFilename(
    sourceBranch,
    options.targetBranch,
    resolveReviewOutputDir(options.outputDir ?? options.config.outputDir)
  );

  await mkdir(dirname(draftFile), { recursive: true });
  await writeFile(draftFile, formatLocalReviewDraft(context, review), "utf8");

  let commitCreated = false;
  let pullRequestUrl: string | undefined;

  if (options.apply) {
    if (await options.git.hasWorkingTreeChanges()) {
      await options.git.stageAll();
      await options.git.commit(commitMessage);
      commitCreated = true;
    }

    await options.git.pushCurrentBranch(sourceBranch);
    const pullRequest = await options.client.createPullRequest(repository, {
      sourceRefName: toHeadRef(sourceBranch),
      targetRefName: toHeadRef(targetBranchNameFromRef(options.targetBranch)),
      title,
      description
    });
    pullRequestUrl = pullRequest.url;
  }

  return {
    applied: options.apply,
    draftFile,
    repository,
    sourceBranch,
    targetBranch: options.targetBranch,
    title,
    description,
    commitMessage,
    commitCreated,
    pullRequestUrl
  };
}

export function resolveRepositoryRefFromRemote(remoteUrl: string): RepositoryRef {
  const sshMatch = remoteUrl.match(/(?:git@)?ssh\.dev\.azure\.com(?::|\/)v3\/([^/]+)\/([^/]+)\/(.+)$/);
  if (sshMatch) {
    return {
      organization: decodeURIComponent(sshMatch[1]),
      project: decodeURIComponent(sshMatch[2]),
      repository: stripGitSuffix(decodeURIComponent(sshMatch[3]))
    };
  }

  const url = parseUrl(remoteUrl);
  if (url?.hostname === "dev.azure.com") {
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const gitIndex = parts.indexOf("_git");
    if (parts.length >= 4 && gitIndex === 2) {
      return {
        organization: parts[0],
        project: parts[1],
        repository: stripGitSuffix(parts[3])
      };
    }
  }

  throw new AppError("Could not infer Azure DevOps organization, project, and repository from origin remote");
}

export function targetBranchNameFromRef(targetBranch: string): string {
  if (targetBranch.startsWith("refs/heads/")) {
    return targetBranch.slice("refs/heads/".length);
  }

  const slashIndex = targetBranch.indexOf("/");
  return slashIndex === -1 ? targetBranch : targetBranch.slice(slashIndex + 1);
}

function buildLocalPullRequestContext(
  sourceBranch: string,
  targetBranch: string,
  files: ChangedFile[]
): PullRequestContext {
  const url = `local://${encodeURIComponent(sourceBranch)}`;

  return {
    ref: {
      organization: "local",
      project: "local",
      repository: sourceBranch,
      pullRequestId: 0,
      url
    },
    metadata: {
      title: `Local changes from ${sourceBranch}`,
      description: `Local branch diff from ${sourceBranch} to ${targetBranch}.`,
      author: "Local Git",
      sourceBranch,
      targetBranch,
      url
    },
    files
  };
}

function toHeadRef(branch: string): string {
  return branch.startsWith("refs/heads/") ? branch : `refs/heads/${branch}`;
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
