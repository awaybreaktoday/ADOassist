import { AppError } from "../errors.js";
import { createReviewDraft } from "./review.js";
export async function listOpenPullRequests(options) {
    return options.client.listActivePullRequests(resolveRepositoryRef(options.target, options.config));
}
export async function reviewOpenPullRequests(options) {
    const pullRequests = await listOpenPullRequests(options);
    const selectedPullRequests = options.limit === undefined ? pullRequests : pullRequests.slice(0, options.limit);
    const createDraft = options.createDraft ?? defaultCreateDraft(options);
    const filenames = [];
    for (const pullRequest of selectedPullRequests) {
        filenames.push(await createDraft({ prUrl: pullRequest.ref.url }, options.mode));
    }
    return filenames;
}
export function resolveRepositoryRef(target, config) {
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
export function resolveLimit(limit) {
    if (limit === undefined) {
        return undefined;
    }
    const parsed = Number(limit);
    if (!/^[1-9]\d*$/.test(limit) || !Number.isInteger(parsed)) {
        throw new AppError("--limit must be a positive integer");
    }
    return parsed;
}
function defaultCreateDraft(options) {
    return async (target, mode) => {
        if (!options.provider) {
            throw new AppError("review-open requires a provider");
        }
        return createReviewDraft({
            target,
            mode,
            outputDir: options.outputDir,
            config: options.config,
            client: options.client,
            provider: options.provider
        });
    };
}
