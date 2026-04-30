import { AppError } from "../errors.js";
export function parsePullRequestUrl(input) {
    let parsed;
    try {
        parsed = new URL(input);
    }
    catch {
        throw new AppError("Expected an Azure DevOps pull request URL");
    }
    const parts = pathParts(parsed);
    const route = routeParts(parsed, parts);
    if (!route) {
        throw new AppError("Expected an Azure DevOps pull request URL");
    }
    const { organization, project, repository, pullRequestIdRaw } = route;
    if (!/^[1-9]\d*$/.test(pullRequestIdRaw)) {
        throw new AppError("Pull request id must be numeric");
    }
    const pullRequestId = Number(pullRequestIdRaw);
    return { organization, project, repository, pullRequestId, url: parsed.toString() };
}
function pathParts(parsed) {
    try {
        return parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    }
    catch {
        throw new AppError("Expected an Azure DevOps pull request URL");
    }
}
function routeParts(parsed, parts) {
    if (parsed.hostname === "dev.azure.com") {
        const [organization, project, gitMarker, repository, prMarker, pullRequestIdRaw] = parts;
        if (parts.length !== 6 || gitMarker !== "_git" || prMarker !== "pullrequest") {
            return undefined;
        }
        return requireRouteParts({ organization, project, repository, pullRequestIdRaw });
    }
    if (parsed.hostname.endsWith(".visualstudio.com")) {
        const organization = parsed.hostname.slice(0, -".visualstudio.com".length);
        const [project, gitMarker, repository, prMarker, pullRequestIdRaw] = parts;
        if (parts.length !== 5 || gitMarker !== "_git" || prMarker !== "pullrequest") {
            return undefined;
        }
        return requireRouteParts({ organization, project, repository, pullRequestIdRaw });
    }
    return undefined;
}
function requireRouteParts(parts) {
    if (!parts.organization || !parts.project || !parts.repository || !parts.pullRequestIdRaw) {
        return undefined;
    }
    return parts;
}
