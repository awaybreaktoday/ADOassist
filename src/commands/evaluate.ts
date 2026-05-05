import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkDocs } from "../docs/check.js";
import { AppError } from "../errors.js";
import { createReviewProvider } from "../providers/factory.js";
import type { ReviewProvider } from "../providers/types.js";
import type { ProviderKind } from "../config.js";
import type { AppConfig, DocCheckProfile, DocEvidence, PullRequestContext } from "../types.js";
import {
  preparePullRequest,
  type PrepareGitClient,
  type PreparePullRequestClient,
  type PreparePullRequestResult
} from "./prepare.js";

export interface ProviderEvalOptions {
  targetBranch: string;
  outputDir: string;
  mode?: "full" | "code" | "quality" | "risk";
  checkDocs?: DocCheckProfile;
  providerKinds: ProviderKind[];
  expectedTerms?: string[];
  git: PrepareGitClient;
  client: PreparePullRequestClient;
  configForProvider(providerKind: ProviderKind): AppConfig;
  providerFactory?: (config: AppConfig) => ReviewProvider;
  docChecker?: (profile: DocCheckProfile, options?: { context: PullRequestContext }) => Promise<DocEvidence>;
  now?: () => number;
}

export interface ProviderEvalEntry {
  provider: string;
  status: "success" | "failed";
  runtimeMs: number;
  draftFile?: string;
  title?: string;
  commitMessage?: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  expectedTermHits: Record<string, boolean>;
  error?: string;
}

export interface ProviderEvalResult {
  summaryFile: string;
  results: ProviderEvalEntry[];
}

const VALID_PROVIDER_KINDS = new Set<ProviderKind>([
  "openai",
  "azure-openai",
  "anthropic",
  "gemini",
  "openai-compatible"
]);

export function resolveEvalProviderKinds(value: string | undefined, fallbackProvider: ProviderKind | undefined): ProviderKind[] {
  const rawProviders = value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const providers = rawProviders && rawProviders.length > 0 ? rawProviders : fallbackProvider ? [fallbackProvider] : [];
  if (providers.length === 0) {
    throw new AppError("--providers is required when no provider is configured");
  }

  const resolved: ProviderKind[] = [];
  for (const provider of providers) {
    if (!VALID_PROVIDER_KINDS.has(provider as ProviderKind)) {
      throw new AppError("--providers must contain: openai, azure-openai, anthropic, gemini, or openai-compatible");
    }

    if (!resolved.includes(provider as ProviderKind)) {
      resolved.push(provider as ProviderKind);
    }
  }

  return resolved;
}

export function resolveExpectedTerms(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

export async function runProviderEval(options: ProviderEvalOptions): Promise<ProviderEvalResult> {
  if (options.providerKinds.length === 0) {
    throw new AppError("Provider eval requires at least one provider");
  }

  const now = options.now ?? Date.now;
  const providerFactory = options.providerFactory ?? createReviewProvider;
  let cachedDocEvidence: Promise<DocEvidence> | undefined;
  const docChecker = options.checkDocs
    ? async (profile: DocCheckProfile, docOptions?: { context: PullRequestContext }) => {
        cachedDocEvidence ??= (options.docChecker ?? checkDocs)(profile, docOptions);
        return cachedDocEvidence;
      }
    : undefined;
  const results: ProviderEvalEntry[] = [];

  await mkdir(options.outputDir, { recursive: true });

  for (const providerKind of options.providerKinds) {
    const start = now();
    let providerLabel: string = providerKind;

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
        docChecker
      });
      const runtimeMs = now() - start;
      const markdown = await readFile(run.draftFile, "utf8");
      results.push(successEntry(providerLabel, runtimeMs, run, markdown, options.expectedTerms ?? []));
    } catch (error) {
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

function successEntry(
  provider: string,
  runtimeMs: number,
  run: PreparePullRequestResult,
  markdown: string,
  expectedTerms: string[]
): ProviderEvalEntry {
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

function severityCount(markdown: string, severity: "critical" | "warning" | "info"): number {
  return [...markdown.matchAll(new RegExp(`^- \\[${severity}\\] `, "gm"))].length;
}

function expectedTermHits(markdown: string, expectedTerms: string[]): Record<string, boolean> {
  const lowerMarkdown = markdown.toLowerCase();
  return Object.fromEntries(expectedTerms.map((term) => [term, lowerMarkdown.includes(term.toLowerCase())]));
}

function formatProviderEvalSummary(options: ProviderEvalOptions, results: ProviderEvalEntry[]): string {
  const expectedTerms = options.expectedTerms ?? [];
  const rows = results
    .map((result) =>
      [
        result.provider,
        result.status,
        `${result.runtimeMs}ms`,
        String(result.criticalCount),
        String(result.warningCount),
        String(result.infoCount),
        result.title ?? "",
        result.draftFile ?? "",
        result.error ?? ""
      ].map(escapeTableCell).join(" | ")
    )
    .map((row) => `| ${row} |`)
    .join("\n");

  const expectedTermSection =
    expectedTerms.length === 0
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

function providerLabelForConfig(config: AppConfig): string {
  if (config.provider.kind === "azure-openai") {
    return `${config.provider.kind}:${config.provider.deployment}`;
  }

  return `${config.provider.kind}:${config.provider.model}`;
}

function providerSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
