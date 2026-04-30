import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
import type { ReviewInput, ReviewProvider } from "./types.js";

export class OpenAIReviewProvider implements ReviewProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.name = `openai:${model}`;
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: providerSystemPrompt() },
          { role: "user", content: JSON.stringify(input) }
        ]
      })
    });

    if (!response.ok) {
      throw new AppError(`OpenAI request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("OpenAI response did not include review content");
    }

    return parseProviderReviewContent("OpenAI", content);
  }
}
