import { createTwoFilesPatch } from "diff";
import { AppError } from "../errors.js";
export class AzureDevOpsClient {
    fetchImpl;
    authorization;
    constructor(options) {
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.authorization = `Basic ${Buffer.from(`:${options.pat}`).toString("base64")}`;
    }
    async listActivePullRequests(repository) {
        const url = new URL(`${this.repositoryBaseUrl(repository)}/pullrequests`);
        url.searchParams.set("searchCriteria.status", "active");
        url.searchParams.set("api-version", "7.1");
        const payload = await this.getJson(url.toString());
        return (payload.value ?? []).map((pullRequest) => ({
            ref: {
                organization: repository.organization,
                project: repository.project,
                repository: repository.repository,
                pullRequestId: pullRequest.pullRequestId,
                url: this.pullRequestUrl(repository, pullRequest.pullRequestId)
            },
            title: pullRequest.title,
            author: pullRequest.createdBy?.displayName ?? "Unknown",
            sourceBranch: pullRequest.sourceRefName,
            targetBranch: pullRequest.targetRefName
        }));
    }
    async getPullRequestMetadata(ref) {
        const payload = await this.getJson(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}?api-version=7.1`);
        return {
            title: payload.title,
            description: payload.description?.trim() || "No description provided.",
            author: payload.createdBy?.displayName ?? "Unknown",
            sourceBranch: payload.sourceRefName,
            targetBranch: payload.targetRefName,
            url: ref.url
        };
    }
    async getChangedFiles(ref) {
        const iteration = await this.getLatestIteration(ref);
        const baseCommit = iteration.commonRefCommit?.commitId;
        const headCommit = iteration.sourceRefCommit?.commitId;
        if (!baseCommit || !headCommit) {
            throw new AppError("Azure DevOps PR iteration did not include base and source commits");
        }
        const changes = await this.getIterationChanges(ref, iteration.id);
        const files = [];
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
    async postComments(ref, comments) {
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
            await this.postJson(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/threads?api-version=7.1`, body);
        }
    }
    baseUrl(ref) {
        return this.repositoryBaseUrl(ref);
    }
    repositoryBaseUrl(ref) {
        return `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(ref.project)}/_apis/git/repositories/${encodeURIComponent(ref.repository)}`;
    }
    pullRequestUrl(ref, pullRequestId) {
        return `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(ref.project)}/_git/${encodeURIComponent(ref.repository)}/pullrequest/${pullRequestId}`;
    }
    async getLatestIteration(ref) {
        const payload = await this.getJson(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations?api-version=7.1`);
        const iterations = payload.value ?? [];
        const latest = iterations.at(-1);
        if (!latest) {
            throw new AppError("Azure DevOps PR did not include any iterations");
        }
        return latest;
    }
    async getIterationChanges(ref, iterationId) {
        const changes = [];
        let nextSkip = 0;
        let nextTop = 2000;
        do {
            const url = new URL(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations/${iterationId}/changes`);
            url.searchParams.set("$top", String(nextTop));
            url.searchParams.set("$skip", String(nextSkip));
            url.searchParams.set("api-version", "7.1");
            const payload = await this.getJson(url.toString());
            changes.push(...(payload.changeEntries ?? []));
            nextSkip = payload.nextSkip ?? 0;
            nextTop = payload.nextTop ?? 0;
        } while (nextSkip > 0 && nextTop > 0);
        return changes;
    }
    async getItemContentAtCommit(ref, path, commitId) {
        const url = new URL(`${this.baseUrl(ref)}/items`);
        url.searchParams.set("path", path);
        url.searchParams.set("includeContent", "true");
        url.searchParams.set("includeContentMetadata", "true");
        url.searchParams.set("versionDescriptor.version", commitId);
        url.searchParams.set("versionDescriptor.versionType", "commit");
        url.searchParams.set("api-version", "7.1");
        const payload = await this.getJson(url.toString());
        if (payload.contentMetadata?.isBinary || payload.contentMetadata?.isImage) {
            return undefined;
        }
        return payload.content ?? "";
    }
    async getJson(url) {
        const response = await this.fetchImpl(url, {
            headers: {
                Authorization: this.authorization,
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            throw new AppError(`Azure DevOps request failed with ${response.status}`);
        }
        return (await response.json());
    }
    async postJson(url, body) {
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
function formatComment(comment) {
    const suggestion = comment.suggestion ? `\n\nSuggestion: ${comment.suggestion}` : "";
    return `**ADO Assist ${comment.severity} ${comment.category}**\n\n${comment.message}${suggestion}`;
}
