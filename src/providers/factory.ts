import type { AppConfig } from "../types.js";
import { AzureOpenAIReviewProvider } from "./azureOpenAI.js";
import { OpenAIReviewProvider } from "./openai.js";
import type { ReviewProvider } from "./types.js";

export function createReviewProvider(config: AppConfig): ReviewProvider {
  if (config.provider.kind === "openai") {
    return new OpenAIReviewProvider(config.provider.apiKey, config.provider.model);
  }

  return new AzureOpenAIReviewProvider(
    config.provider.apiKey,
    config.provider.endpoint,
    config.provider.deployment
  );
}
