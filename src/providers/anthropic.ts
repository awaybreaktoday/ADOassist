import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
import type { ReviewInput, ReviewProvider } from "./types.js";

export class AnthropicReviewProvider implements ReviewProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens: number
  ) {
    this.name = `anthropic:${model}`;
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: providerSystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify(input) }]
    };

    if (supportsTemperature(this.model)) {
      body.temperature = 0.1;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new AppError(`Anthropic request failed with ${response.status}${await errorDetails(response)}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
    };
    const content = payload.content?.find((part) => part.type === "text" && part.text)?.text;
    if (!content) {
      throw new AppError("Anthropic response did not include review content");
    }

    if (payload.stop_reason === "max_tokens") {
      throw new AppError(
        "Anthropic response hit max_tokens before completing review JSON. Increase ADO_ASSIST_ANTHROPIC_MAX_TOKENS, for example to 8192 or 12000."
      );
    }

    return parseProviderReviewContent("Anthropic", content);
  }
}

function supportsTemperature(model: string): boolean {
  return model !== "claude-opus-4-7";
}

async function errorDetails(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return "";
  }

  try {
    const payload = JSON.parse(text) as { error?: { message?: unknown } };
    if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
      return `: ${payload.error.message.trim()}`;
    }
  } catch {
    // Fall through to the raw body below.
  }

  return `: ${text.trim()}`;
}
