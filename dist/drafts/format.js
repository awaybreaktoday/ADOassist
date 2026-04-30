import { join } from "node:path";
export function reviewDraftFilename(context, outputDir = "reviews") {
    const organization = encodeURIComponent(context.ref.organization);
    const project = encodeURIComponent(context.ref.project);
    const repository = encodeURIComponent(context.ref.repository);
    return join(outputDir, `${organization}-${project}-${repository}-pr-${context.ref.pullRequestId}.md`);
}
export function localReviewDraftFilename(sourceBranch, targetBranch, outputDir = "reviews") {
    return join(outputDir, `local-${encodeURIComponent(sourceBranch)}-to-${encodeURIComponent(targetBranch)}.md`);
}
export function formatReviewDraft(context, review) {
    const inlineComments = review.comments.filter((comment) => comment.filePath);
    const generalComments = review.comments.filter((comment) => !comment.filePath);
    const qualityGapComments = generalComments.filter(isPrQualityComment);
    const otherGeneralComments = generalComments.filter((comment) => !isPrQualityComment(comment));
    return `# ADO Assist Review Draft

## PR

- Title: ${context.metadata.title}
- Description: ${context.metadata.description}
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

## PR Quality And Coverage Gaps

${formatHumanComments(qualityGapComments)}

## Suggested General Comments

${formatHumanComments(otherGeneralComments)}

## Approved Comments JSON

Remove comments from this JSON block before posting if you do not want them posted.

\`\`\`json ado-assist-approved-comments
${JSON.stringify({ pr: context.ref, comments: review.comments }, null, 2)}
\`\`\`
`;
}
export function formatLocalReviewDraft(context, review) {
    const inlineComments = review.comments.filter((comment) => comment.filePath);
    const generalComments = review.comments.filter((comment) => !comment.filePath);
    const qualityGapComments = generalComments.filter(isPrQualityComment);
    const otherGeneralComments = generalComments.filter((comment) => !isPrQualityComment(comment));
    return `# ADO Assist Local Review Draft

## Local Branch

- Source: ${context.metadata.sourceBranch}
- Target: ${context.metadata.targetBranch}
- Changed files: ${context.files.length}

## Suggested PR

### Title

${suggestPrTitle(context, review)}

### Description

${suggestPrDescription(review)}

## Summary

${review.summary}

## Risk Summary

${review.riskSummary}

## Suggested Inline Comments

${formatHumanComments(inlineComments)}

## PR Quality And Coverage Gaps

${formatHumanComments(qualityGapComments)}

## Suggested General Comments

${formatHumanComments(otherGeneralComments)}
`;
}
function isPrQualityComment(comment) {
    return (!comment.filePath &&
        ["tests", "risk", "maintainability", "standards"].includes(comment.category));
}
function formatHumanComments(comments) {
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
export function suggestPrTitle(context, review) {
    const suggestedTitle = cleanSingleLine(review.suggestedTitle);
    if (suggestedTitle) {
        return suggestedTitle;
    }
    const firstSentence = review.summary.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (firstSentence) {
        return firstSentence.length <= 90 ? firstSentence : firstSentence.slice(0, 90).replace(/\s+\S*$/, "").trim();
    }
    return `Update ${context.metadata.sourceBranch}`;
}
export function suggestPrDescription(review) {
    const suggestedDescription = review.suggestedDescription?.trim();
    if (suggestedDescription) {
        return suggestedDescription;
    }
    return `Summary:
${review.summary}

Risk:
${review.riskSummary}`;
}
export function suggestCommitMessage(context, review) {
    const suggestedCommitMessage = cleanSingleLine(review.suggestedCommitMessage);
    if (suggestedCommitMessage) {
        return suggestedCommitMessage;
    }
    return suggestPrTitle(context, review);
}
function cleanSingleLine(value) {
    const cleaned = value?.replace(/\s+/g, " ").trim();
    return cleaned && !cleaned.endsWith("...") ? cleaned : undefined;
}
