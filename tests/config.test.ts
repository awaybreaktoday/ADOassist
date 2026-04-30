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
