# ADO Assist

ADO Assist is a TypeScript CLI for drafting Azure DevOps pull request review feedback with an AI reviewer. It writes an editable Markdown review file first, then posts only the comments that remain in the approved JSON block.

## Status

This is an early CLI-first implementation. It fetches PR metadata, builds file diffs from Azure DevOps PR iteration content, drafts review feedback into Markdown, and posts only approved comments.

Deleted files and binary files are skipped in the first implementation. Large PRs should be split before review because the first version does not chunk model requests.

## Install

```bash
npm install
npm run build
```

To install the `ado-assist` command locally from this checkout:

```bash
npm link
```

Or install it globally from this directory:

```bash
npm install -g .
```

## Configuration

For OpenAI:

```bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="openai"
export ADO_ASSIST_OPENAI_API_KEY="..."
export ADO_ASSIST_OPENAI_MODEL="gpt-4.1"
```

For Azure OpenAI:

```bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="azure-openai"
export ADO_ASSIST_AZURE_OPENAI_API_KEY="..."
export ADO_ASSIST_AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT="your-deployment"
```

For Anthropic Claude:

```bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="anthropic"
export ADO_ASSIST_ANTHROPIC_API_KEY="..."
export ADO_ASSIST_ANTHROPIC_MODEL="claude-3-5-sonnet-latest"
```

For Google Gemini:

```bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="gemini"
export ADO_ASSIST_GEMINI_API_KEY="..."
export ADO_ASSIST_GEMINI_MODEL="gemini-1.5-pro"
```

For OpenAI-compatible servers, including local llama.cpp `llama-server`:

```bash
export ADO_ASSIST_AZURE_DEVOPS_PAT="..."
export ADO_ASSIST_PROVIDER="openai-compatible"
export ADO_ASSIST_OPENAI_COMPAT_BASE_URL="http://127.0.0.1:8080/v1"
export ADO_ASSIST_OPENAI_COMPAT_MODEL="local-model"
```

Optional:

```bash
export ADO_ASSIST_AZURE_DEVOPS_ORG="org"
export ADO_ASSIST_REVIEW_EMPHASIS="general,standards,risk"
export ADO_ASSIST_ANTHROPIC_MAX_TOKENS="4096"
export ADO_ASSIST_OPENAI_COMPAT_API_KEY="..."
```

`ADO_ASSIST_AZURE_DEVOPS_ORG` is optional when using a full PR URL because the organization is parsed from the URL. It is required when using the shorthand review flags.

`ADO_ASSIST_OPENAI_COMPAT_API_KEY` is optional because many local model servers do not require authentication. Include `/v1` in `ADO_ASSIST_OPENAI_COMPAT_BASE_URL` for llama.cpp and other servers that expose OpenAI-compatible routes under that prefix.

## Usage

After `npm link` or `npm install -g .`:

```bash
ado-assist review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
ado-assist review --project project --repo repo --pr 123
ado-assist post "reviews/org-project-repo-pr-123.md"
```

During local development:

```bash
npm run dev -- review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
npm run dev -- review --project project --repo repo --pr 123
npm run dev -- post "reviews/org-project-repo-pr-123.md"
```

The `review` command writes a Markdown draft under `reviews/`. The shorthand form uses `ADO_ASSIST_AZURE_DEVOPS_ORG` for the organization. Edit the approved JSON block to remove comments you do not want posted, then run `post`.

Review drafts include a `PR Quality And Coverage Gaps` section for general PR-level issues such as vague descriptions, missing validation evidence, weak test coverage, rollout or rollback gaps, missing operational notes, and other concerns that are not best anchored to one changed line.

## Privacy Notes

Review drafts can contain PR metadata, repository names, author names, file paths, and snippets or summaries of changed code. The `reviews/` directory is ignored by git, but you should still treat generated drafts as sensitive and avoid committing, sharing, or pasting them into public places unless you have reviewed and sanitized them.

When using hosted model providers, PR metadata and diffs are sent to the configured provider. Use a local OpenAI-compatible provider if your organization requires review data to stay on your own machine or network.

## Verification

```bash
npm test
npm run typecheck
npm run build
```
