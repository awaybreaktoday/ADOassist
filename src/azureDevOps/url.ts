import { AppError } from "../errors.js";
import type { PullRequestRef } from "../types.js";

export function parsePullRequestUrl(input: string): PullRequestRef {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new AppError("Expected an Azure DevOps pull request URL");
  }

  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const gitIndex = parts.indexOf("_git");
  const prIndex = parts.indexOf("pullrequest");

  if (gitIndex < 0 || prIndex < 0 || prIndex !== gitIndex + 2) {
    throw new AppError("Expected an Azure DevOps pull request URL");
  }

  const repository = parts[gitIndex + 1];
  const pullRequestIdRaw = parts[prIndex + 1];
  const pullRequestId = Number(pullRequestIdRaw);

  if (!Number.isInteger(pullRequestId) || pullRequestId <= 0) {
    throw new AppError("Pull request id must be numeric");
  }

  if (parsed.hostname === "dev.azure.com") {
    const organization = parts[0];
    const project = parts[1];
    if (!organization || !project || !repository) {
      throw new AppError("Expected an Azure DevOps pull request URL");
    }
    return { organization, project, repository, pullRequestId, url: parsed.toString() };
  }

  if (parsed.hostname.endsWith(".visualstudio.com")) {
    const organization = parsed.hostname.slice(0, -".visualstudio.com".length);
    const project = parts[0];
    if (!organization || !project || !repository) {
      throw new AppError("Expected an Azure DevOps pull request URL");
    }
    return { organization, project, repository, pullRequestId, url: parsed.toString() };
  }

  throw new AppError("Expected an Azure DevOps pull request URL");
}
