import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createCli } from "../src/cli.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

describe("createCli", () => {
  it("reports the package version", () => {
    let output = "";
    const program = createCli()
      .exitOverride()
      .configureOutput({
        writeOut: (value) => {
          output += value;
        }
      });

    expect(() => program.parse(["node", "ado-assist", "--version"])).toThrow();
    expect(output.trim()).toBe(packageJson.version);
  });
});
