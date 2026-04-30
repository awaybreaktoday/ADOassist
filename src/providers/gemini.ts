import { AppError } from "../errors.js";
import type { ReviewResult } from "../types.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
import type { ReviewInput, ReviewProvider } from "./types.js";

export class GeminiReviewProvider implements ReviewProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.name = `gemini:${model}`;
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        },
        systemInstruction: {
          parts: [{ text: providerSystemPrompt() }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(input) }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new AppError(`Gemini request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!content) {
      throw new AppError("Gemini response did not include review content");
    }

    return parseProviderReviewContent("Gemini", content);
  }
}
