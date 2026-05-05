export type ReviewMode = "full" | "code" | "quality" | "risk";
export type ReviewEmphasis = "general" | "standards" | "quality" | "risk";
export type DocCheckProfile = "azure-aks";

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
    }
  | {
      kind: "anthropic";
      apiKey: string;
      model: string;
      maxTokens: number;
    }
  | {
      kind: "gemini";
      apiKey: string;
      model: string;
    }
  | {
      kind: "openai-compatible";
      baseUrl: string;
      model: string;
      apiKey?: string;
    };

export interface AppConfig {
  azureDevOps: {
    pat: string;
    organization?: string;
  };
  provider: ProviderConfig;
  reviewEmphasis: ReviewEmphasis[];
  outputDir?: string;
}

export interface PullRequestRef {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
  url: string;
}

export interface RepositoryRef {
  organization: string;
  project: string;
  repository: string;
}

export interface PullRequestSummary {
  ref: PullRequestRef;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface PullRequestMetadata {
  title: string;
  description: string;
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
  suggestedTitle?: string;
  suggestedDescription?: string;
  suggestedCommitMessage?: string;
  docEvidence?: DocEvidence;
  comments: ReviewComment[];
}

export interface DocSource {
  title: string;
  url: string;
}

export interface DocFact {
  text: string;
  sourceUrl: string;
}

export interface DocEvidence {
  profile: DocCheckProfile;
  checkedAt: string;
  sources: DocSource[];
  facts: DocFact[];
}
