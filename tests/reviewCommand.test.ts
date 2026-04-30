import { describe, expect, it } from "vitest";
import { resolvePullRequestRef } from "../src/commands/review.js";
import type { AppConfig } from "../src/types.js";

const baseConfig: AppConfig = {
  azureDevOps: {
    pat: "pat",
    organization: "acme"
  },
  provider: {
    kind: "openai",
    apiKey: "key",
    model: "gpt-4.1"
  },
  reviewEmphasis: ["general"]
};

describe("resolvePullRequestRef", () => {
  it("keeps supporting full PR URLs", () => {
    const ref = resolvePullRequestRef(
      {
        prUrl: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
      },
      baseConfig
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("builds a PR ref from project, repo, and PR id using the configured org", () => {
    const ref = resolvePullRequestRef(
      {
        project: "Payments",
        repo: "api-service",
        pr: "42"
      },
      baseConfig
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("URL-encodes shorthand project and repo values", () => {
    const ref = resolvePullRequestRef(
      {
        project: "Customer Payments",
        repo: "api/service",
        pr: 42
      },
      baseConfig
    );

    expect(ref.url).toBe("https://dev.azure.com/acme/Customer%20Payments/_git/api%2Fservice/pullrequest/42");
    expect(ref.project).toBe("Customer Payments");
    expect(ref.repository).toBe("api/service");
  });

  it("requires a configured org when no PR URL is provided", () => {
    expect(() =>
      resolvePullRequestRef(
        {
          project: "Payments",
          repo: "api-service",
          pr: "42"
        },
        {
          ...baseConfig,
          azureDevOps: { pat: "pat" }
        }
      )
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_ORG is required when reviewing without a PR URL");
  });

  it("requires project, repo, and PR id when no PR URL is provided", () => {
    expect(() => resolvePullRequestRef({ project: "Payments", pr: "42" }, baseConfig)).toThrow(
      "review without a PR URL requires --project, --repo, and --pr"
    );
  });

  it("rejects non-decimal shorthand PR ids", () => {
    expect(() =>
      resolvePullRequestRef(
        {
          project: "Payments",
          repo: "api-service",
          pr: "1e3"
        },
        baseConfig
      )
    ).toThrow("Pull request id must be numeric");
  });
});
