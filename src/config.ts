import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform as currentPlatform } from "node:os";
import { dirname, posix, win32 } from "node:path";
import { AppError } from "./errors.js";
import type { AppConfig, AzureDevOpsAuthMode, ProviderConfig, ReviewEmphasis } from "./types.js";

type Env = Record<string, string | undefined>;
type UserProviderConfig =
  | { kind?: "openai"; model?: string; apiKey?: string }
  | { kind?: "azure-openai"; endpoint?: string; deployment?: string; apiKey?: string }
  | { kind?: "anthropic"; model?: string; maxTokens?: number; apiKey?: string }
  | { kind?: "gemini"; model?: string; apiKey?: string }
  | { kind?: "openai-compatible"; baseUrl?: string; model?: string; apiKey?: string };
export interface UserConfig {
  azureDevOps?: {
    organization?: string;
    authMode?: AzureDevOpsAuthMode;
    pat?: string;
  };
  provider?: UserProviderConfig;
  review?: {
    emphasis?: ReviewEmphasis[];
    outputDir?: string;
  };
}
export type ProviderKind = NonNullable<UserProviderConfig["kind"]>;
interface UserConfigPathOptions {
  platform?: NodeJS.Platform;
  env?: Env;
  homeDir?: string;
}
type OpenAIEnv = Env & { ADO_ASSIST_PROVIDER: "openai" };
type AzureOpenAIEnv = Env & { ADO_ASSIST_PROVIDER: "azure-openai" };
type AnthropicEnv = Env & { ADO_ASSIST_PROVIDER: "anthropic" };
type GeminiEnv = Env & { ADO_ASSIST_PROVIDER: "gemini" };
type OpenAICompatibleEnv = Env & { ADO_ASSIST_PROVIDER: "openai-compatible" };

const DEFAULT_EMPHASIS: ReviewEmphasis[] = ["general", "standards", "quality", "risk"];
const VALID_EMPHASIS = new Set<ReviewEmphasis>(["general", "standards", "quality", "risk"]);
const VALID_PROVIDER_KINDS = new Set<ProviderKind>([
  "openai",
  "azure-openai",
  "anthropic",
  "gemini",
  "openai-compatible"
]);
const VALID_AZURE_DEVOPS_AUTH_MODES = new Set<AzureDevOpsAuthMode>(["pat", "bearer"]);
const SAMPLE_USER_CONFIG: UserConfig = {
  azureDevOps: {
    organization: "your-org"
  },
  provider: {
    kind: "openai-compatible",
    baseUrl: "http://127.0.0.1:8080/v1",
    model: "local-model"
  },
  review: {
    emphasis: ["general", "standards", "quality", "risk"]
  }
};

function requireValue(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new AppError(`${name} is required`);
  }
  return value;
}

