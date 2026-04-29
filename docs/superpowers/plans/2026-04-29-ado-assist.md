# ADO Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI that reviews Azure DevOps pull requests, writes editable Markdown review drafts, and posts only approved comments from those drafts.

**Architecture:** The CLI delegates behavior to focused modules for config, Azure DevOps access, review orchestration, provider adapters, and draft file parsing. Tests use fixtures and mocked clients so the core behavior is verified without live Azure DevOps or model credentials.

**Tech Stack:** Node.js 20+, TypeScript, Vitest, Commander, Zod, diff, tsx, Azure DevOps REST APIs through `fetch`, OpenAI-compatible chat completions through provider adapters.

---

## File Structure

- Create `package.json`: scripts, dependencies, package metadata, CLI bin entry.
- Create `tsconfig.json`: TypeScript compiler options.
- Create `vitest.config.ts`: Vitest config for TypeScript tests.
- Create `.gitignore`: Node, build, coverage, env, generated review files.
- Create `README.md`: v1 usage and configuration.
- Create `src/cli.ts`: command parser and process exit behavior.
- Create `src/index.ts`: CLI executable entrypoint.
- Create `src/config.ts`: environment loading and validation.
- Create `src/errors.ts`: shared typed application errors.
- Create `src/types.ts`: shared review, PR, diff, and comment types.
- Create `src/azureDevOps/url.ts`: Azure DevOps PR URL parsing.
- Create `src/azureDevOps/client.ts`: Azure DevOps API client interface and implementation.
- Create `src/review/rubric.ts`: default review rubric and emphasis handling.
- Create `src/review/orchestrator.ts`: builds review input, calls provider, validates result.
- Create `src/providers/types.ts`: provider interface.
- Create `src/providers/openai.ts`: OpenAI provider implementation.
- Create `src/providers/azureOpenAI.ts`: Azure OpenAI provider implementation.
- Create `src/providers/factory.ts`: provider selection from config.
- Create `src/drafts/format.ts`: Markdown draft writer.
- Create `src/drafts/parse.ts`: Markdown draft parser.
- Create `src/commands/review.ts`: review command orchestration.
- Create `src/commands/post.ts`: post command orchestration.
- Create `tests/fixtures/sampleReview.ts`: reusable PR/review fixtures.
- Create `tests/config.test.ts`: config tests.
- Create `tests/azureDevOpsUrl.test.ts`: PR URL parsing tests.
- Create `tests/draftFormatParse.test.ts`: Markdown draft round-trip tests.
- Create `tests/reviewOrchestrator.test.ts`: review orchestration tests.
- Create `tests/providerFactory.test.ts`: provider factory tests.
- Create `tests/azureDevOpsClient.test.ts`: Azure DevOps API client tests.
- Create `tests/postCommand.test.ts`: posting command behavior tests with mocked client.

## Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`
- Create: `src/cli.ts`
- Create: `src/errors.ts`

- [ ] **Step 1: Write project metadata**

Create `package.json`:

```json
{
  "name": "ado-assist",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "ado-assist": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "diff": "^5.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/diff": "^5.2.0",
    "@types/node": "^20.14.10",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vitest": "^2.0.4"
  }
}
```

- [ ] **Step 2: Write TypeScript and test config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 3: Write repository ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
reviews/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 4: Write minimal CLI entrypoint**

Create `src/errors.ts`:

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly exitCode = 1
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

Create `src/cli.ts`:

```ts
import { Command } from "commander";

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version("0.1.0");

  program.command("review").argument("<pr-url>").action(() => {
    throw new Error("review command is not implemented yet");
  });

  program.command("post").argument("<review-file>").action(() => {
    throw new Error("post command is not implemented yet");
  });

  return program;
}
```

Create `src/index.ts`:

```ts
#!/usr/bin/env node
import { createCli } from "./cli.js";
import { AppError } from "./errors.js";

try {
  await createCli().parseAsync(process.argv);
} catch (error) {
  if (error instanceof AppError) {
    console.error(error.message);
    process.exitCode = error.exitCode;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 6: Verify skeleton**

Run: `npm run typecheck`

Expected: TypeScript exits successfully.

Run: `npm test`

Expected: Vitest exits successfully with no tests or with a no-test message accepted for this first task.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/index.ts src/cli.ts src/errors.ts
git commit -m "chore: scaffold TypeScript CLI"
```

## Task 2: Shared Types and Config

**Files:**
- Create: `src/types.ts`
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadAzureDevOpsConfigFromEnv, loadConfigFromEnv } from "../src/config.js";

