import type { ReviewEmphasis, ReviewMode } from "../types.js";

export function reviewEmphasisForMode(mode: ReviewMode): ReviewEmphasis[] {
  if (mode === "code") {
    return ["general", "standards"];
  }

  if (mode === "quality") {
    return ["quality"];
  }

  if (mode === "risk") {
    return ["risk"];
  }

  return ["general", "standards", "quality", "risk"];
}

export function buildReviewRubric(emphasis: ReviewEmphasis[]): string {
  const sections = [
    "Prioritize findings in this order:",
    "1. Correctness bugs and regressions.",
    "2. Security, secrets, infrastructure risk, data loss, and production safety.",
    "3. Missing or weak tests.",
    "4. Maintainability, readability, and architecture concerns.",
    "5. Team standards and style issues.",
    "",
    "Return only findings that are actionable and grounded in the supplied diff.",
    "Do not invent files or line numbers.",
    "Prefer fewer high-confidence comments over broad commentary."
  ];

  if (emphasis.includes("general")) {
    sections.push(
      "Mode: code. Focus on changed lines, implementation correctness, regressions, readability, maintainability, and missing tests."
    );
  }
  if (emphasis.includes("standards")) {
    sections.push(
      "Team standards: flag naming, architecture, and PR hygiene issues only when they materially affect maintainability."
    );
  }
  if (emphasis.includes("quality")) {
    sections.push(
      "Mode: quality. Review PR quality and coverage gaps. Use general PR comments for these findings unless a specific changed line is the best anchor.",
      "Do not return inline comments in quality mode. Omit filePath and line for every quality-mode comment.",
      "Do not restate implementation details unless they directly support a missing evidence, validation, rollout, rollback, documentation, or operational-impact gap.",
      "Flag vague or missing PR description details, especially when the change affects infrastructure, security, data, or production behavior.",
      "Look for missing validation, tests, rollout, rollback, monitoring, documentation, and operational-impact notes."
    );
  }
  if (emphasis.includes("risk")) {
    sections.push(
      "Mode: risk. Pay close attention to security, secrets, infrastructure risk, data loss, rollout safety, rollback safety, and production safety."
    );
  }

  return sections.join("\n");
}
