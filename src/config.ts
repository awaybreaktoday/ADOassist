import { AppError } from "./errors.js";
import type { AppConfig, ProviderConfig, ReviewEmphasis } from "./types.js";

type Env = Record<string, string | undefined>;
type OpenAIEnv = Env & { ADO_ASSIST_PROVIDER: "openai" };
type AzureOpenAIEnv = Env & { ADO_ASSIST_PROVIDER: "azure-openai" };
type AnthropicEnv = Env & { ADO_ASSIST_PROVIDER: "anthropic" };
type GeminiEnv = Env & { ADO_ASSIST_PROVIDER: "gemini" };
type OpenAICompatibleEnv = Env & { ADO_ASSIST_PROVIDER: "openai-compatible" };

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
    return [...DEFAULT_EMPHASIS];
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

function optionalPositiveInteger(env: Env, name: string, defaultValue: number): number {
  const value = env[name]?.trim();
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`${name} must be a positive integer`);
  }

  return parsed;
}

export function loadConfigFromEnv(
  env: OpenAIEnv
): AppConfig & { provider: Extract<ProviderConfig, { kind: "openai" }> };
export function loadConfigFromEnv(
  env: AzureOpenAIEnv
): AppConfig & { provider: Extract<ProviderConfig, { kind: "azure-openai" }> };
export function loadConfigFromEnv(
  env: AnthropicEnv
): AppConfig & { provider: Extract<ProviderConfig, { kind: "anthropic" }> };
export function loadConfigFromEnv(
  env: GeminiEnv
): AppConfig & { provider: Extract<ProviderConfig, { kind: "gemini" }> };
export function loadConfigFromEnv(
  env: OpenAICompatibleEnv
): AppConfig & { provider: Extract<ProviderConfig, { kind: "openai-compatible" }> };
export function loadConfigFromEnv(env?: Env): AppConfig;
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

  if (providerKind === "anthropic") {
    return {
      azureDevOps,
      provider: {
        kind: "anthropic",
        apiKey: requireValue(env, "ADO_ASSIST_ANTHROPIC_API_KEY"),
        model: requireValue(env, "ADO_ASSIST_ANTHROPIC_MODEL"),
        maxTokens: optionalPositiveInteger(env, "ADO_ASSIST_ANTHROPIC_MAX_TOKENS", 4096)
      },
      reviewEmphasis: parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS)
    };
  }

  if (providerKind === "gemini") {
    return {
      azureDevOps,
      provider: {
        kind: "gemini",
        apiKey: requireValue(env, "ADO_ASSIST_GEMINI_API_KEY"),
        model: requireValue(env, "ADO_ASSIST_GEMINI_MODEL")
      },
      reviewEmphasis: parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS)
    };
  }

  if (providerKind === "openai-compatible") {
    return {
      azureDevOps,
      provider: {
        kind: "openai-compatible",
        baseUrl: requireValue(env, "ADO_ASSIST_OPENAI_COMPAT_BASE_URL"),
        model: requireValue(env, "ADO_ASSIST_OPENAI_COMPAT_MODEL"),
        apiKey: env.ADO_ASSIST_OPENAI_COMPAT_API_KEY?.trim() || undefined
      },
      reviewEmphasis: parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS)
    };
  }

  throw new AppError("ADO_ASSIST_PROVIDER must be openai, azure-openai, anthropic, gemini, or openai-compatible");
}

export function loadAzureDevOpsConfigFromEnv(env: Env = process.env): AppConfig["azureDevOps"] {
  return {
    pat: requireValue(env, "ADO_ASSIST_AZURE_DEVOPS_PAT"),
    organization: env.ADO_ASSIST_AZURE_DEVOPS_ORG?.trim() || undefined
  };
}
