import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { formatReviewDraft, reviewDraftFilename, suggestPrDescription } from "../src/drafts/format.js";
import { parseReviewDraft } from "../src/drafts/parse.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("review draft format and parse", () => {
  it("round-trips approved comments through the machine-readable block", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const parsed = parseReviewDraft(draft);

    expect(draft).toContain("- Description: Adds retry support and documents rollback expectations.");
    expect(draft).toContain("## PR Quality And Coverage Gaps");
    expect(draft).toContain("Add a test for retry exhaustion.");
    expect(parsed.pr).toEqual(sampleContext.ref);
    expect(parsed.comments).toEqual(sampleReview.comments);
  });

  it("prints factual check sources when docs were checked", () => {
    const draft = formatReviewDraft(sampleContext, {
      ...sampleReview,
      docEvidence: {
        profile: "azure-aks",
        checkedAt: "2026-05-05T12:00:00.000Z",
        sources: [{ title: "AKS upgrade", url: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster" }],
        facts: [{ text: "AKS upgrades must follow supported paths.", sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster" }]
      }
    });

    expect(draft).toContain("## Factual Checks");
    expect(draft).toContain("Profile: azure-aks");
    expect(draft).toContain("AKS upgrades must follow supported paths.");
    expect(draft).toContain("Sources:");
    expect(draft).toContain("[AKS upgrade](https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster)");
  });

  it("allows users to remove comments before posting", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const edited = draft.replace(/,\n    \{[\s\S]*?comment-2[\s\S]*?\n    \}/, "");
    const parsed = parseReviewDraft(edited);

    expect(parsed.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
  });

  it("rejects drafts without the approved comments block", () => {
    expect(() => parseReviewDraft("# Review")).toThrow("Review draft is missing approved comments JSON");
  });

  it("encodes path-like PR values in draft filenames", () => {
    const filename = reviewDraftFilename({
      ...sampleContext,
      ref: {
        ...sampleContext.ref,
        organization: "../acme",
        project: "Pay/ments",
        repository: "api service"
      }
    });

    expect(filename).toBe(join("reviews", "..%2Facme-Pay%2Fments-api%20service-pr-42.md"));
  });

  it("rejects unexpected edited JSON fields", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const edited = draft.replace('"filePath": "/src/payments/retry.ts"', '"filepath": "/src/payments/retry.ts"');

    expect(() => parseReviewDraft(edited)).toThrow(
      "Review draft approved comments JSON has an invalid shape"
    );
  });

  it("parses CRLF drafts and closing fences without a preceding newline", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview)
      .replace(/\n```$/, "```")
      .replace(/\n/g, "\r\n");
    const parsed = parseReviewDraft(draft);

    expect(parsed.comments).toEqual(sampleReview.comments);
  });

  it("round-trips comments that contain Markdown fences", () => {
    const review = {
      ...sampleReview,
      comments: [
        {
          ...sampleReview.comments[0],
          message: "Consider this example:\n```ts\nretry();\n```"
        }
      ]
    };

    const draft = formatReviewDraft(sampleContext, review);
    const parsed = parseReviewDraft(draft);

    expect(parsed.comments).toEqual(review.comments);
  });

  it("structures suggested PR descriptions for infrastructure changes", () => {
    const description = suggestPrDescription(
      {
        ...sampleContext,
        files: [
          {
            path: "/aks/dev/vars/mjoyeux/westeurope.tfvars",
            diff: "@@ -1 +1 @@\n-1.33.0\n+1.33.8\n"
          }
        ]
      },
      {
        ...sampleReview,
        suggestedDescription:
          "Updates platform-01 node pool orchestrator_version from 1.33.0 to 1.33.8."
      }
    );

    expect(description).toContain("## Summary");
    expect(description).toContain("Updates platform-01 node pool orchestrator_version from 1.33.0 to 1.33.8.");
    expect(description).toContain("## Validation");
    expect(description).toContain("Confirm the relevant Azure DevOps checks, Terraform validation, or plan output before merge.");
    expect(description).toContain("## Risk / Impact");
    expect(description).toContain(sampleReview.riskSummary);
    expect(description).toContain("## Rollback");
    expect(description).toContain("Revert this PR or restore the previous infrastructure values and redeploy through the normal pipeline.");
  });
});
