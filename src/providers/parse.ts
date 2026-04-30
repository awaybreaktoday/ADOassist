import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";

export function parseProviderReviewContent(providerName: string, content: string): ReviewResult {
  try {
    return JSON.parse(content) as ReviewResult;
  } catch {
    throw new AppError(`${providerName} response included invalid review JSON`);
  }
}
