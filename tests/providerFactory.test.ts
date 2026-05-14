import { describe, expect, it } from "vitest";
import { createReviewProvider } from "../src/providers/factory.js";
import type { AppConfig } from "../src/types.js";

describe("createReviewProvider", () => {
  it("creates an OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
      provider: { kind: "openai", apiKey: "key", model: "gpt-4.1" },
      reviewEmphasis: ["general"]
    };

    expect(createReviewProvider(config).name).toBe("openai:gpt-4.1");
  });

  it("creates an Azure OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
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

  it("creates an Anthropic provider", () => {
    const config: AppConfig = {
      azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
      provider: {
        kind: "anthropic",
        apiKey: "key",
        model: "claude-3-5-sonnet-latest",
        maxTokens: 4096
      },
      reviewEmphasis: ["risk"]
    };

    expect(createReviewProvider(config).name).toBe("anthropic:claude-3-5-sonnet-latest");
  });

  it("creates a Gemini provider", () => {
    const config: AppConfig = {
      azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
      provider: { kind: "gemini", apiKey: "key", model: "gemini-1.5-pro" },
      reviewEmphasis: ["standards"]
    };

    expect(createReviewProvider(config).name).toBe("gemini:gemini-1.5-pro");
  });

  it("creates an OpenAI-compatible provider", () => {
    const config: AppConfig = {
      azureDevOps: { authMode: "pat", token: "pat", pat: "pat" },
      provider: {
        kind: "openai-compatible",
        baseUrl: "http://127.0.0.1:8080/v1",
        model: "local-model"
      },
      reviewEmphasis: ["general"]
    };

    expect(createReviewProvider(config).name).toBe("openai-compatible:local-model");
  });
});
