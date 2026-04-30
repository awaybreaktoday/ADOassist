import { describe, expect, it } from "vitest";
import { buildReviewRubric, reviewEmphasisForMode } from "../src/review/rubric.js";

describe("reviewEmphasisForMode", () => {
  it("maps full mode to all emphasis areas", () => {
    expect(reviewEmphasisForMode("full")).toEqual(["general", "standards", "quality", "risk"]);
  });

  it("maps code mode to implementation-focused emphasis", () => {
    expect(reviewEmphasisForMode("code")).toEqual(["general", "standards"]);
  });

  it("maps quality mode to PR quality emphasis", () => {
    expect(reviewEmphasisForMode("quality")).toEqual(["quality"]);
  });

  it("maps risk mode to risk emphasis", () => {
    expect(reviewEmphasisForMode("risk")).toEqual(["risk"]);
  });
});

describe("buildReviewRubric", () => {
  it("adds mode-specific instructions for quality mode", () => {
    const rubric = buildReviewRubric(["quality"]);

    expect(rubric).toContain("Mode: quality");
    expect(rubric).toContain("PR description");
    expect(rubric).toContain("validation, tests, rollout, rollback");
    expect(rubric).toContain("Do not return inline comments in quality mode");
  });

  it("adds mode-specific instructions for code mode", () => {
    const rubric = buildReviewRubric(["general", "standards"]);

    expect(rubric).toContain("Mode: code");
    expect(rubric).toContain("changed lines");
  });

  it("adds mode-specific instructions for risk mode", () => {
    const rubric = buildReviewRubric(["risk"]);

    expect(rubric).toContain("Mode: risk");
    expect(rubric).toContain("production safety");
  });
});
