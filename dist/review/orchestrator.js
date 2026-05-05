import { AppError } from "../errors.js";
import { buildReviewRubric } from "./rubric.js";
export async function reviewPullRequest(options) {
    const rubric = buildReviewRubric(options.emphasis);
    const changedFilePaths = options.context.files.map((file) => file.path);
    const changedFiles = new Set(changedFilePaths);
    const changedFileAliases = changedFilePathAliases(changedFilePaths);
    const result = await options.provider.reviewPullRequest({
        pullRequest: options.context,
        rubric,
        docEvidence: options.docEvidence
    });
    const normalizedResult = normalizeReviewResult(result, isQualityOnlyMode(options.emphasis), changedFileAliases);
    validateReviewResult(normalizedResult, changedFiles);
    return options.docEvidence ? { ...normalizedResult, docEvidence: options.docEvidence } : normalizedResult;
}
function validateReviewResult(result, changedFiles) {
    const validationError = reviewResultValidationError(result);
    if (validationError) {
        throw new AppError(`Provider returned an invalid review result: ${validationError}`);
    }
    for (const comment of result.comments) {
        if (comment.filePath && !changedFiles.has(comment.filePath)) {
            throw new AppError("Provider returned a comment for a file outside the PR");
        }
    }
}
function normalizeReviewResult(result, forceGeneralComments, changedFileAliases) {
    if (!isRecord(result) || !Array.isArray(result.comments)) {
        return result;
    }
    return {
        ...result,
        comments: result.comments.map((comment) => normalizeReviewComment(comment, forceGeneralComments, changedFileAliases))
    };
}
function normalizeReviewComment(comment, forceGeneralComment, changedFileAliases) {
    if (!isRecord(comment)) {
        return comment;
    }
    const normalized = { ...comment };
    const filePath = optionalString(normalized.filePath);
    const suggestion = optionalString(normalized.suggestion);
    if (forceGeneralComment || filePath === undefined) {
        delete normalized.filePath;
        delete normalized.line;
    }
    else {
        normalized.filePath = changedFileAliases.get(normalizeFilePathAlias(filePath)) ?? filePath;
    }
    if (suggestion === undefined) {
        delete normalized.suggestion;
    }
    else {
        normalized.suggestion = suggestion;
    }
    return normalized;
}
function changedFilePathAliases(paths) {
    const aliases = new Map();
    for (const path of paths) {
        for (const alias of candidateFilePathAliases(path)) {
            aliases.set(alias, path);
        }
    }
    return aliases;
}
function candidateFilePathAliases(path) {
    const normalized = normalizeFilePathAlias(path);
    const withoutLeadingSlash = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return [
        normalized,
        withoutLeadingSlash,
        withLeadingSlash,
        `a/${withoutLeadingSlash}`,
        `b/${withoutLeadingSlash}`,
        `/a/${withoutLeadingSlash}`,
        `/b/${withoutLeadingSlash}`
    ];
}
function normalizeFilePathAlias(path) {
    return path.trim().replace(/\\/g, "/");
}
function isQualityOnlyMode(emphasis) {
    return emphasis.length === 1 && emphasis[0] === "quality";
}
function reviewResultValidationError(value) {
    if (!isRecord(value)) {
        return "result must be an object";
    }
    if (!isNonEmptyString(value.summary)) {
        return "summary must be a non-empty string";
    }
    if (!isNonEmptyString(value.riskSummary)) {
        return "riskSummary must be a non-empty string";
    }
    for (const field of ["suggestedTitle", "suggestedDescription", "suggestedCommitMessage"]) {
        if (value[field] !== undefined && !isNonEmptyString(value[field])) {
            return `${field} must be a non-empty string when present`;
        }
    }
    if (!Array.isArray(value.comments)) {
        return "comments must be an array";
    }
    for (const [index, comment] of value.comments.entries()) {
        const commentError = reviewCommentValidationError(comment, index);
        if (commentError) {
            return commentError;
        }
    }
    return undefined;
}
function reviewCommentValidationError(value, index) {
    const path = `comments[${index}]`;
    if (!isRecord(value)) {
        return `${path} must be an object`;
    }
    if (!isNonEmptyString(value.id)) {
        return `${path}.id must be a non-empty string`;
    }
    if (!isNonEmptyString(value.message)) {
        return `${path}.message must be a non-empty string`;
    }
    if (!["info", "warning", "critical"].includes(String(value.severity))) {
        return `${path}.severity must be one of: info, warning, critical`;
    }
    if (!["correctness", "risk", "tests", "maintainability", "standards"].includes(String(value.category))) {
        return `${path}.category must be one of: correctness, risk, tests, maintainability, standards`;
    }
    if (value.filePath !== undefined && !isNonEmptyString(value.filePath)) {
        return `${path}.filePath must be a non-empty string when present`;
    }
    if (value.filePath !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
        return `${path}.line must be a positive integer when filePath is set`;
    }
    if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) <= 0)) {
        return `${path}.line must be a positive integer when present`;
    }
    if (value.suggestion !== undefined && typeof value.suggestion !== "string") {
        return `${path}.suggestion must be a string when present`;
    }
    return undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function optionalString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        return String(value);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
