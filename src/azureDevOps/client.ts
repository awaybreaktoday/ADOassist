import { createTwoFilesPatch } from "diff";
import { AppError } from "../errors.js";
import type { ChangedFile, PullRequestMetadata, PullRequestRef, ReviewComment } from "../types.js";

type FetchLike = typeof fetch;

interface PullRequestIteration {
  id: number;
  commonRefCommit?: { commitId?: string };
  sourceRefCommit?: { commitId?: string };
}

interface PullRequestIterationChange {
  changeType: string;
  originalPath?: string;
  item?: {
    path?: string;
    gitObjectType?: string;
  };
}

interface ItemContent {
  content?: string;
  contentMetadata?: {
    isBinary?: boolean;
    isImage?: boolean;
    contentType?: string;
  };
}

export interface AzureDevOpsClientOptions {
  pat: string;
  fetchImpl?: FetchLike;
}

export class AzureDevOpsClient {
  private readonly fetchImpl: FetchLike;
  private readonly authorization: string;

  constructor(options: AzureDevOpsClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.authorization = `Basic ${Buffer.from(`:${options.pat}`).toString("base64")}`;
  }

  async getPullRequestMetadata(ref: PullRequestRef): Promise<PullRequestMetadata> {
    const payload = await this.getJson<{
      title: string;
      createdBy?: { displayName?: string };
      sourceRefName: string;
      targetRefName: string;
    }>(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}?api-version=7.1`);

    return {
      title: payload.title,
      author: payload.createdBy?.displayName ?? "Unknown",
      sourceBranch: payload.sourceRefName,
      targetBranch: payload.targetRefName,
      url: ref.url
    };
  }

  async getChangedFiles(ref: PullRequestRef): Promise<ChangedFile[]> {
    const iteration = await this.getLatestIteration(ref);
    const baseCommit = iteration.commonRefCommit?.commitId;
    const headCommit = iteration.sourceRefCommit?.commitId;

    if (!baseCommit || !headCommit) {
      throw new AppError("Azure DevOps PR iteration did not include base and source commits");
    }

    const changes = await this.getIterationChanges(ref, iteration.id);
    const files: ChangedFile[] = [];

    for (const change of changes) {
      const path = change.item?.path ?? change.originalPath;
      if (!path || change.item?.gitObjectType === "tree") {
        continue;
      }

      const changeType = change.changeType.toLowerCase();
      if (changeType.includes("delete")) {
        continue;
      }

      const basePath = change.originalPath ?? path;
      const oldContent = changeType.includes("add")
        ? ""
        : await this.getItemContentAtCommit(ref, basePath, baseCommit);
      if (oldContent === undefined) {
        continue;
      }

      const newContent = await this.getItemContentAtCommit(ref, path, headCommit);

      if (newContent === undefined) {
        continue;
      }

      files.push({
        path,
        diff: createTwoFilesPatch(`base${basePath}`, `head${path}`, oldContent, newContent)
      });
    }

    return files;
  }

  async postComments(ref: PullRequestRef, comments: ReviewComment[]): Promise<void> {
    for (const comment of comments) {
      const body = comment.filePath
        ? {
            comments: [{ parentCommentId: 0, content: formatComment(comment), commentType: 1 }],
            status: 1,
            threadContext: {
              filePath: comment.filePath,
              rightFileStart: { line: comment.line ?? 1, offset: 1 },
              rightFileEnd: { line: comment.line ?? 1, offset: 1 }
            }
          }
        : {
            comments: [{ parentCommentId: 0, content: formatComment(comment), commentType: 1 }],
            status: 1
          };

      await this.postJson(
        `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/threads?api-version=7.1`,
        body
      );
    }
  }

  private baseUrl(ref: PullRequestRef): string {
    return `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(
      ref.project
    )}/_apis/git/repositories/${encodeURIComponent(ref.repository)}`;
  }

  private async getLatestIteration(ref: PullRequestRef): Promise<PullRequestIteration> {
    const payload = await this.getJson<{ value?: PullRequestIteration[] }>(
      `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations?api-version=7.1`
    );
    const iterations = payload.value ?? [];
    const latest = iterations.at(-1);
    if (!latest) {
      throw new AppError("Azure DevOps PR did not include any iterations");
    }
    return latest;
  }

  private async getIterationChanges(
    ref: PullRequestRef,
    iterationId: number
  ): Promise<PullRequestIterationChange[]> {
    const changes: PullRequestIterationChange[] = [];
    let nextSkip = 0;
    let nextTop = 2000;

    do {
      const url = new URL(
        `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations/${iterationId}/changes`
      );
      url.searchParams.set("$top", String(nextTop));
      url.searchParams.set("$skip", String(nextSkip));
      url.searchParams.set("api-version", "7.1");

      const payload = await this.getJson<{
        changeEntries?: PullRequestIterationChange[];
        nextSkip?: number;
        nextTop?: number;
      }>(url.toString());
      changes.push(...(payload.changeEntries ?? []));
      nextSkip = payload.nextSkip ?? 0;
      nextTop = payload.nextTop ?? 0;
    } while (nextSkip > 0 && nextTop > 0);

    return changes;
  }

  private async getItemContentAtCommit(
    ref: PullRequestRef,
    path: string,
    commitId: string
  ): Promise<string | undefined> {
    const url = new URL(`${this.baseUrl(ref)}/items`);
    url.searchParams.set("path", path);
    url.searchParams.set("includeContent", "true");
    url.searchParams.set("includeContentMetadata", "true");
    url.searchParams.set("versionDescriptor.version", commitId);
    url.searchParams.set("versionDescriptor.versionType", "commit");
    url.searchParams.set("api-version", "7.1");

    const payload = await this.getJson<ItemContent>(url.toString());
    if (payload.contentMetadata?.isBinary || payload.contentMetadata?.isImage) {
      return undefined;
    }

    return payload.content ?? "";
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authorization,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new AppError(`Azure DevOps request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async postJson(url: string, body: unknown): Promise<void> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new AppError(`Azure DevOps request failed with ${response.status}`);
    }
  }
}

function formatComment(comment: ReviewComment): string {
  const suggestion = comment.suggestion ? `\n\nSuggestion: ${comment.suggestion}` : "";
  return `**ADO Assist ${comment.severity} ${comment.category}**\n\n${comment.message}${suggestion}`;
}