describe("loadConfigFromEnv", () => {
  it("loads OpenAI configuration", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "openai",
      ADO_ASSIST_OPENAI_API_KEY: "openai-key",
      ADO_ASSIST_OPENAI_MODEL: "gpt-4.1"
    });

    expect(config.azureDevOps.pat).toBe("pat");
    expect(config.provider.kind).toBe("openai");
    expect(config.provider.model).toBe("gpt-4.1");
    expect(config.reviewEmphasis).toEqual(["general", "standards", "risk"]);
  });

  it("loads Azure OpenAI configuration", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "azure-openai",
      ADO_ASSIST_AZURE_OPENAI_API_KEY: "azure-key",
      ADO_ASSIST_AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT: "gpt-4.1"
    });

    expect(config.provider.kind).toBe("azure-openai");
    expect(config.provider.endpoint).toBe("https://example.openai.azure.com");
    expect(config.provider.deployment).toBe("gpt-4.1");
  });

  it("rejects missing Azure DevOps PAT", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_PROVIDER: "openai",
        ADO_ASSIST_OPENAI_API_KEY: "openai-key",
        ADO_ASSIST_OPENAI_MODEL: "gpt-4.1"
      })
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_PAT is required");
  });

  it("loads Azure DevOps-only configuration for posting", () => {
    const config = loadAzureDevOpsConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_AZURE_DEVOPS_ORG: "acme"
    });

    expect(config).toEqual({ pat: "pat", organization: "acme" });
  });

  it("rejects incomplete OpenAI configuration", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "openai",
        ADO_ASSIST_OPENAI_API_KEY: "openai-key"
      })
    ).toThrow("ADO_ASSIST_OPENAI_MODEL is required");
  });

  it("parses custom review emphasis", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "openai",
      ADO_ASSIST_OPENAI_API_KEY: "openai-key",
      ADO_ASSIST_OPENAI_MODEL: "gpt-4.1",
      ADO_ASSIST_REVIEW_EMPHASIS: "risk,standards"
    });

    expect(config.reviewEmphasis).toEqual(["risk", "standards"]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/config.test.ts`

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Implement shared types**

Create `src/types.ts`:

```ts
export type ReviewEmphasis = "general" | "standards" | "risk";

export type ProviderConfig =
  | {
      kind: "openai";
      apiKey: string;
      model: string;
    }
  | {
      kind: "azure-openai";
      apiKey: string;
      endpoint: string;
      deployment: string;
    };

export interface AppConfig {
  azureDevOps: {
    pat: string;
    organization?: string;
  };
  provider: ProviderConfig;
  reviewEmphasis: ReviewEmphasis[];
}

export interface PullRequestRef {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
  url: string;
}

export interface PullRequestMetadata {
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
}

export interface ChangedFile {
  path: string;
  diff: string;
}

export interface PullRequestContext {
  ref: PullRequestRef;
  metadata: PullRequestMetadata;
  files: ChangedFile[];
}

export interface ReviewComment {
  id: string;
  filePath?: string;
  line?: number;
  severity: "info" | "warning" | "critical";
  category: "correctness" | "risk" | "tests" | "maintainability" | "standards";
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  riskSummary: string;
  comments: ReviewComment[];
}
```

- [ ] **Step 4: Implement config loading**

Create `src/config.ts`:

```ts
import { AppError } from "./errors.js";
import type { AppConfig, ReviewEmphasis } from "./types.js";

type Env = Record<string, string | undefined>;

const DEFAULT_EMPHASIS: ReviewEmphasis[] = ["general", "standards", "risk"];
const VALID_EMPHASIS = new Set<ReviewEmphasis>(["general", "standards", "risk"]);

function requireValue(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new AppError(`${name} is required`);
  }
  return value;
}

function parseReviewEmphasis(value: string | undefined): ReviewEmphasis[] {
  if (!value?.trim()) {
    return DEFAULT_EMPHASIS;
  }

  const parsed = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parsed) {
    if (!VALID_EMPHASIS.has(part as ReviewEmphasis)) {
      throw new AppError(`Invalid ADO_ASSIST_REVIEW_EMPHASIS value: ${part}`);
    }
  }

  return parsed as ReviewEmphasis[];
}

export function loadConfigFromEnv(env: Env = process.env): AppConfig {
  const azureDevOps = loadAzureDevOpsConfigFromEnv(env);
  const providerKind = requireValue(env, "ADO_ASSIST_PROVIDER");

  if (providerKind === "openai") {
    return {
      azureDevOps,
      provider: {
        kind: "openai",
        apiKey: requireValue(env, "ADO_ASSIST_OPENAI_API_KEY"),
        model: requireValue(env, "ADO_ASSIST_OPENAI_MODEL")
      },
      reviewEmphasis: parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS)
    };
  }

  if (providerKind === "azure-openai") {
    return {
      azureDevOps,
      provider: {
        kind: "azure-openai",
        apiKey: requireValue(env, "ADO_ASSIST_AZURE_OPENAI_API_KEY"),
        endpoint: requireValue(env, "ADO_ASSIST_AZURE_OPENAI_ENDPOINT"),
        deployment: requireValue(env, "ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT")
      },
      reviewEmphasis: parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS)
    };
  }

  throw new AppError("ADO_ASSIST_PROVIDER must be openai or azure-openai");
}

export function loadAzureDevOpsConfigFromEnv(env: Env = process.env): AppConfig["azureDevOps"] {
  return {
    pat: requireValue(env, "ADO_ASSIST_AZURE_DEVOPS_PAT"),
    organization: env.ADO_ASSIST_AZURE_DEVOPS_ORG?.trim() || undefined
  };
}
```

- [ ] **Step 5: Run config tests**

Run: `npm test -- tests/config.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/config.ts tests/config.test.ts
git commit -m "feat: add configuration loading"
```

## Task 3: Azure DevOps PR URL Parser

**Files:**
- Create: `src/azureDevOps/url.ts`
- Create: `tests/azureDevOpsUrl.test.ts`

- [ ] **Step 1: Write failing URL parser tests**

Create `tests/azureDevOpsUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePullRequestUrl } from "../src/azureDevOps/url.js";

