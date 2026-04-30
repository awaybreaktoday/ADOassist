import { AppError } from "../errors.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
export class OpenAICompatibleReviewProvider {
    baseUrl;
    model;
    apiKey;
    name;
    constructor(baseUrl, model, apiKey) {
        this.baseUrl = baseUrl;
        this.model = model;
        this.apiKey = apiKey;
        this.name = `openai-compatible:${model}`;
    }
    async reviewPullRequest(input) {
        const headers = {
            "Content-Type": "application/json"
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers,
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
            throw new AppError(`OpenAI-compatible request failed with ${response.status}`);
        }
        const payload = (await response.json());
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            throw new AppError("OpenAI-compatible response did not include review content");
        }
        return parseProviderReviewContent("OpenAI-compatible", content);
    }
}
