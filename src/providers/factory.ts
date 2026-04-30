import type { AppConfig } from "../types.js";
import { AnthropicReviewProvider } from "./anthropic.js";
import { AzureOpenAIReviewProvider } from "./azureOpenAI.js";
import { GeminiReviewProvider } from "./gemini.js";
import { OpenAICompatibleReviewProvider } from "./openAICompatible.js";
import { OpenAIReviewProvider } from "./openai.js";
import type { ReviewProvider } from "./types.js";

export function createReviewProvider(config: AppConfig): ReviewProvider {
  if (config.provider.kind === "openai") {
    return new OpenAIReviewProvider(config.provider.apiKey, config.provider.model);
  }

  if (config.provider.kind === "azure-openai") {
    return new AzureOpenAIReviewProvider(
      config.provider.apiKey,
      config.provider.endpoint,
      config.provider.deployment
    );
  }

  if (config.provider.kind === "anthropic") {
    return new AnthropicReviewProvider(config.provider.apiKey, config.provider.model, config.provider.maxTokens);
  }

  if (config.provider.kind === "gemini") {
    return new GeminiReviewProvider(config.provider.apiKey, config.provider.model);
  }

  return new OpenAICompatibleReviewProvider(
    config.provider.baseUrl,
    config.provider.model,
    config.provider.apiKey
  );
}
