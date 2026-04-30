import { describe, expect, it, vi } from "vitest";
import { AnthropicReviewProvider } from "../src/providers/anthropic.js";
import { AzureOpenAIReviewProvider } from "../src/providers/azureOpenAI.js";
import { GeminiReviewProvider } from "../src/providers/gemini.js";
import { OpenAICompatibleReviewProvider } from "../src/providers/openAICompatible.js";
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
    expect(body.messages[0].content).toContain("Use filePath and line together for inline comments");
    expect(body.messages[0].content).toContain('"summary": "string"');
    expect(body.messages[0].content).toContain('"comments": [');
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
    expect(body.messages[0].content).toContain("Use filePath and line together for inline comments");
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

describe("AnthropicReviewProvider", () => {
  it("sends the expected Anthropic messages request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicReviewProvider("key", "claude-3-5-sonnet-latest", 4096);
    const result = await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(result).toEqual(sampleReview);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          "x-api-key": "key"
        }
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("claude-3-5-sonnet-latest");
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toContain("Use filePath and line together for inline comments");
    expect(body.messages).toEqual([
      {
        role: "user",
        content: JSON.stringify({ pullRequest: sampleContext, rubric: "rubric" })
      }
    ]);
  });

  it("normalizes malformed JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse("{not json")));

    const provider = new AnthropicReviewProvider("key", "claude-3-5-sonnet-latest", 4096);
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "Anthropic response included invalid review JSON"
    );
  });

  it("reports missing review content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [] }) }));

    const provider = new AnthropicReviewProvider("key", "claude-3-5-sonnet-latest", 4096);
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "Anthropic response did not include review content"
    );
  });
});

describe("GeminiReviewProvider", () => {
  it("sends the expected Gemini generateContent request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiReviewProvider("key", "gemini-1.5-pro");
    const result = await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(result).toEqual(sampleReview);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": "key"
        }
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).toEqual({
      responseMimeType: "application/json",
      temperature: 0.1
    });
    expect(body.systemInstruction.parts[0].text).toContain("Use filePath and line together for inline comments");
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [{ text: JSON.stringify({ pullRequest: sampleContext, rubric: "rubric" }) }]
      }
    ]);
  });

  it("normalizes malformed JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("{not json")));

    const provider = new GeminiReviewProvider("key", "gemini-1.5-pro");
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "Gemini response included invalid review JSON"
    );
  });

  it("reports missing review content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }));

    const provider = new GeminiReviewProvider("key", "gemini-1.5-pro");
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "Gemini response did not include review content"
    );
  });
});

describe("OpenAICompatibleReviewProvider", () => {
  it("sends the expected OpenAI-compatible chat completion request without auth when no key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleReviewProvider("http://127.0.0.1:8080/v1/", "local-model");
    const result = await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(result).toEqual(sampleReview);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("local-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Use filePath and line together for inline comments");
  });

  it("sends authorization when an OpenAI-compatible API key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(JSON.stringify(sampleReview)));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleReviewProvider("http://127.0.0.1:8080/v1", "local-model", "key");
    await provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer key",
      "Content-Type": "application/json"
    });
  });

  it("normalizes malformed JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("{not json")));

    const provider = new OpenAICompatibleReviewProvider("http://127.0.0.1:8080/v1", "local-model");
    await expect(provider.reviewPullRequest({ pullRequest: sampleContext, rubric: "rubric" })).rejects.toThrow(
      "OpenAI-compatible response included invalid review JSON"
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

function anthropicResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: "text", text: content }]
    })
  } as Response;
}

function geminiResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: content }] } }]
    })
  } as Response;
}