describe("parsePullRequestUrl", () => {
  it("parses common Azure DevOps PR URLs", () => {
    const ref = parsePullRequestUrl(
      "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    );

    expect(ref).toEqual({
      organization: "acme",
      project: "Payments",
      repository: "api-service",
      pullRequestId: 42,
      url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
    });
  });

  it("parses visualstudio.com PR URLs", () => {
    const ref = parsePullRequestUrl(
      "https://acme.visualstudio.com/Payments/_git/api-service/pullrequest/42"
    );

    expect(ref.organization).toBe("acme");
    expect(ref.project).toBe("Payments");
    expect(ref.repository).toBe("api-service");
    expect(ref.pullRequestId).toBe(42);
  });

  it("rejects non-PR URLs", () => {
    expect(() => parsePullRequestUrl("https://dev.azure.com/acme/Payments")).toThrow(
      "Expected an Azure DevOps pull request URL"
    );
  });

  it("rejects non-numeric PR ids", () => {
    expect(() =>
      parsePullRequestUrl("https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/nope")
    ).toThrow("Pull request id must be numeric");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/azureDevOpsUrl.test.ts`

Expected: FAIL because `src/azureDevOps/url.ts` does not exist.

- [ ] **Step 3: Implement PR URL parser**

Create `src/azureDevOps/url.ts`:

```ts
import { AppError } from "../errors.js";
import type { PullRequestRef } from "../types.js";

export function parsePullRequestUrl(input: string): PullRequestRef {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new AppError("Expected an Azure DevOps pull request URL");
  }

  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const gitIndex = parts.indexOf("_git");
  const prIndex = parts.indexOf("pullrequest");

  if (gitIndex < 0 || prIndex < 0 || prIndex !== gitIndex + 2) {
    throw new AppError("Expected an Azure DevOps pull request URL");
  }

  const repository = parts[gitIndex + 1];
  const pullRequestIdRaw = parts[prIndex + 1];
  const pullRequestId = Number(pullRequestIdRaw);

  if (!Number.isInteger(pullRequestId) || pullRequestId <= 0) {
    throw new AppError("Pull request id must be numeric");
  }

  if (parsed.hostname === "dev.azure.com") {
    const organization = parts[0];
    const project = parts[1];
    if (!organization || !project || !repository) {
      throw new AppError("Expected an Azure DevOps pull request URL");
    }
    return { organization, project, repository, pullRequestId, url: parsed.toString() };
  }

  if (parsed.hostname.endsWith(".visualstudio.com")) {
    const organization = parsed.hostname.slice(0, -".visualstudio.com".length);
    const project = parts[0];
    if (!organization || !project || !repository) {
      throw new AppError("Expected an Azure DevOps pull request URL");
    }
    return { organization, project, repository, pullRequestId, url: parsed.toString() };
  }

  throw new AppError("Expected an Azure DevOps pull request URL");
}
```

- [ ] **Step 4: Run URL parser tests**

Run: `npm test -- tests/azureDevOpsUrl.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/azureDevOps/url.ts tests/azureDevOpsUrl.test.ts
git commit -m "feat: parse Azure DevOps PR URLs"
```

## Task 4: Draft Format and Parser

**Files:**
- Create: `tests/fixtures/sampleReview.ts`
- Create: `src/drafts/format.ts`
- Create: `src/drafts/parse.ts`
- Create: `tests/draftFormatParse.test.ts`

- [ ] **Step 1: Write shared fixtures**

Create `tests/fixtures/sampleReview.ts`:

```ts
import type { PullRequestContext, ReviewResult } from "../../src/types.js";

export const sampleContext: PullRequestContext = {
  ref: {
    organization: "acme",
    project: "Payments",
    repository: "api-service",
    pullRequestId: 42,
    url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
  },
  metadata: {
    title: "Add payment retry",
    author: "A. Developer",
    sourceBranch: "refs/heads/feature/retry",
    targetBranch: "refs/heads/main",
    url: "https://dev.azure.com/acme/Payments/_git/api-service/pullrequest/42"
  },
  files: [
    {
      path: "/src/payments/retry.ts",
      diff: "@@ -1,2 +1,3 @@\n export function retry() {\n+  return true;\n }"
    }
  ]
};

export const sampleReview: ReviewResult = {
  summary: "Adds retry behavior for payments.",
  riskSummary: "Retry behavior can duplicate charges if idempotency is missing.",
  comments: [
    {
      id: "comment-1",
      filePath: "/src/payments/retry.ts",
      line: 2,
      severity: "critical",
      category: "risk",
      message: "Confirm the retry path is idempotent before charging again.",
      suggestion: "Use an idempotency key for each payment attempt."
    },
    {
      id: "comment-2",
      severity: "warning",
      category: "tests",
      message: "Add a test for retry exhaustion."
    }
  ]
};
```

- [ ] **Step 2: Write failing draft round-trip tests**

Create `tests/draftFormatParse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatReviewDraft } from "../src/drafts/format.js";
import { parseReviewDraft } from "../src/drafts/parse.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("review draft format and parse", () => {
  it("round-trips approved comments through the machine-readable block", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const parsed = parseReviewDraft(draft);

    expect(parsed.pr).toEqual(sampleContext.ref);
    expect(parsed.comments).toEqual(sampleReview.comments);
  });

  it("allows users to remove comments before posting", () => {
    const draft = formatReviewDraft(sampleContext, sampleReview);
    const edited = draft.replace(/,\n    \\{[\\s\\S]*?comment-2[\\s\\S]*?\\n    \\}/, "");
    const parsed = parseReviewDraft(edited);

    expect(parsed.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
  });

  it("rejects drafts without the approved comments block", () => {
    expect(() => parseReviewDraft("# Review")).toThrow("Review draft is missing approved comments JSON");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- tests/draftFormatParse.test.ts`

Expected: FAIL because draft modules do not exist.

- [ ] **Step 4: Implement draft formatter**

Create `src/drafts/format.ts`:

```ts
import type { PullRequestContext, ReviewResult } from "../types.js";

export function reviewDraftFilename(context: PullRequestContext): string {
  return `reviews/${context.ref.organization}-${context.ref.project}-${context.ref.repository}-pr-${context.ref.pullRequestId}.md`;
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
```

- [ ] **Step 5: Implement draft parser**

Create `src/drafts/parse.ts`:

```ts
import { z } from "zod";
import { AppError } from "../errors.js";
import type { PullRequestRef, ReviewComment } from "../types.js";

const commentSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().optional(),
  line: z.number().int().positive().optional(),
  severity: z.enum(["info", "warning", "critical"]),
  category: z.enum(["correctness", "risk", "tests", "maintainability", "standards"]),
  message: z.string().min(1),
  suggestion: z.string().optional()
});

const draftSchema = z.object({
  pr: z.object({
    organization: z.string().min(1),
    project: z.string().min(1),
    repository: z.string().min(1),
    pullRequestId: z.number().int().positive(),
    url: z.string().url()
  }),
  comments: z.array(commentSchema)
});

export interface ParsedReviewDraft {
  pr: PullRequestRef;
  comments: ReviewComment[];
}

export function parseReviewDraft(markdown: string): ParsedReviewDraft {
  const match = markdown.match(/```json ado-assist-approved-comments\n([\\s\\S]*?)\n```/);
  if (!match) {
    throw new AppError("Review draft is missing approved comments JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new AppError("Review draft approved comments JSON is invalid");
  }

  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("Review draft approved comments JSON has an invalid shape");
  }

  return result.data;
}
```

- [ ] **Step 6: Run draft tests**

Run: `npm test -- tests/draftFormatParse.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/sampleReview.ts src/drafts/format.ts src/drafts/parse.ts tests/draftFormatParse.test.ts
git commit -m "feat: add editable review drafts"
```

## Task 5: Review Rubric and Orchestrator

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/review/rubric.ts`
- Create: `src/review/orchestrator.ts`
- Create: `tests/reviewOrchestrator.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Create `tests/reviewOrchestrator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reviewPullRequest } from "../src/review/orchestrator.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("reviewPullRequest", () => {
  it("passes PR context and rubric to the configured provider", async () => {
    const result = await reviewPullRequest({
      context: sampleContext,
      emphasis: ["general", "standards", "risk"],
      provider: {
        name: "mock",
        async reviewPullRequest(input) {
          expect(input.pullRequest).toEqual(sampleContext);
          expect(input.rubric).toContain("Correctness bugs and regressions");
          expect(input.rubric).toContain("Team standards");
          return sampleReview;
        }
      }
    });

    expect(result).toEqual(sampleReview);
  });

  it("rejects comments for files not in the PR", async () => {
    await expect(
      reviewPullRequest({
        context: sampleContext,
        emphasis: ["general"],
        provider: {
          name: "mock",
          async reviewPullRequest() {
            return {
              ...sampleReview,
              comments: [
                {
                  id: "bad",
                  filePath: "/src/other.ts",
                  line: 1,
                  severity: "warning",
                  category: "correctness",
                  message: "This file is not in the PR."
                }
              ]
            };
          }
        }
      })
    ).rejects.toThrow("Provider returned a comment for a file outside the PR");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/reviewOrchestrator.test.ts`

Expected: FAIL because review modules do not exist.

- [ ] **Step 3: Implement provider types**

Create `src/providers/types.ts`:

```ts
import type { PullRequestContext, ReviewResult } from "../types.js";

export interface ReviewInput {
  pullRequest: PullRequestContext;
  rubric: string;
}

export interface ReviewProvider {
  name: string;
  reviewPullRequest(input: ReviewInput): Promise<ReviewResult>;
}
```

- [ ] **Step 4: Implement rubric builder**

Create `src/review/rubric.ts`:

```ts
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
    "Prefer fewer high-confidence comments over broad commentary."
  ];

  if (emphasis.includes("general")) {
    sections.push("General code review: look for bugs, regressions, readability, maintainability, and missing tests.");
  }
  if (emphasis.includes("standards")) {
    sections.push("Team standards: flag naming, architecture, and PR hygiene issues only when they materially affect maintainability.");
  }
  if (emphasis.includes("risk")) {
    sections.push("Risk review: pay close attention to security, secrets, infrastructure risk, data loss, and production safety.");
  }

  return sections.join("\n");
}
```

- [ ] **Step 5: Implement orchestrator**

Create `src/review/orchestrator.ts`:

```ts
import { AppError } from "../errors.js";
import type { ReviewProvider } from "../providers/types.js";
import type { PullRequestContext, ReviewEmphasis, ReviewResult } from "../types.js";
import { buildReviewRubric } from "./rubric.js";

export interface ReviewPullRequestOptions {
  context: PullRequestContext;
  emphasis: ReviewEmphasis[];
  provider: ReviewProvider;
}

export async function reviewPullRequest(options: ReviewPullRequestOptions): Promise<ReviewResult> {
  const rubric = buildReviewRubric(options.emphasis);
  const result = await options.provider.reviewPullRequest({
    pullRequest: options.context,
    rubric
  });

  validateReviewResult(result, options.context);
  return result;
}

function validateReviewResult(result: ReviewResult, context: PullRequestContext): void {
  if (!result.summary.trim()) {
    throw new AppError("Provider returned an empty review summary");
  }

  const changedFiles = new Set(context.files.map((file) => file.path));
  for (const comment of result.comments) {
    if (comment.filePath && !changedFiles.has(comment.filePath)) {
      throw new AppError("Provider returned a comment for a file outside the PR");
    }
  }
}
```

- [ ] **Step 6: Run orchestrator tests**

Run: `npm test -- tests/reviewOrchestrator.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/providers/types.ts src/review/rubric.ts src/review/orchestrator.ts tests/reviewOrchestrator.test.ts
git commit -m "feat: add review orchestration"
```

## Task 6: Provider Adapters

**Files:**
- Create: `src/providers/openai.ts`
- Create: `src/providers/azureOpenAI.ts`
- Create: `src/providers/factory.ts`
- Create: `tests/providerFactory.test.ts`

- [ ] **Step 1: Write failing provider factory tests**

Create `tests/providerFactory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createReviewProvider } from "../src/providers/factory.js";
import type { AppConfig } from "../src/types.js";

describe("createReviewProvider", () => {
  it("creates an OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { pat: "pat" },
      provider: { kind: "openai", apiKey: "key", model: "gpt-4.1" },
      reviewEmphasis: ["general"]
    };

    expect(createReviewProvider(config).name).toBe("openai:gpt-4.1");
  });

  it("creates an Azure OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { pat: "pat" },
      provider: {
        kind: "azure-openai",
        apiKey: "key",
        endpoint: "https://example.openai.azure.com",
        deployment: "gpt-4.1"
      },
      reviewEmphasis: ["risk"]
    };

    expect(createReviewProvider(config).name).toBe("azure-openai:gpt-4.1");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/providerFactory.test.ts`

Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Extend provider interface**

Modify `src/providers/types.ts`:

```ts
import type { PullRequestContext, ReviewResult } from "../types.js";

export interface ReviewInput {
  pullRequest: PullRequestContext;
  rubric: string;
}

export interface ReviewProvider {
  name: string;
  reviewPullRequest(input: ReviewInput): Promise<ReviewResult>;
}
```

- [ ] **Step 4: Implement OpenAI provider**

Create `src/providers/openai.ts`:

```ts
import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";
import type { ReviewInput, ReviewProvider } from "./types.js";

export class OpenAIReviewProvider implements ReviewProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.name = `openai:${model}`;
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: JSON.stringify(input) }
        ]
      })
    });

    if (!response.ok) {
      throw new AppError(`OpenAI request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("OpenAI response did not include review content");
    }

    return JSON.parse(content) as ReviewResult;
  }
}

function systemPrompt(): string {
  return [
    "You are a precise pull request reviewer.",
    "Return JSON with summary, riskSummary, and comments.",
    "Each comment must include id, severity, category, message, and optional filePath, line, suggestion.",
    "Only comment on files and lines present in the supplied PR context."
  ].join("\n");
}
```

- [ ] **Step 5: Implement Azure OpenAI provider**

Create `src/providers/azureOpenAI.ts`:

```ts
import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";
import type { ReviewInput, ReviewProvider } from "./types.js";

export class AzureOpenAIReviewProvider implements ReviewProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly deployment: string
  ) {
    this.name = `azure-openai:${deployment}`;
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const baseUrl = this.endpoint.replace(/\/$/, "");
    const url = `${baseUrl}/openai/deployments/${encodeURIComponent(
      this.deployment
    )}/chat/completions?api-version=2024-06-01`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: JSON.stringify(input) }
        ]
      })
    });

    if (!response.ok) {
      throw new AppError(`Azure OpenAI request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("Azure OpenAI response did not include review content");
    }

    return JSON.parse(content) as ReviewResult;
  }
}

