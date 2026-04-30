import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultUserConfigPath,
  initUserConfig,
  loadConfig,
  loadUserConfigFile,
  redactConfig
} from "../src/config.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("defaultUserConfigPath", () => {
  it("uses OS app config locations", () => {
    expect(defaultUserConfigPath({ platform: "darwin", homeDir: "/Users/alex", env: {} })).toBe(
      "/Users/alex/Library/Application Support/ado-assist/config.json"
    );
    expect(
      defaultUserConfigPath({
        platform: "win32",
        homeDir: "C:\\Users\\Alex",
        env: { APPDATA: "C:\\Users\\Alex\\AppData\\Roaming" }
      })
    ).toBe("C:\\Users\\Alex\\AppData\\Roaming\\ado-assist\\config.json");
    expect(defaultUserConfigPath({ platform: "linux", homeDir: "/home/alex", env: {} })).toBe(
      "/home/alex/.config/ado-assist/config.json"
    );
  });
});

describe("loadConfig", () => {
  it("merges non-secret user config with secret environment variables", async () => {
    const config = loadConfig(
      {
        azureDevOps: { organization: "acme" },
        provider: {
          kind: "openai-compatible",
          baseUrl: "http://127.0.0.1:8080/v1",
          model: "local-model"
        },
        review: {
          emphasis: ["risk", "quality"],
          outputDir: "/tmp/ado-assist-reviews"
        }
      },
      {
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat"
      }
    );

    expect(config).toEqual({
      azureDevOps: { pat: "pat", organization: "acme" },
      provider: {
        kind: "openai-compatible",
        baseUrl: "http://127.0.0.1:8080/v1",
        model: "local-model"
      },
      reviewEmphasis: ["risk", "quality"],
      outputDir: "/tmp/ado-assist-reviews"
    });
  });

  it("lets environment variables override user config", () => {
    const config = loadConfig(
      {
        azureDevOps: { organization: "from-config" },
        provider: {
          kind: "openai-compatible",
          baseUrl: "http://config.example/v1",
          model: "config-model"
        },
        review: {
          emphasis: ["quality"],
          outputDir: "/config/reviews"
        }
      },
      {
        ADO_ASSIST_AZURE_DEVOPS_PAT: "pat",
        ADO_ASSIST_AZURE_DEVOPS_ORG: "from-env",
        ADO_ASSIST_PROVIDER: "openai-compatible",
        ADO_ASSIST_OPENAI_COMPAT_BASE_URL: "http://env.example/v1",
        ADO_ASSIST_OPENAI_COMPAT_MODEL: "env-model",
        ADO_ASSIST_REVIEW_EMPHASIS: "risk"
      }
    );

    expect(config.azureDevOps.organization).toBe("from-env");
    expect(config.provider.kind).toBe("openai-compatible");
    if (config.provider.kind !== "openai-compatible") {
      throw new Error("Expected openai-compatible provider");
    }
    expect(config.provider.baseUrl).toBe("http://env.example/v1");
    expect(config.provider.model).toBe("env-model");
    expect(config.reviewEmphasis).toEqual(["risk"]);
    expect(config.outputDir).toBe("/config/reviews");
  });

  it("rejects config files that contain known secret fields", () => {
    expect(() =>
      loadConfig(
        {
          azureDevOps: { pat: "pat", organization: "acme" },
          provider: { kind: "openai", model: "gpt-4.1" }
        },
        {
          ADO_ASSIST_OPENAI_API_KEY: "key"
        }
      )
    ).toThrow("Do not store secrets in the ADO Assist config file");
  });
});

describe("loadUserConfigFile", () => {
  it("loads JSON config files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-config-"));
    const filename = join(tempDir, "config.json");
    await writeFile(filename, JSON.stringify({ azureDevOps: { organization: "acme" } }), "utf8");

    await expect(loadUserConfigFile(filename)).resolves.toEqual({
      azureDevOps: { organization: "acme" }
    });
  });

  it("returns an empty config when the file does not exist", async () => {
    await expect(loadUserConfigFile("/tmp/ado-assist-missing-config.json")).resolves.toEqual({});
  });
});

describe("initUserConfig", () => {
  it("writes a sample non-secret config file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ado-assist-config-"));
    const filename = join(tempDir, "config.json");

    await expect(initUserConfig(filename)).resolves.toBe(filename);
    const content = await readFile(filename, "utf8");

    expect(content).toContain('"organization": "your-org"');
    expect(content).toContain('"kind": "openai-compatible"');
    expect(content).not.toContain('"pat"');
    expect(content).not.toContain("apiKey");
  });
});

describe("redactConfig", () => {
  it("redacts secrets before display", () => {
    expect(
      redactConfig({
        azureDevOps: { pat: "pat", organization: "acme" },
        provider: { kind: "openai", apiKey: "key", model: "gpt-4.1" },
        reviewEmphasis: ["general"]
      })
    ).toEqual({
      azureDevOps: { pat: "<redacted>", organization: "acme" },
      provider: { kind: "openai", apiKey: "<redacted>", model: "gpt-4.1" },
      reviewEmphasis: ["general"]
    });
  });
});
