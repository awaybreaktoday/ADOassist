import { readFile } from "node:fs/promises";
import { parseReviewDraft } from "../drafts/parse.js";
export async function postReviewDraft(options) {
    const parsed = parseReviewDraft(options.markdown);
    await options.client.postComments(parsed.pr, parsed.comments);
    return parsed.comments.length;
}
export async function postReviewDraftFile(path, client) {
    const markdown = await readFile(path, "utf8");
    return postReviewDraft({ markdown, client });
}
