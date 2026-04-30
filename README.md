# ADO Assist

ADO Assist is a TypeScript CLI for drafting Azure DevOps pull request review feedback with an AI reviewer. It writes an editable Markdown review file first, then posts only the comments that remain in the approved JSON block.

## Status

This is an early CLI-first implementation. It fetches PR metadata, builds file diffs from Azure DevOps PR iteration content, drafts review feedback into Markdown, and posts only approved comments.

Deleted files and binary files are skipped in the first implementation. Large PRs should be split before review because the first version does not chunk model requests.

## Install

### Prerequisites

- Node.js 24 LTS
- npm
- git
- An Azure DevOps PAT with Code read access for drafting reviews, and Code write access if you want to post comments
- One configured model provider: OpenAI, Azure OpenAI, Anthropic Claude, Google Gemini, or an OpenAI-compatible server such as llama.cpp

### Install From GitHub

Install the command directly from this public repository:

```bash
npm install -g github:awaybreaktoday/ADOassist
ado-assist --version
```

To update later, rerun the same install command:

```bash
npm install -g github:awaybreaktoday/ADOassist
```

### Install From A Local Checkout

```bash
git clone https://github.com/awaybreaktoday/ADOassist.git
cd ADOassist
npm install
npm run build
```

To expose the `ado-assist` command from this checkout while developing:

```bash
npm link
```

Or install the built checkout globally:

```bash
npm install -g .
```

### Development Only

If you do not want to install the command globally, run it through npm:

```bash
npm run dev -- --help
npm run dev -- review-local --target origin/main --mode full
```

After `npm link`, `npm install -g .`, or the GitHub install, use the command directly:

```bash
ado-assist --help
ado-assist review-local --target origin/main --mode full
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
export ADO_ASSIST_OUTPUT_DIR="$HOME/.local/share/ado-assist/reviews"
export ADO_ASSIST_REVIEW_EMPHASIS="general,standards,quality,risk"
export ADO_ASSIST_ANTHROPIC_MAX_TOKENS="4096"
export ADO_ASSIST_OPENAI_COMPAT_API_KEY="..."
```

`ADO_ASSIST_AZURE_DEVOPS_ORG` is optional when using a full PR URL because the organization is parsed from the URL. It is required when using the shorthand review flags.

`ADO_ASSIST_OUTPUT_DIR` overrides where generated review Markdown files are written. If it is not set, ADO Assist uses the OS-specific app data location documented below.

`ADO_ASSIST_OPENAI_COMPAT_API_KEY` is optional because many local model servers do not require authentication. Include `/v1` in `ADO_ASSIST_OPENAI_COMPAT_BASE_URL` for llama.cpp and other servers that expose OpenAI-compatible routes under that prefix.

### Windows PowerShell

Use PowerShell environment variables instead of `export`:

```powershell
$env:ADO_ASSIST_AZURE_DEVOPS_PAT = "..."
$env:ADO_ASSIST_AZURE_DEVOPS_ORG = "org"
$env:ADO_ASSIST_OUTPUT_DIR = "$env:LOCALAPPDATA\ado-assist\reviews"
$env:ADO_ASSIST_PROVIDER = "openai-compatible"
$env:ADO_ASSIST_OPENAI_COMPAT_BASE_URL = "http://127.0.0.1:8080/v1"
$env:ADO_ASSIST_OPENAI_COMPAT_MODEL = "local-model"
ado-assist --help
```

The variables above last for the current terminal session. Put them in your PowerShell profile or another secret manager if you want a persistent setup.

## Usage

After installing the command:

```bash
ado-assist review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
ado-assist review --project project --repo repo --pr 123
ado-assist review "https://dev.azure.com/org/project/_git/repo/pullrequest/123" --mode quality
ado-assist prs --project project --repo repo
ado-assist review-open --project project --repo repo --mode quality --limit 5
ado-assist review-local --target origin/main --mode full
ado-assist review-local --target origin/main --output ./reviews
ado-assist post "<review-draft-file>"
```

During local development:

```bash
npm run dev -- review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
npm run dev -- review --project project --repo repo --pr 123
npm run dev -- review "https://dev.azure.com/org/project/_git/repo/pullrequest/123" --mode risk
npm run dev -- prs --project project --repo repo
npm run dev -- review-open --project project --repo repo --mode quality --limit 5
npm run dev -- review-local --target origin/main --mode full
npm run dev -- review-local --target origin/main --output ./reviews
npm run dev -- post "<review-draft-file>"
```

The `review` command writes a Markdown draft to the configured review draft storage directory and prints the file path. The shorthand form uses `ADO_ASSIST_AZURE_DEVOPS_ORG` for the organization. Edit the approved JSON block to remove comments you do not want posted, then run `post` with that review draft file path.

The `prs` command lists active pull requests for a configured organization, project, and repository. The `review-open` command creates review drafts for active PRs in that repository and never posts comments automatically. Use `--limit` to review only the first few active PRs.

The `review-local` command reviews the current git branch against a target branch, defaults to `origin/main`, and writes a local pre-PR draft with suggested title, description, risk summary, and review findings. It does not create an Azure DevOps pull request yet; use it before opening a PR to check correctness and improve the PR description.

Use `--mode` to choose the review focus:

- `full`: code, standards, PR quality gaps, and risk review. This is the default.
- `code`: changed-line implementation issues, maintainability, readability, and standards.
- `quality`: PR description quality, missing validation evidence, tests, rollout, rollback, docs, monitoring, and operational gaps.
- `risk`: security, infrastructure risk, data loss, rollout safety, rollback safety, and production safety.

Review drafts include a `PR Quality And Coverage Gaps` section for general PR-level issues such as vague descriptions, missing validation evidence, weak test coverage, rollout or rollback gaps, missing operational notes, and other concerns that are not best anchored to one changed line.

## Review Draft Storage

Generated review Markdown files are stored in an OS-specific app data directory by default:

- macOS: `~/Library/Application Support/ado-assist/reviews`
- Windows: `%LOCALAPPDATA%\ado-assist\reviews`
- Linux: `$XDG_DATA_HOME/ado-assist/reviews`, or `~/.local/share/ado-assist/reviews` when `XDG_DATA_HOME` is not set

Use `--output <dir>` for a single command, or `ADO_ASSIST_OUTPUT_DIR` for a persistent override:

```bash
ado-assist review-local --target origin/main --output ./reviews
export ADO_ASSIST_OUTPUT_DIR="$HOME/.ado-assist/reviews"
```

ADO Assist does not automatically delete review drafts yet. Remove old Markdown files manually when they are no longer needed. If you choose a project-local directory such as `./reviews`, add it to that repository's `.gitignore` before generating drafts.

## Privacy Notes

Review drafts can contain PR metadata, repository names, author names, file paths, and snippets or summaries of changed code. You should treat generated drafts as sensitive and avoid committing, sharing, or pasting them into public places unless you have reviewed and sanitized them.

When using hosted model providers, PR metadata and diffs are sent to the configured provider. Use a local OpenAI-compatible provider if your organization requires review data to stay on your own machine or network.

## Verification

```bash
npm test
npm run typecheck
npm run build
```