function systemPrompt(): string {
  return [
    "You are a precise pull request reviewer.",
    "Return JSON with summary, riskSummary, and comments.",
    "Each comment must include id, severity, category, message, and optional filePath, line, suggestion.",
    "Only comment on files and lines present in the supplied PR context."
  ].join("\n");
}
```

- [ ] **Step 6: Implement provider factory**

Create `src/providers/factory.ts`:

```ts
import type { AppConfig } from "../types.js";
import { AzureOpenAIReviewProvider } from "./azureOpenAI.js";
import { OpenAIReviewProvider } from "./openai.js";
import type { ReviewProvider } from "./types.js";

export function createReviewProvider(config: AppConfig): ReviewProvider {
  if (config.provider.kind === "openai") {
    return new OpenAIReviewProvider(config.provider.apiKey, config.provider.model);
  }

  return new AzureOpenAIReviewProvider(
    config.provider.apiKey,
    config.provider.endpoint,
    config.provider.deployment
  );
}
```

- [ ] **Step 7: Run provider tests**

Run: `npm test -- tests/providerFactory.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/providers/types.ts src/providers/openai.ts src/providers/azureOpenAI.ts src/providers/factory.ts tests/providerFactory.test.ts
git commit -m "feat: add AI provider adapters"
```

## Task 7: Azure DevOps API Client

**Files:**
- Create: `src/azureDevOps/client.ts`
- Create: `tests/azureDevOpsClient.test.ts`

- [ ] **Step 1: Write failing Azure DevOps client tests**

Create `tests/azureDevOpsClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { AzureDevOpsClient } from "../src/azureDevOps/client.js";
import { sampleContext } from "./fixtures/sampleReview.js";

