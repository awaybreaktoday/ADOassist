import { AppError } from "../errors.js";
import { parseProviderReviewContent } from "./parse.js";
import { providerSystemPrompt } from "./prompt.js";
export class AzureOpenAIReviewProvider {
    apiKey;
    endpoint;
    deployment;
    name;
    constructor(apiKey, endpoint, deployment) {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.deployment = deployment;
        this.name = `azure-openai:${deployment}`;
    }
    async reviewPullRequest(input) {
        const baseUrl = this.endpoint.replace(/\/$/, "");
        const url = `${baseUrl}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions?api-version=2024-06-01`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "api-key": this.apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                temperature: 0.1,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: providerSystemPrompt() },
                    { role: "user", content: JSON.stringify(input) }
                ]
            })
        });
        if (!response.ok) {
            throw new AppError(`Azure OpenAI request failed with ${response.status}`);
        }
        const payload = (await response.json());
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            throw new AppError("Azure OpenAI response did not include review content");
        }
        return parseProviderReviewContent("Azure OpenAI", content);
    }
}
