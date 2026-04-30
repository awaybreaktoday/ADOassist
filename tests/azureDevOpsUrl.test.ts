import { describe, expect, it } from "vitest";
import { parsePullRequestUrl } from "../src/azureDevOps/url.js";

describe("parsePullRequestUrl", () => {
  it("parses common Azure DevOps PR URLs", () => {
    const ref = parsePullRequestUrl(
      "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("parses visualstudio.com PR URLs", () => {
    const ref = parsePullRequestUrl(
      "https://acme.visualstudio.com/Payments/_git/api-service/pullrequest/42"
    );

    expect(ref.organization).toBe("acme");
    expect(ref.project).toBe("Payments");
    expect(ref.repository).toBe("api-service");
    expect(ref.pullRequestId).toBe(42);
  });

  it("rejects non-PR URLs", () => {
    expect(() => parsePullRequestUrl("https://dev.azure.com/acme/Payments")).toThrow(
      "Expected an Azure DevOps pull request URL"
    );
  });

  it("rejects non-numeric PR ids", () => {
    expect(() =>
      parsePullRequestUrl("https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/nope")
    ).toThrow("Pull request id must be numeric");
  });
});
