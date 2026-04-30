import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";

export function parseProviderReviewContent(providerName: string, content: string): ReviewResult {
  const jsonContent = extractJsonContent(content);

  try {
    return JSON.parse(jsonContent) as ReviewResult;
  } catch {
    throw new AppError(`${providerName} response included invalid review JSON`);
  }
}

function extractJsonContent(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  if (objectStart === -1) {
    return trimmed;
  }

  const objectEnd = findMatchingObjectEnd(trimmed, objectStart);
  if (objectEnd === -1) {
    return trimmed;
  }

  return trimmed.slice(objectStart, objectEnd + 1);
}

function findMatchingObjectEnd(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
