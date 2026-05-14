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
    expect(config.azureDevOps.authMode).toBe("pat");
    expect(config.azureDevOps.token).toBe("pat");
    expect(config.provider.kind).toBe("openai");
    expect(config.provider.model).toBe("gpt-4.1");
    expect(config.reviewEmphasis).toEqual(["general", "standards", "quality", "risk"]);
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

  it("loads Anthropic configuration", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "anthropic",
      ADO_ASSIST_ANTHROPIC_API_KEY: "anthropic-key",
      ADO_ASSIST_ANTHROPIC_MODEL: "claude-3-5-sonnet-latest"
    });

    expect(config.provider.kind).toBe("anthropic");
    expect(config.provider.model).toBe("claude-3-5-sonnet-latest");
    expect(config.provider.maxTokens).toBe(8192);
  });

  it("loads Gemini configuration", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "gemini",
      ADO_ASSIST_GEMINI_API_KEY: "gemini-key",
      ADO_ASSIST_GEMINI_MODEL: "gemini-1.5-pro"
    });

    expect(config.provider.kind).toBe("gemini");
    expect(config.provider.model).toBe("gemini-1.5-pro");
  });

  it("loads OpenAI-compatible configuration", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "openai-compatible",
      ADO_ASSIST_OPENAI_COMPAT_BASE_URL: "http://127.0.0.1:8080/v1",
      ADO_ASSIST_OPENAI_COMPAT_MODEL: "local-model",
      ADO_ASSIST_OPENAI_COMPAT_API_KEY: "optional-key"
    });

    expect(config.provider.kind).toBe("openai-compatible");
    expect(config.provider.baseUrl).toBe("http://127.0.0.1:8080/v1");
    expect(config.provider.model).toBe("local-model");
    expect(config.provider.apiKey).toBe("optional-key");
  });

  it("loads Azure DevOps bearer auth from System.AccessToken for pipeline runs", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE: "bearer",
      SYSTEM_ACCESSTOKEN: "system-token",
      ADO_ASSIST_PROVIDER: "openai",
      ADO_ASSIST_OPENAI_API_KEY: "openai-key",
      ADO_ASSIST_OPENAI_MODEL: "gpt-4.1"
    });

    expect(config.azureDevOps).toMatchObject({
      authMode: "bearer",
      token: "system-token"
    });
    expect(config.azureDevOps.pat).toBeUndefined();
  });

  it("loads Azure DevOps bearer auth from the explicit token variable", () => {
    const config = loadAzureDevOpsConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE: "bearer",
      ADO_ASSIST_AZURE_DEVOPS_TOKEN: "bearer-token",
      ADO_ASSIST_AZURE_DEVOPS_ORG: "acme"
    });

    expect(config).toEqual({
      authMode: "bearer",
      token: "bearer-token",
      organization: "acme"
    });
  });

  it("rejects missing Azure DevOps PAT in PAT auth mode", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_PROVIDER: "openai",
        ADO_ASSIST_OPENAI_API_KEY: "openai-key",
        ADO_ASSIST_OPENAI_MODEL: "gpt-4.1"
      })
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_PAT is required");
  });

  it("rejects missing Azure DevOps bearer token in bearer auth mode", () => {
    expect(() =>
      loadAzureDevOpsConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE: "bearer"
      })
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_TOKEN or SYSTEM_ACCESSTOKEN is required");
  });

  it("rejects unsupported Azure DevOps auth modes", () => {
    expect(() =>
      loadAzureDevOpsConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE: "oauth",
        ADO_ASSIST_AZURE_DEVOPS_TOKEN: "token"
      })
    ).toThrow("ADO_ASSIST_AZURE_DEVOPS_AUTH_MODE must be pat or bearer");
  });

  it("loads Azure DevOps-only configuration for posting", () => {
    const config = loadAzureDevOpsConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_AZURE_DEVOPS_ORG: "acme"
    });

    expect(config).toEqual({ authMode: "pat", token: "pat", pat: "pat", organization: "acme" });
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

  it("rejects incomplete Anthropic configuration", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "anthropic",
        ADO_ASSIST_ANTHROPIC_API_KEY: "anthropic-key"
      })
    ).toThrow("ADO_ASSIST_ANTHROPIC_MODEL is required");
  });

  it("rejects invalid Anthropic max tokens", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "anthropic",
        ADO_ASSIST_ANTHROPIC_API_KEY: "anthropic-key",
        ADO_ASSIST_ANTHROPIC_MODEL: "claude-3-5-sonnet-latest",
        ADO_ASSIST_ANTHROPIC_MAX_TOKENS: "zero"
      })
    ).toThrow("ADO_ASSIST_ANTHROPIC_MAX_TOKENS must be a positive integer");
  });

  it("rejects incomplete Gemini configuration", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "gemini",
        ADO_ASSIST_GEMINI_API_KEY: "gemini-key"
      })
    ).toThrow("ADO_ASSIST_GEMINI_MODEL is required");
  });

  it("rejects incomplete OpenAI-compatible configuration", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "openai-compatible",
        ADO_ASSIST_OPENAI_COMPAT_BASE_URL: "http://127.0.0.1:8080/v1"
      })
    ).toThrow("ADO_ASSIST_OPENAI_COMPAT_MODEL is required");
  });

  it("rejects unknown providers with the supported provider list", () => {
    expect(() =>
      loadConfigFromEnv({
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_PROVIDER: "unknown"
      })
    ).toThrow("ADO_ASSIST_PROVIDER must be openai, azure-openai, anthropic, gemini, or openai-compatible");
  });

  it("parses custom review emphasis", () => {
    const config = loadConfigFromEnv({
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "openai",
      ADO_ASSIST_OPENAI_API_KEY: "openai-key",
      ADO_ASSIST_OPENAI_MODEL: "gpt-4.1",
      ADO_ASSIST_REVIEW_EMPHASIS: "risk,quality,standards"
    });

    expect(config.reviewEmphasis).toEqual(["risk", "quality", "standards"]);
  });

  it("returns a fresh default review emphasis array", () => {
    const env = {
      ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
      ADO_ASSIST_PROVIDER: "openai",
      ADO_ASSIST_OPENAI_API_KEY: "openai-key",
      ADO_ASSIST_OPENAI_MODEL: "gpt-4.1"
    } as const;

    const first = loadConfigFromEnv(env);
    first.reviewEmphasis.push("risk");

    const second = loadConfigFromEnv(env);
    expect(second.reviewEmphasis).toEqual(["general", "standards", "quality", "risk"]);
  });
});
