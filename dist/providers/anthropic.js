import { AppError } from "../errors.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
export class AnthropicReviewProvider {
    apiKey;
    model;
    maxTokens;
    name;
    constructor(apiKey, model, maxTokens) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.name = `anthropic:${model}`;
    }
    async reviewPullRequest(input) {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
                "x-api-key": this.apiKey
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: 0.1,
                system: providerSystemPrompt(),
                messages: [{ role: "user", content: JSON.stringify(input) }]
            })
        });
        if (!response.ok) {
            throw new AppError(`Anthropic request failed with ${response.status}`);
        }
        const payload = (await response.json());
        const content = payload.content?.find((part) => part.type === "text" && part.text)?.text;
        if (!content) {
            throw new AppError("Anthropic response did not include review content");
        }
        return parseProviderReviewContent("Anthropic", content);
    }
}
