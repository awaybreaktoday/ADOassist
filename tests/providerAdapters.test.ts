import { describe, expect, it, vi } from "vitest";
import { AzureOpenAIReviewProvider } from "../src/providers/azureOpenAI.js";
import { OpenAIReviewProvider } from "../src/providers/openai.js";
import { sampleContext, sampleReview } from "./fixtures/sampleReview.js";

describe("OpenAIReviewProvider", () => {
  it("sends the expected OpenAI chat completion request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIReviewProvider("key", "gpt-4.1");
    const result = await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(result).toEqual(sampleReview);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer key",
          "Content-Type": "application/json"
        }
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-4.1");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: JSON.stringify({ pullRequest: sampleContext, rubric: "rubric" })
    });
  });

  it("normalizes malformed JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("{not json")));

    const provider = new OpenAIReviewProvider("key", "gpt-4.1");
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "OpenAI response included invalid review JSON"
    );
  });
});

describe("AzureOpenAIReviewProvider", () => {
  it("sends the expected Azure OpenAI chat completion request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AzureOpenAIReviewProvider("key", "https://example.openai.azure.com/", "gpt/4.1");
    const result = await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(result).toEqual(sampleReview);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.openai.azure.com/openai/deployments/gpt%2F4.1/chat/completions?api-version=2024-06-01",
      expect.objectContaining({
        method: "POST",
        headers: {
          "api-key": "key",
          "Content-Type": "application/json"
        }
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: JSON.stringify({ pullRequest: sampleContext, rubric: "rubric" })
    });
  });

  it("normalizes malformed JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("{not json")));

    const provider = new AzureOpenAIReviewProvider("key", "https://example.openai.azure.com", "gpt-4.1");
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "Azure OpenAI response included invalid review JSON"
    );
  });
});

function okResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }]
    })
  } as Response;
}