describe("AzureDevOpsClient", () => {
  it("uses basic auth with the PAT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Add payment retry",
        createdBy: { displayName: "A. Developer" },
        sourceRefName: "refs/heads/feature/retry",
        targetRefName: "refs/heads/main"
      })
    });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    await client.getPullRequestMetadata(sampleContext.ref);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from(":pat").toString("base64")}`
    );
  });

  it("posts approved comments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });

    await client.postComments(sampleContext.ref, [
      {
        id: "comment-1",
        filePath: "/src/payments/retry.ts",
        line: 2,
        severity: "critical",
        category: "risk",
        message: "Confirm idempotency."
      }
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.comments[0].content).toContain("Confirm idempotency.");
    expect(body.threadContext.filePath).toBe("/src/payments/retry.ts");
    expect(body.threadContext.rightFileStart.line).toBe(2);
  });

  it("fetches changed files and builds unified diffs from PR iteration content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 3,
              commonRefCommit: { commitId: "base-commit" },
              sourceRefCommit: { commitId: "head-commit" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changeEntries: [
            {
              changeType: "edit",
              item: { path: "/src/payments/retry.ts", gitObjectType: "blob" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "export function retry() {\n  return false;\n}\n" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "export function retry() {\n  return true;\n}\n" })
      });

    const client = new AzureDevOpsClient({ pat: "pat", fetchImpl: fetchMock });
    const files = await client.getChangedFiles(sampleContext.ref);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/src/payments/retry.ts");
    expect(files[0].diff).toContain("-  return false;");
    expect(files[0].diff).toContain("+  return true;");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/azureDevOpsClient.test.ts`

