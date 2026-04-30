import type { PullRequestContext, ReviewResult } from "../types.js";

export function reviewDraftFilename(context: PullRequestContext): string {
  const organization = encodeURIComponent(context.ref.organization);
  const project = encodeURIComponent(context.ref.project);
  const repository = encodeURIComponent(context.ref.repository);
  return `reviews/${organization}-${project}-${repository}-pr-${context.ref.pullRequestId}.md`;
}

export function formatReviewDraft(context: PullRequestContext, review: ReviewResult): string {
  const inlineComments = review.comments.filter((comment) => comment.filePath);
  const generalComments = review.comments.filter((comment) => !comment.filePath);

  return `# ADO Assist Review Draft

## PR

- Title: ${context.metadata.title}
- Author: ${context.metadata.author}
- Source: ${context.metadata.sourceBranch}
- Target: ${context.metadata.targetBranch}
- Link: ${context.metadata.url}

## Summary

${review.summary}

## Risk Summary

${review.riskSummary}

## Suggested Inline Comments

${formatHumanComments(inlineComments)}

## Suggested General Comments

${formatHumanComments(generalComments)}

## Approved Comments JSON

Remove comments from this JSON block before posting if you do not want them posted.

\`\`\`json ado-assist-approved-comments
${JSON.stringify({ pr: context.ref, comments: review.comments }, null, 2)}
\`\`\`
`;
}

function formatHumanComments(comments: ReviewResult["comments"]): string {
  if (comments.length === 0) {
    return "No comments suggested.";
  }

  return comments
    .map((comment) => {
      const location = comment.filePath ? `${comment.filePath}:${comment.line ?? 1}` : "General";
      const suggestion = comment.suggestion ? `\n  Suggestion: ${comment.suggestion}` : "";
      return `- [${comment.severity}] ${location} (${comment.category})\n  ${comment.message}${suggestion}`;
    })
    .join("\n\n");
}
