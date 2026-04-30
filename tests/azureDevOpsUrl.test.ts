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

  it("allows route marker words in project and repository names", () => {
    const projectRef = parsePullRequestUrl(
      "https://dev.azure.com/acme/pullrequest/_git/api-service/pullrequest/42"
    );
    const repoRef = parsePullRequestUrl(
      "https://dev.azure.com/acme/Payments/_git/pullrequest/pullrequest/43"
    );

    expect(projectRef.project).toBe("pullrequest");
    expect(repoRef.repository).toBe("pullrequest");
    expect(repoRef.pullRequestId).toBe(43);
  });

  it("rejects non-decimal PR ids", () => {
    expect(() =>
      parsePullRequestUrl("https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/1e3")
    ).toThrow("Pull request id must be numeric");
    expect(() =>
      parsePullRequestUrl("https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/0x2a")
    ).toThrow("Pull request id must be numeric");
  });

  it("normalizes malformed percent encoding errors", () => {
    expect(() =>
      parsePullRequestUrl("https://dev.azure.com/acme/Pay%ZZments/_git/api-service/pullrequest/42")
    ).toThrow("Expected an Azure DevOps pull request URL");
  });
});
