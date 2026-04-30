import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeUserConfig } from "../config.js";
import { AppError } from "../errors.js";
const DEFAULT_EMPHASIS = ["general", "standards", "quality", "risk"];
const PROVIDER_KINDS = [
    "openai-compatible",
    "openai",
    "azure-openai",
    "anthropic",
    "gemini"
];
export async function runConfigSetup(filename) {
    const rl = createInterface({ input, output });
    try {
        console.log("ADO Assist config setup");
        console.log("This writes non-secret defaults only. Keep PATs and API keys in environment variables.");
        console.log("");
        const providerKind = await ask(rl, `Provider (${PROVIDER_KINDS.join(", ")})`, "openai-compatible");
        const answers = {
            organization: await ask(rl, "Azure DevOps organization"),
            providerKind
        };
        if (providerKind === "openai-compatible") {
            answers.openAICompatibleBaseUrl = await ask(rl, "OpenAI-compatible base URL", "http://127.0.0.1:8080/v1");
            answers.model = await ask(rl, "Model", "local-model");
        }
        else if (providerKind === "azure-openai") {
            answers.azureOpenAIEndpoint = await ask(rl, "Azure OpenAI endpoint");
            answers.azureOpenAIDeployment = await ask(rl, "Azure OpenAI deployment");
        }
        else if (providerKind === "anthropic") {
            answers.model = await ask(rl, "Anthropic model", "claude-3-5-sonnet-latest");
        }
        else if (providerKind === "gemini") {
            answers.model = await ask(rl, "Gemini model", "gemini-1.5-pro");
        }
        else {
            answers.model = await ask(rl, "OpenAI model", "gpt-4.1");
        }
        answers.outputDir = await ask(rl, "Review draft output directory (blank for OS default)");
        return writeUserConfig(filename, buildUserConfigFromAnswers(answers));
    }
    finally {
        rl.close();
    }
}
export function buildUserConfigFromAnswers(answers) {
    const providerKind = normalizeProviderKind(answers.providerKind);
    const config = {
        azureDevOps: {
            organization: required("Azure DevOps organization", answers.organization)
        },
        provider: buildProviderConfig(providerKind, answers),
        review: {
            emphasis: [...DEFAULT_EMPHASIS]
        }
    };
    const outputDir = answers.outputDir?.trim();
    if (outputDir) {
        config.review = { ...config.review, outputDir };
    }
    return config;
}
function buildProviderConfig(providerKind, answers) {
    if (providerKind === "openai-compatible") {
        return {
            kind: providerKind,
            baseUrl: required("OpenAI-compatible base URL", answers.openAICompatibleBaseUrl),
            model: required("Model", answers.model)
        };
    }
    if (providerKind === "azure-openai") {
        return {
            kind: providerKind,
            endpoint: required("Azure OpenAI endpoint", answers.azureOpenAIEndpoint),
            deployment: required("Azure OpenAI deployment", answers.azureOpenAIDeployment)
        };
    }
    return {
        kind: providerKind,
        model: required("Model", answers.model)
    };
}
function normalizeProviderKind(value) {
    const normalized = value.trim();
    if (PROVIDER_KINDS.includes(normalized)) {
        return normalized;
    }
    throw new AppError(`Provider must be one of: ${PROVIDER_KINDS.join(", ")}`);
}
async function ask(rl, prompt, defaultValue) {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
    return answer || defaultValue || "";
}
function required(label, value) {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new AppError(`${label} is required`);
    }
    return trimmed;
}