Expected: FAIL because `src/azureDevOps/client.ts` does not exist.

- [ ] **Step 3: Implement Azure DevOps client**

Create `src/azureDevOps/client.ts`:

```ts
import { createTwoFilesPatch } from "diff";
import { AppError } from "../errors.js";
import type { ChangedFile, PullRequestMetadata, PullRequestRef, ReviewComment } from "../types.js";

type FetchLike = typeof fetch;

interface PullRequestIteration {
  id: number;
  commonRefCommit?: { commitId?: string };
  sourceRefCommit?: { commitId?: string };
}

interface PullRequestIterationChange {
  changeType: string;
  originalPath?: string;
  item?: {
    path?: string;
    gitObjectType?: string;
  };
}

export interface AzureDevOpsClientOptions {
  pat: string;
  fetchImpl?: FetchLike;
}

export class AzureDevOpsClient {
  private readonly fetchImpl: FetchLike;
  private readonly authorization: string;

  constructor(options: AzureDevOpsClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.authorization = `Basic ${Buffer.from(`:${options.pat}`).toString("base64")}`;
  }

  async getPullRequestMetadata(ref: PullRequestRef): Promise<PullRequestMetadata> {
    const payload = await this.getJson<{
      title: string;
      createdBy?: { displayName?: string };
      sourceRefName: string;
      targetRefName: string;
    }>(`${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}?api-version=7.1`);

    return {
      title: payload.title,
      author: payload.createdBy?.displayName ?? "Unknown",
      sourceBranch: payload.sourceRefName,
      targetBranch: payload.targetRefName,
      url: ref.url
    };
  }

  async getChangedFiles(ref: PullRequestRef): Promise<ChangedFile[]> {
    const iteration = await this.getLatestIteration(ref);
    const baseCommit = iteration.commonRefCommit?.commitId;
    const headCommit = iteration.sourceRefCommit?.commitId;

    if (!baseCommit || !headCommit) {
      throw new AppError("Azure DevOps PR iteration did not include base and source commits");
    }

    const changes = await this.getIterationChanges(ref, iteration.id);
    const files: ChangedFile[] = [];

    for (const change of changes) {
      const path = change.item?.path ?? change.originalPath;
      if (!path || change.item?.gitObjectType === "tree") {
        continue;
      }

      const changeType = change.changeType.toLowerCase();
      const basePath = change.originalPath ?? path;
      const oldContent = changeType.includes("add")
        ? ""
        : await this.getItemContentAtCommit(ref, basePath, baseCommit);
      const newContent = changeType.includes("delete")
        ? ""
        : await this.getItemContentAtCommit(ref, path, headCommit);

      files.push({
        path,
        diff: createTwoFilesPatch(`base${basePath}`, `head${path}`, oldContent, newContent)
      });
    }

    return files;
  }

  async postComments(ref: PullRequestRef, comments: ReviewComment[]): Promise<void> {
    for (const comment of comments) {
      const body = comment.filePath
        ? {
            comments: [{ parentCommentId: 0, content: formatComment(comment), commentType: 1 }],
            status: 1,
            threadContext: {
              filePath: comment.filePath,
              rightFileStart: { line: comment.line ?? 1, offset: 1 },
              rightFileEnd: { line: comment.line ?? 1, offset: 1 }
            }
          }
        : {
            comments: [{ parentCommentId: 0, content: formatComment(comment), commentType: 1 }],
            status: 1
          };

      await this.postJson(
        `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/threads?api-version=7.1`,
        body
      );
    }
  }

  private baseUrl(ref: PullRequestRef): string {
    return `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(
      ref.project
    )}/_apis/git/repositories/${encodeURIComponent(ref.repository)}`;
  }

  private async getLatestIteration(ref: PullRequestRef): Promise<PullRequestIteration> {
    const payload = await this.getJson<{ value?: PullRequestIteration[] }>(
      `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations?api-version=7.1`
    );
    const iterations = payload.value ?? [];
    const latest = iterations.at(-1);
    if (!latest) {
      throw new AppError("Azure DevOps PR did not include any iterations");
    }
    return latest;
  }

  private async getIterationChanges(
    ref: PullRequestRef,
    iterationId: number
  ): Promise<PullRequestIterationChange[]> {
    const payload = await this.getJson<{ changeEntries?: PullRequestIterationChange[] }>(
      `${this.baseUrl(ref)}/pullRequests/${ref.pullRequestId}/iterations/${iterationId}/changes?api-version=7.1`
    );
    return payload.changeEntries ?? [];
  }

  private async getItemContentAtCommit(
    ref: PullRequestRef,
    path: string,
    commitId: string
  ): Promise<string> {
    const url = new URL(`${this.baseUrl(ref)}/items`);
    url.searchParams.set("path", path);
    url.searchParams.set("includeContent", "true");
    url.searchParams.set("versionDescriptor.version", commitId);
    url.searchParams.set("versionDescriptor.versionType", "commit");
    url.searchParams.set("api-version", "7.1");

    const payload = await this.getJson<{ content?: string }>(url.toString());
    return payload.content ?? "";
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authorization,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new AppError(`Azure DevOps request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async postJson(url: string, body: unknown): Promise<void> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new AppError(`Azure DevOps request failed with ${response.status}`);
    }
  }
}

