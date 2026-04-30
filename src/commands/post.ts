import { readFile } from "node:fs/promises";
import { parseReviewDraft } from "../drafts/parse.js";
import type { PullRequestRef, ReviewComment } from "../types.js";

export interface PostClient {
  postComments(ref: PullRequestRef, comments: ReviewComment[]): Promise<void>;
}

export interface PostReviewDraftOptions {
  markdown: string;
  client: PostClient;
}

export async function postReviewDraft(options: PostReviewDraftOptions): Promise<number> {
  const parsed = parseReviewDraft(options.markdown);
  await options.client.postComments(parsed.pr, parsed.comments);
  return parsed.comments.length;
}

export async function postReviewDraftFile(path: string, client: PostClient): Promise<number> {
  const markdown = await readFile(path, "utf8");
  return postReviewDraft({ markdown, client });
}
