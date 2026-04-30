import { describe, expect, it } from "vitest";
import { createReviewProvider } from "../src/providers/factory.js";
import type { AppConfig } from "../src/types.js";

describe("createReviewProvider", () => {
  it("creates an OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { pat: "pat" },
      provider: { kind: "openai", apiKey: "key", model: "gpt-4.1" },
      reviewEmphasis: ["general"]
    };

    expect(createReviewProvider(config).name).toBe("openai:gpt-4.1");
  });

  it("creates an Azure OpenAI provider", () => {
    const config: AppConfig = {
      azureDevOps: { pat: "pat" },
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
});