function firstValue(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function requireResolvedValue(name: string, ...values: Array<string | undefined>): string {
  const value = firstValue(...values);
  if (!value) {
    throw new AppError(`${name} is required`);
  }
  return value;
}

function parseReviewEmphasis(value: string | ReviewEmphasis[] | undefined): ReviewEmphasis[] {
  if (Array.isArray(value)) {
    validateReviewEmphasis(value);
    return [...value];
  }

  if (!value?.trim()) {
    return [...DEFAULT_EMPHASIS];
  }

  const parsed = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  validateReviewEmphasis(parsed);
  return parsed as ReviewEmphasis[];
}

function validateReviewEmphasis(value: string[]): void {
  for (const part of value) {
    if (!VALID_EMPHASIS.has(part as ReviewEmphasis)) {
      throw new AppError(`Invalid ADO_ASSIST_REVIEW_EMPHASIS value: ${part}`);
    }
  }
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
  return loadConfig({}, env);
}

export function loadConfig(userConfig: UserConfig = {}, env: Env = process.env): AppConfig {
  rejectSecretConfig(userConfig);

  const azureDevOps = loadAzureDevOpsConfig(userConfig, env);
  const providerKind = requireResolvedValue(
    "ADO_ASSIST_PROVIDER",
    env.ADO_ASSIST_PROVIDER,
    userConfig.provider?.kind
  );

  if (providerKind === "openai") {
    return {
      azureDevOps,
      provider: {
        kind: "openai",
        apiKey: requireValue(env, "ADO_ASSIST_OPENAI_API_KEY"),
        model: requireResolvedValue(
          "ADO_ASSIST_OPENAI_MODEL",
          env.ADO_ASSIST_OPENAI_MODEL,
          userProviderValue(userConfig, "model")
        )
      },
      reviewEmphasis: loadReviewEmphasis(userConfig, env),
      outputDir: loadOutputDir(userConfig, env)
    };
  }

  if (providerKind === "azure-openai") {
    return {
      azureDevOps,
      provider: {
        kind: "azure-openai",
        apiKey: requireValue(env, "ADO_ASSIST_AZURE_OPENAI_API_KEY"),
        endpoint: requireResolvedValue(
          "ADO_ASSIST_AZURE_OPENAI_ENDPOINT",
          env.ADO_ASSIST_AZURE_OPENAI_ENDPOINT,
          userProviderValue(userConfig, "endpoint")
        ),
        deployment: requireResolvedValue(
          "ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT",
          env.ADO_ASSIST_AZURE_OPENAI_DEPLOYMENT,
          userProviderValue(userConfig, "deployment")
        )
      },
      reviewEmphasis: loadReviewEmphasis(userConfig, env),
      outputDir: loadOutputDir(userConfig, env)
    };
  }

  if (providerKind === "anthropic") {
    return {
      azureDevOps,
      provider: {
        kind: "anthropic",
        apiKey: requireValue(env, "ADO_ASSIST_ANTHROPIC_API_KEY"),
        model: requireResolvedValue(
          "ADO_ASSIST_ANTHROPIC_MODEL",
          env.ADO_ASSIST_ANTHROPIC_MODEL,
          userProviderValue(userConfig, "model")
        ),
        maxTokens: optionalPositiveInteger(
          env,
          "ADO_ASSIST_ANTHROPIC_MAX_TOKENS",
          userProviderNumber(userConfig, "maxTokens") ?? 4096
        )
      },
      reviewEmphasis: loadReviewEmphasis(userConfig, env),
      outputDir: loadOutputDir(userConfig, env)
    };
  }

  if (providerKind === "gemini") {
    return {
      azureDevOps,
      provider: {
        kind: "gemini",
        apiKey: requireValue(env, "ADO_ASSIST_GEMINI_API_KEY"),
        model: requireResolvedValue(
          "ADO_ASSIST_GEMINI_MODEL",
          env.ADO_ASSIST_GEMINI_MODEL,
          userProviderValue(userConfig, "model")
        )
      },
      reviewEmphasis: loadReviewEmphasis(userConfig, env),
      outputDir: loadOutputDir(userConfig, env)
    };
  }

  if (providerKind === "openai-compatible") {
    return {
      azureDevOps,
      provider: {
        kind: "openai-compatible",
        baseUrl: requireResolvedValue(
          "ADO_ASSIST_OPENAI_COMPAT_BASE_URL",
          env.ADO_ASSIST_OPENAI_COMPAT_BASE_URL,
          userProviderValue(userConfig, "baseUrl")
        ),
        model: requireResolvedValue(
          "ADO_ASSIST_OPENAI_COMPAT_MODEL",
          env.ADO_ASSIST_OPENAI_COMPAT_MODEL,
          userProviderValue(userConfig, "model")
        ),
        apiKey: env.ADO_ASSIST_OPENAI_COMPAT_API_KEY?.trim() || undefined
      },
      reviewEmphasis: loadReviewEmphasis(userConfig, env),
      outputDir: loadOutputDir(userConfig, env)
    };
  }

  throw new AppError("ADO_ASSIST_PROVIDER must be openai, azure-openai, anthropic, gemini, or openai-compatible");
}

export function loadAzureDevOpsConfigFromEnv(env: Env = process.env): AppConfig["azureDevOps"] {
  return loadAzureDevOpsConfig({}, env);
}

export function loadAzureDevOpsConfig(userConfig: UserConfig = {}, env: Env = process.env): AppConfig["azureDevOps"] {
  rejectSecretConfig(userConfig);
  const authMode = resolveAzureDevOpsAuthMode(env, userConfig);
  const organization = firstValue(env.ADO_ASSIST_AZURE_DEVOPS_ORG, userConfig.azureDevOps?.organization);

  if (authMode === "bearer") {
    return {
      authMode,
      token: requireResolvedValue(
        "ADO_ASSIST_AZURE_DEVOPS_TOKEN or SYSTEM_ACCESSTOKEN",
        env.ADO_ASSIST_AZURE_DEVOPS_TOKEN,
        env.SYSTEM_ACCESSTOKEN
      ),
      organization
    };
  }

  const pat = requireValue(env, "ADO_ASSIST_AZURE_DEVOPS_PAT");
  return {
    authMode,
    token: pat,
    pat,
    organization
  };
}

export async function loadUserConfigFile(filename = defaultUserConfigPath()): Promise<UserConfig> {
  try {
    await access(filename, constants.F_OK);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const content = await readFile(filename, "utf8");
  return parseUserConfig(content, filename);
}

export async function loadConfigFromFileAndEnv(
  filename = defaultUserConfigPath(),
  env: Env = process.env
): Promise<AppConfig> {
  return loadConfig(await loadUserConfigFile(filename), env);
}

export async function loadAzureDevOpsConfigFromFileAndEnv(
  filename = defaultUserConfigPath(),
  env: Env = process.env
): Promise<AppConfig["azureDevOps"]> {
  return loadAzureDevOpsConfig(await loadUserConfigFile(filename), env);
}

export async function initUserConfig(filename = defaultUserConfigPath()): Promise<string> {
  return writeNewUserConfig(filename, SAMPLE_USER_CONFIG);
}

export async function writeUserConfig(filename: string, config: UserConfig): Promise<string> {
  rejectSecretConfig(config);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  return filename;
}

export async function writeNewUserConfig(filename: string, config: UserConfig): Promise<string> {
  try {
    await access(filename, constants.F_OK);
    throw new AppError(`Config file already exists: ${filename}`);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  return writeUserConfig(filename, config);
}

export function defaultUserConfigPath(options: UserConfigPathOptions = {}): string {
  const runtimePlatform = options.platform ?? currentPlatform();
  const env = options.env ?? process.env;
  const home = options.homeDir ?? homedir();

  if (runtimePlatform === "darwin") {
    return posix.join(home, "Library", "Application Support", "ado-assist", "config.json");
  }

  if (runtimePlatform === "win32") {
    return win32.join(
      env.APPDATA?.trim() || win32.join(home, "AppData", "Roaming"),
      "ado-assist",
      "config.json"
    );
  }

  return posix.join(env.XDG_CONFIG_HOME?.trim() || posix.join(home, ".config"), "ado-assist", "config.json");
}

export function redactConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    azureDevOps: {
      ...config.azureDevOps,
      token: "<redacted>",
      pat: config.azureDevOps.pat === undefined ? undefined : "<redacted>"
    },
    provider: redactProviderConfig(config.provider),
    reviewEmphasis: [...config.reviewEmphasis]
  };
}

function redactProviderConfig(provider: ProviderConfig): ProviderConfig {
  if ("apiKey" in provider && provider.apiKey !== undefined) {
    return { ...provider, apiKey: "<redacted>" } as ProviderConfig;
  }

  return { ...provider };
}

function loadReviewEmphasis(userConfig: UserConfig, env: Env): ReviewEmphasis[] {
  return parseReviewEmphasis(env.ADO_ASSIST_REVIEW_EMPHASIS ?? userConfig.review?.emphasis);
}

function loadOutputDir(userConfig: UserConfig, env: Env): string | undefined {
  return firstValue(env.ADO_ASSIST_OUTPUT_DIR, userConfig.review?.outputDir);
}

function resolveAzureDevOpsAuthMode(env: Env, userConfig: UserConfig): AzureDevOpsAuthMode {
  const authMode = firstValue(env.ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE, userConfig.azureDevOps?.authMode) ?? "pat";
  if (!VALID_AZURE_DEVOPS_AUTH_MODES.has(authMode as AzureDevOpsAuthMode)) {
    throw new AppError("ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE must be pat or bearer");
  }

  return authMode as AzureDevOpsAuthMode;
}

function userProviderValue(userConfig: UserConfig, key: string): string | undefined {
  const provider = userConfig.provider as Record<string, unknown> | undefined;
  const value = provider?.[key];
  return typeof value === "string" ? value : undefined;
}

function userProviderNumber(userConfig: UserConfig, key: string): number | undefined {
  const provider = userConfig.provider as Record<string, unknown> | undefined;
  const value = provider?.[key];
  return typeof value === "number" ? value : undefined;
}

function rejectSecretConfig(config: UserConfig): void {
  if (config.azureDevOps?.pat) {
    throw new AppError("Do not store secrets in the ADO Assist config file");
  }

  const azureDevOps = config.azureDevOps as Record<string, unknown> | undefined;
  if (azureDevOps?.token) {
    throw new AppError("Do not store secrets in the ADO Assist config file");
  }

  const provider = config.provider as Record<string, unknown> | undefined;
  if (provider?.apiKey) {
    throw new AppError("Do not store secrets in the ADO Assist config file");
  }
}

function parseUserConfig(content: string, filename: string): UserConfig {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new AppError(`Config file must contain a JSON object: ${filename}`);
    }

    const config = parsed as UserConfig;
    rejectSecretConfig(config);
    validateUserConfig(config);
    return config;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Unable to parse config file: ${filename}`);
  }
}

function validateUserConfig(config: UserConfig): void {
  if (config.provider?.kind && !VALID_PROVIDER_KINDS.has(config.provider.kind)) {
    throw new AppError("Config provider.kind must be openai, azure-openai, anthropic, gemini, or openai-compatible");
  }

  if (config.review?.emphasis) {
    validateReviewEmphasis(config.review.emphasis);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
