import { describe, expect, it } from "vitest";
import { buildUserConfigFromAnswers } from "../src/commands/configSetup.js";

describe("buildUserConfigFromAnswers", () => {
  it("builds OpenAI-compatible config", () => {
    expect(
      buildUserConfigFromAnswers({
        organization: "acme",
        providerKind: "openai-compatible",
        openAICompatibleBaseUrl: "http://127.0.0.1:8080/v1",
        model: "local-model",
        outputDir: "/tmp/reviews"
      })
    ).toEqual({
      azureDevOps: { organization: "acme" },
      provider: {
        kind: "openai-compatible",
        baseUrl: "http://127.0.0.1:8080/v1",
        model: "local-model"
      },
      review: {
        emphasis: ["general", "standards", "quality", "risk"],
        outputDir: "/tmp/reviews"
      }
    });
  });

  it("builds Azure OpenAI config", () => {
    expect(
      buildUserConfigFromAnswers({
        organization: "acme",
        providerKind: "azure-openai",
        azureOpenAIEndpoint: "https://example.openai.azure.com",
        azureOpenAIDeployment: "gpt-4.1"
      })
    ).toMatchObject({
      provider: {
        kind: "azure-openai",
        endpoint: "https://example.openai.azure.com",
        deployment: "gpt-4.1"
      }
    });
  });

  it("omits empty optional answers", () => {
    expect(
      buildUserConfigFromAnswers({
        organization: "acme",
        providerKind: "openai",
        model: "gpt-4.1"
      })
    ).toEqual({
      azureDevOps: { organization: "acme" },
      provider: {
        kind: "openai",
        model: "gpt-4.1"
      },
      review: {
        emphasis: ["general", "standards", "quality", "risk"]
      }
    });
  });

  it("rejects unsupported provider choices", () => {
    expect(() =>
      buildUserConfigFromAnswers({
        organization: "acme",
        providerKind: "wat",
        model: "gpt-4.1"
      })
    ).toThrow("Provider must be one of");
  });
});