function formatComment(comment: ReviewComment): string {
  const suggestion = comment.suggestion ? `\n\nSuggestion: ${comment.suggestion}` : "";
  return `**ADO Assist ${comment.severity} ${comment.category}**\n\n${comment.message}${suggestion}`;
}
```

- [ ] **Step 4: Run Azure DevOps client tests**

Run: `npm test -- tests/azureDevOpsClient.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/azureDevOps/client.ts tests/azureDevOpsClient.test.ts
git commit -m "feat: add Azure DevOps comment client"
```

## Task 8: Review and Post Commands

**Files:**
- Create: `src/commands/review.ts`
- Create: `src/commands/post.ts`
- Modify: `src/cli.ts`
- Create: `tests/postCommand.test.ts`

- [ ] **Step 1: Write failing post command test**

Create `tests/postCommand.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { postReviewDraft } from "../src/commands/post.js";
import { formatReviewDraft } from "../src/drafts/format.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("postReviewDraft", () => {
  it("posts only comments that remain in the review draft", async () => {
    const markdown = formatReviewDraft(sampleContext, {
      ...sampleReview,
      comments: [sampleReview.comments[0]]
    });
    const postComments = vi.fn().mockResolvedValue(undefined);

    await postReviewDraft({
      markdown,
      client: { postComments }
    });

    expect(postComments).toHaveBeenCalledWith(sampleContext.ref, [sampleReview.comments[0]]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/postCommand.test.ts`

Expected: FAIL because command modules do not exist.

- [ ] **Step 3: Implement post command helper**

Create `src/commands/post.ts`:

```ts
import { readFile } from "node:fs/promises";
import type { PullRequestRef, ReviewComment } from "../types.js";
import { parseReviewDraft } from "../drafts/parse.js";

export interface PostClient {
  postComments(ref: PullRequestRef, comments: ReviewComment[]): Promise<void>;
}

export interface PostReviewDraftOptions {
  markdown: string;
  client: PostClient;
}

export async function postReviewDraft(options: PostReviewDraftOptions): Promise<number> {
  const parsed = parseReviewDraft(options.markdown);
  await options.client.postComments(parsed.pr, parsed.comments);
  return parsed.comments.length;
}

export async function postReviewDraftFile(path: string, client: PostClient): Promise<number> {
  const markdown = await readFile(path, "utf8");
  return postReviewDraft({ markdown, client });
}
```

- [ ] **Step 4: Implement review command helper**

Create `src/commands/review.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AzureDevOpsClient } from "../azureDevOps/client.js";
import { parsePullRequestUrl } from "../azureDevOps/url.js";
import { reviewDraftFilename, formatReviewDraft } from "../drafts/format.js";
import type { ReviewProvider } from "../providers/types.js";
import { reviewPullRequest } from "../review/orchestrator.js";
import type { AppConfig } from "../types.js";

export interface ReviewCommandOptions {
  prUrl: string;
  config: AppConfig;
  client: AzureDevOpsClient;
  provider: ReviewProvider;
}

export async function createReviewDraft(options: ReviewCommandOptions): Promise<string> {
  const ref = parsePullRequestUrl(options.prUrl);
  const metadata = await options.client.getPullRequestMetadata(ref);
  const files = await options.client.getChangedFiles(ref);
  const context = { ref, metadata, files };
  const review = await reviewPullRequest({
    context,
    emphasis: options.config.reviewEmphasis,
    provider: options.provider
  });
  const markdown = formatReviewDraft(context, review);
  const filename = reviewDraftFilename(context);

  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, markdown, "utf8");
  return filename;
}
```

- [ ] **Step 5: Wire commands into CLI**

Modify `src/cli.ts`:

```ts
import { Command } from "commander";
import { AzureDevOpsClient } from "./azureDevOps/client.js";
import { loadAzureDevOpsConfigFromEnv, loadConfigFromEnv } from "./config.js";
import { postReviewDraftFile } from "./commands/post.js";
import { createReviewDraft } from "./commands/review.js";
import { createReviewProvider } from "./providers/factory.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version("0.1.0");

  program
    .command("review")
    .argument("<pr-url>")
    .action(async (prUrl: string) => {
      const config = loadConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: config.azureDevOps.pat });
      const provider = createReviewProvider(config);
      const filename = await createReviewDraft({ prUrl, config, client, provider });
      console.log(`Review draft written to ${filename}`);
    });

  program
    .command("post")
    .argument("<review-file>")
    .action(async (reviewFile: string) => {
      const azureDevOps = loadAzureDevOpsConfigFromEnv();
      const client = new AzureDevOpsClient({ pat: azureDevOps.pat });
      const count = await postReviewDraftFile(reviewFile, client);
      console.log(`Posted ${count} approved comment${count === 1 ? "" : "s"}`);
    });

  return program;
}
```

- [ ] **Step 6: Run post command test**

Run: `npm test -- tests/postCommand.test.ts`

Expected: PASS.

- [ ] **Step 7: Run full test suite and typecheck**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/commands/review.ts src/commands/post.ts src/cli.ts tests/postCommand.test.ts
git commit -m "feat: wire review and post commands"
```

## Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

```md
# ADO Assist

ADO Assist is a TypeScript CLI for drafting Azure DevOps pull request review feedback with an AI reviewer. It writes an editable Markdown review file first, then posts only the comments that remain in the approved JSON block.

## Status

This is an early CLI-first implementation. It fetches PR metadata, builds file diffs from Azure DevOps PR iteration content, drafts review feedback into Markdown, and posts only approved comments.

## Install

\`\`\`bash
npm install
npm run build
\`\`\`

## Configuration

For OpenAI:

\`\`\`bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="openai"
export ADO_ASSIST_OPENAI_API_KEY="..."
export ADO_ASSIST_OPENAI_MODEL="gpt-4.1"
\`\`\`

For Azure OpenAI:

\`\`\`bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="azure-openai"
export ADO_ASSIST_AZURE_OPENAI_API_KEY="..."
export ADO_ASSIST_AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT="your-deployment"
\`\`\`

Optional:

\`\`\`bash
export ADO_ASSIST_REVIEW_EMPHASIS="general,standards,risk"
\`\`\`

## Usage

\`\`\`bash
npm run dev -- review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
npm run dev -- post "reviews/org-project-repo-pr-123.md"
\`\`\`

The `review` command writes a Markdown draft. Edit the approved JSON block to remove comments you do not want posted, then run `post`.

Large PRs should be split before review. The first implementation keeps review context simple and does not chunk model requests.

## Verification

\`\`\`bash
npm test
npm run typecheck
\`\`\`
```

- [ ] **Step 2: Run verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document ADO Assist usage"
```

## Task 10: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS and `dist/index.js` exists.

- [ ] **Step 4: Inspect git status**

Run: `git status --short`

Expected: no uncommitted source changes except generated files that are intentionally ignored.

- [ ] **Step 5: Record follow-up**

Create an issue or note for the next integration task:

```md
Next integration task: add large-PR chunking and multi-pass review.

Acceptance:
- Detect when the normalized PR context exceeds the configured provider budget.
- Split review by file or file group.
- Merge results into one validated review draft.
- Preserve source file and line references for inline comments.
```

## Self-Review

- Spec coverage: The plan covers CLI commands, config, provider adapters, rubric, Markdown drafts, Azure DevOps PR metadata, Azure DevOps changed-file diff retrieval, Azure DevOps comment posting, tests, README, and the service-ready module boundaries.
- Placeholder scan: No unfinished-marker text or undefined task instructions are intentionally left in executable steps.
- Type consistency: Shared types are introduced before consumers; provider interface gets its `name` property before factory tests require it; command tests use the same `ReviewComment` and `PullRequestRef` shapes as the draft parser.
