import type { ReviewEmphasis } from "../types.js";

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
    "Prefer fewer high-confidence comments over broad commentary.",
    "",
    "Also review PR quality and coverage gaps. Use general PR comments for these findings unless a specific changed line is the best anchor.",
    "Flag vague or missing PR description details, especially when the change affects infrastructure, security, data, or production behavior.",
    "Look for missing validation, tests, rollout, rollback, monitoring, documentation, and operational-impact notes."
  ];

  if (emphasis.includes("general")) {
    sections.push("General code review: look for bugs, regressions, readability, maintainability, and missing tests.");
  }
  if (emphasis.includes("standards")) {
    sections.push(
      "Team standards: flag naming, architecture, and PR hygiene issues only when they materially affect maintainability."
    );
  }
  if (emphasis.includes("risk")) {
    sections.push(
      "Risk review: pay close attention to security, secrets, infrastructure risk, data loss, and production safety."
    );
  }

  return sections.join("\n");
}
