import { homedir, platform as currentPlatform } from "node:os";
import { posix, win32 } from "node:path";
export function resolveReviewOutputDir(explicitOutputDir, options = {}) {
    const explicit = explicitOutputDir?.trim();
    if (explicit) {
        return explicit;
    }
    const env = options.env ?? process.env;
    const configured = env.ADO_ASSIST_OUTPUT_DIR?.trim();
    if (configured) {
        return configured;
    }
    return defaultReviewOutputDir(options);
}
export function defaultReviewOutputDir(options = {}) {
    const runtimePlatform = options.platform ?? currentPlatform();
    const env = options.env ?? process.env;
    const home = options.homeDir ?? homedir();
    if (runtimePlatform === "darwin") {
        return posix.join(home, "Library", "Application Support", "ado-assist", "reviews");
    }
    if (runtimePlatform === "win32") {
        return win32.join(env.LOCALAPPDATA?.trim() || env.APPDATA?.trim() || win32.join(home, "AppData", "Local"), "ado-assist", "reviews");
    }
    return posix.join(env.XDG_DATA_HOME?.trim() || posix.join(home, ".local", "share"), "ado-assist", "reviews");
}
