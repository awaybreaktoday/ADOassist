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
  comments: ReviewComment[];
}
