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

Optional:

```bash
export ADO_ASSIST_AZURE_DEVOPS_ORG="org"
export ADO_ASSIST_REVIEW_EMPHASIS="general,standards,risk"
```

`ADO_ASSIST_AZURE_DEVOPS_ORG` is optional in the current PR URL workflow because the organization is parsed from the PR URL. It is reserved for future commands that do not take a full PR URL.

## Usage

```bash
npm run dev -- review "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
npm run dev -- post "reviews/org-project-repo-pr-123.md"
```

The `review` command writes a Markdown draft under `reviews/`. Edit the approved JSON block to remove comments you do not want posted, then run `post`.

## Verification

```bash
npm test
npm run typecheck
npm run build
```
