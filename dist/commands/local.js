import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { formatLocalReviewDraft, localReviewDraftFilename as draftFilename } from "../drafts/format.js";
import { AppError } from "../errors.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import { reviewEmphasisForMode } from "../review/rubric.js";
import { resolveReviewOutputDir } from "../storage/paths.js";
export async function createLocalReviewDraft(options) {
    const sourceBranch = await options.git.currentBranch();
    const files = await options.git.changedFiles(options.targetBranch);
    if (files.length === 0) {
        throw new AppError(`No local changes found against ${options.targetBranch}`);
    }
    const context = buildLocalPullRequestContext(sourceBranch, options.targetBranch, files);
    const review = await reviewPullRequest({
        context,
        emphasis: options.mode ? reviewEmphasisForMode(options.mode) : options.config.reviewEmphasis,
        provider: options.provider
    });
    const markdown = formatLocalReviewDraft(context, review);
    const filename = localReviewDraftFilename(sourceBranch, options.targetBranch, resolveReviewOutputDir(options.outputDir ?? options.config.outputDir));
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, markdown, "utf8");
    return filename;
}
export function localReviewDraftFilename(sourceBranch, targetBranch, outputDir = "reviews") {
    return draftFilename(sourceBranch, targetBranch, outputDir);
}
function buildLocalPullRequestContext(sourceBranch, targetBranch, files) {
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
