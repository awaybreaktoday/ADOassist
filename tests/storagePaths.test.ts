import { describe, expect, it } from "vitest";
import { defaultReviewOutputDir, resolveReviewOutputDir } from "../src/storage/paths.js";

describe("defaultReviewOutputDir", () => {
  it("uses Application Support on macOS", () => {
    expect(defaultReviewOutputDir({ platform: "darwin", homeDir: "/Users/alex", env: {} })).toBe(
      "/Users/alex/Library/Application Support/ado-assist/reviews"
    );
  });

  it("uses LOCALAPPDATA on Windows", () => {
    expect(
      defaultReviewOutputDir({
        platform: "win32",
        homeDir: "C:\\Users\\Alex",
        env: { LOCALAPPDATA: "C:\\Users\\Alex\\AppData\\Local" }
      })
    ).toBe("C:\\Users\\Alex\\AppData\\Local\\ado-assist\\reviews");
  });

  it("uses XDG_DATA_HOME on Linux when configured", () => {
    expect(
      defaultReviewOutputDir({
        platform: "linux",
        homeDir: "/home/alex",
        env: { XDG_DATA_HOME: "/home/alex/.data" }
      })
    ).toBe("/home/alex/.data/ado-assist/reviews");
  });

  it("falls back to ~/.local/share on Linux", () => {
    expect(defaultReviewOutputDir({ platform: "linux", homeDir: "/home/alex", env: {} })).toBe(
      "/home/alex/.local/share/ado-assist/reviews"
    );
  });
});

describe("resolveReviewOutputDir", () => {
  it("prefers explicit CLI output", () => {
    expect(
      resolveReviewOutputDir("./reviews", {
        platform: "linux",
        homeDir: "/home/alex",
        env: { ADO_ASSIST_OUTPUT_DIR: "/tmp/ado-assist" }
      })
    ).toBe("./reviews");
  });

  it("uses ADO_ASSIST_OUTPUT_DIR when no CLI output is provided", () => {
    expect(
      resolveReviewOutputDir(undefined, {
        platform: "linux",
        homeDir: "/home/alex",
        env: { ADO_ASSIST_OUTPUT_DIR: "/tmp/ado-assist" }
      })
    ).toBe("/tmp/ado-assist");
  });
});
