import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parsePullRequestUrl } from "../azureDevOps/url.js";
import { checkDocsForContext } from "../docs/check.js";
import { formatReviewDraft, reviewDraftFilename } from "../drafts/format.js";
import { AppError } from "../errors.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import { reviewEmphasisForMode } from "../review/rubric.js";
import { resolveReviewOutputDir } from "../storage/paths.js";
export async function createReviewDraft(options) {
    const ref = resolvePullRequestRef(options.target, options.config);
    const metadata = await options.client.getPullRequestMetadata(ref);
    const files = await options.client.getChangedFiles(ref);
    const context = { ref, metadata, files };
    const docEvidence = await checkDocsForContext(options.checkDocs, {
        context,
        optional: options.checkDocsOptional,
        docChecker: options.docChecker
    });
    const review = await reviewPullRequest({
        context,
        emphasis: options.mode ? reviewEmphasisForMode(options.mode) : options.config.reviewEmphasis,
        provider: options.provider,
        docEvidence
    });
    const markdown = formatReviewDraft(context, review);
    const filename = reviewDraftFilename(context, resolveReviewOutputDir(options.outputDir ?? options.config.outputDir));
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, markdown, "utf8");
    return filename;
}
export function resolveReviewMode(mode) {
    if (mode === undefined) {
        return "full";
    }
    if (mode === "full" || mode === "code" || mode === "quality" || mode === "risk") {
        return mode;
    }
    throw new AppError("--mode must be one of: full, code, quality, risk");
}
export function resolvePullRequestRef(target, config) {
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
    return parsePullRequestUrl(`https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(target.project)}/_git/${encodeURIComponent(target.repo)}/pullrequest/${pullRequestIdRaw}`);
}
