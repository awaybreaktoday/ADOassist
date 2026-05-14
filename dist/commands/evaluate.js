import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkDocs } from "../docs/check.js";
import { AppError } from "../errors.js";
import { createReviewProvider } from "../providers/factory.js";
import { preparePullRequest } from "./prepare.js";
const VALID_PROVIDER_KINDS = new Set([
    "openai",
    "azure-openai",
    "anthropic",
    "gemini",
    "openai-compatible"
]);
export function resolveEvalProviderKinds(value, fallbackProvider) {
    const rawProviders = value
        ?.split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    const providers = rawProviders && rawProviders.length > 0 ? rawProviders : fallbackProvider ? [fallbackProvider] : [];
    if (providers.length === 0) {
        throw new AppError("--providers is required when no provider is configured");
    }
    const resolved = [];
    for (const provider of providers) {
        if (!VALID_PROVIDER_KINDS.has(provider)) {
            throw new AppError("--providers must contain: openai, azure-openai, anthropic, gemini, or openai-compatible");
        }
        if (!resolved.includes(provider)) {
            resolved.push(provider);
        }
    }
    return resolved;
}
export function resolveExpectedTerms(value) {
    return (value
        ?.split(",")
        .map((part) => part.trim())
        .filter(Boolean) ?? []);
}
export async function runProviderEval(options) {
    if (options.providerKinds.length === 0) {
        throw new AppError("Provider eval requires at least one provider");
    }
    const now = options.now ?? Date.now;
    const providerFactory = options.providerFactory ?? createReviewProvider;
    let cachedDocEvidence;
    const docChecker = options.checkDocs
        ? async (profile, docOptions) => {
            cachedDocEvidence ??= (options.docChecker ?? checkDocs)(profile, docOptions);
            return cachedDocEvidence;
        }
        : undefined;
    const results = [];
    await mkdir(options.outputDir, { recursive: true });
    for (const providerKind of options.providerKinds) {
        const start = now();
        let providerLabel = providerKind;
        try {
            const config = options.configForProvider(providerKind);
            const provider = providerFactory(config);
            providerLabel = providerLabelForConfig(config);
            const run = await preparePullRequest({
                targetBranch: options.targetBranch,
                outputDir: join(options.outputDir, providerSlug(providerLabel)),
                mode: options.mode,
                apply: false,
                config,
                git: options.git,
                client: options.client,
                provider,
                checkDocs: options.checkDocs,
                checkDocsOptional: options.checkDocsOptional,
                docChecker
            });
            const runtimeMs = now() - start;
            const markdown = await readFile(run.draftFile, "utf8");
            results.push(successEntry(providerLabel, runtimeMs, run, markdown, options.expectedTerms ?? []));
        }
        catch (error) {
            const runtimeMs = now() - start;
            results.push({
                provider: providerLabel,
                status: "failed",
                runtimeMs,
                criticalCount: 0,
                warningCount: 0,
                infoCount: 0,
                expectedTermHits: expectedTermHits("", options.expectedTerms ?? []),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    const summaryFile = join(options.outputDir, "summary.md");
    await writeFile(summaryFile, formatProviderEvalSummary(options, results), "utf8");
    if (results.every((result) => result.status === "failed")) {
        throw new AppError(`Provider eval failed for all providers. Summary written to ${summaryFile}`);
    }
    return { summaryFile, results };
}
function successEntry(provider, runtimeMs, run, markdown, expectedTerms) {
    return {
        provider,
        status: "success",
        runtimeMs,
        draftFile: run.draftFile,
        title: run.title,
        commitMessage: run.commitMessage,
        criticalCount: severityCount(markdown, "critical"),
        warningCount: severityCount(markdown, "warning"),
        infoCount: severityCount(markdown, "info"),
        expectedTermHits: expectedTermHits(markdown, expectedTerms)
    };
}
function severityCount(markdown, severity) {
    return [...markdown.matchAll(new RegExp(`^- \\[${severity}\\] `, "gm"))].length;
}
function expectedTermHits(markdown, expectedTerms) {
    const lowerMarkdown = markdown.toLowerCase();
    return Object.fromEntries(expectedTerms.map((term) => [term, lowerMarkdown.includes(term.toLowerCase())]));
}
function formatProviderEvalSummary(options, results) {
    const expectedTerms = options.expectedTerms ?? [];
    const rows = results
        .map((result) => [
        result.provider,
        result.status,
        `${result.runtimeMs}ms`,
        String(result.criticalCount),
        String(result.warningCount),
        String(result.infoCount),
        result.title ?? "",
        result.draftFile ?? "",
        result.error ?? ""
    ].map(escapeTableCell).join(" | "))
        .map((row) => `| ${row} |`)
        .join("\n");
    const expectedTermSection = expectedTerms.length === 0
        ? ""
        : `\n## Expected Terms\n\n| Provider | ${expectedTerms.map(escapeTableCell).join(" | ")} |\n| ${[
            "Provider",
            ...expectedTerms
        ].map(() => "---").join(" | ")} |\n${results
            .map((result) => {
            const hits = expectedTerms.map((term) => (result.expectedTermHits[term] ? "yes" : "no"));
            return `| ${[result.provider, ...hits].map(escapeTableCell).join(" | ")} |`;
        })
            .join("\n")}\n`;
    return `# ADO Assist Provider Eval

- Target: ${options.targetBranch}
- Mode: ${options.mode ?? "full"}
- Check docs: ${options.checkDocs ?? "off"}

| Provider | Status | Runtime | Critical | Warning | Info | Title | Draft | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
${expectedTermSection}`;
}
function providerLabelForConfig(config) {
    if (config.provider.kind === "azure-openai") {
        return `${config.provider.kind}:${config.provider.deployment}`;
    }
    return `${config.provider.kind}:${config.provider.model}`;
}
function providerSlug(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
