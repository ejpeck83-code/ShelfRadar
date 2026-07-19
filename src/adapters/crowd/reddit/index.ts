import { createHash } from "node:crypto";
import { z } from "zod";
import type { AdapterCapability, AdapterContext, AdapterResult } from "@/domain/adapters";

export const REDDIT_PARSER_VERSION = "reddit-v1";
export const DEFAULT_REDDIT_COMMUNITIES = ["TMNT", "NECATMNT", "ActionFigures", "RossFinds"] as const;

const redditPostSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(140).optional(),
  subreddit: z.string().min(1).max(100),
  title: z.string().max(1_000),
  selftext: z.string().max(100_000).optional().default(""),
  permalink: z.string().startsWith("/r/").max(1_000),
  created_utc: z.number().finite().nonnegative(),
  author: z.string().max(120).optional(),
  url_overridden_by_dest: z.string().url().max(2_000).optional(),
  post_hint: z.string().max(80).optional(),
  crosspost_parent: z.string().max(140).optional(),
  removed_by_category: z.string().nullable().optional()
});

const redditListingSchema = z.object({
  kind: z.literal("Listing"),
  data: z.object({
    after: z.string().nullable(),
    children: z.array(z.object({ kind: z.literal("t3"), data: redditPostSchema })).max(250)
  })
});

export const rawCrowdPostSchema = z.object({
  externalPostId: z.string().min(1).max(128),
  fullname: z.string().min(1).max(140),
  permalink: z.url(),
  community: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  bodyExcerpt: z.string().max(500).optional(),
  authorDisplay: z.string().max(120).optional(),
  postedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  parentOrCrosspostId: z.string().max(140).optional(),
  mediaEvidence: z.enum(["NONE", "PHOTO_LINK", "VIDEO_LINK", "UNKNOWN"]),
  mediaUrl: z.url().optional(),
  contentHash: z.string().length(64),
  provenance: z.object({
    sourceKey: z.literal("reddit"),
    externalId: z.string().min(1),
    fetchedAt: z.iso.datetime(),
    parserVersion: z.literal(REDDIT_PARSER_VERSION),
    rawRef: z.string().min(1).max(300)
  })
});

export type RawCrowdPost = z.infer<typeof rawCrowdPostSchema>;
export type CrowdQuery = { terms: string[]; checkpoint?: string; pageLimit: number; pageSize?: number };

export interface CrowdSourceAdapter {
  readonly sourceKey: string;
  readonly capabilities: readonly AdapterCapability[];
  fetchPosts(query: CrowdQuery, context: AdapterContext): Promise<AdapterResult<RawCrowdPost>>;
}

export type RedditPageResponse =
  | { kind: "success"; payload: unknown }
  | { kind: "unavailable"; reason: string; retryAfter?: string }
  | { kind: "throttled"; retryAfter?: string };

export interface RedditApprovedAccessClient {
  fetchPage(input: { communities: readonly string[]; terms: readonly string[]; after?: string; limit: number }, context: AdapterContext): Promise<RedditPageResponse>;
}

type RedditAdapterOptions = {
  mode: "fixture" | "unavailable" | "oauth";
  communities?: readonly string[];
  fixturePages?: readonly unknown[];
  client?: RedditApprovedAccessClient;
  maxPagesPerRun?: number;
  requestTimeoutMs?: number;
};

type ParsedPage = { result: AdapterResult<RawCrowdPost>; after: string | null; fullnames: string[] };

export function sanitizeCrowdText(value: string, maxLength: number): string {
  return value
    .replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function authorHash(author: string | undefined): string | undefined {
  if (!author || author === "[deleted]") return undefined;
  return `author:${hash(author.toLowerCase()).slice(0, 12)}`;
}

function mediaEvidence(data: z.infer<typeof redditPostSchema>): Pick<RawCrowdPost, "mediaEvidence" | "mediaUrl"> {
  const url = data.url_overridden_by_dest;
  if (!url) return { mediaEvidence: "NONE" };
  if (data.post_hint === "image" || /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(url) || /\/i\.redd\.it\//i.test(url)) {
    return { mediaEvidence: "PHOTO_LINK", mediaUrl: url };
  }
  if (data.post_hint === "hosted:video" || /\.(?:mp4|mov|webm)(?:\?|$)/i.test(url)) return { mediaEvidence: "VIDEO_LINK", mediaUrl: url };
  return { mediaEvidence: "UNKNOWN", mediaUrl: url };
}

function parsePage(payload: unknown, fetchedAt: Date): ParsedPage {
  const parsed = redditListingSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      result: { kind: "malformed", reason: "Reddit payload failed adapter-local validation", rawRef: "redacted:reddit-validation-error" },
      after: null,
      fullnames: []
    };
  }

  const items: RawCrowdPost[] = [];
  const fullnames: string[] = [];
  for (const child of parsed.data.data.children) {
    const data = child.data;
    const fullname = data.name ?? `t3_${data.id}`;
    fullnames.push(fullname);
    if (data.removed_by_category || data.title === "[deleted]" || data.selftext === "[removed]") continue;
    const title = sanitizeCrowdText(data.title, 500);
    if (!title) continue;
    const bodyExcerpt = sanitizeCrowdText(data.selftext, 500);
    const hashedAuthor = authorHash(data.author);
    const postedAt = new Date(data.created_utc * 1_000).toISOString();
    const media = mediaEvidence(data);
    const contentHash = hash(`${title.toLowerCase()}\n${bodyExcerpt.toLowerCase()}\n${media.mediaUrl ?? ""}`);
    const candidate: RawCrowdPost = {
      externalPostId: data.id,
      fullname,
      permalink: `https://www.reddit.com${data.permalink}`,
      community: data.subreddit,
      title,
      ...(bodyExcerpt ? { bodyExcerpt } : {}),
      ...(hashedAuthor ? { authorDisplay: hashedAuthor } : {}),
      postedAt,
      fetchedAt: fetchedAt.toISOString(),
      ...(data.crosspost_parent ? { parentOrCrosspostId: data.crosspost_parent } : {}),
      ...media,
      contentHash,
      provenance: {
        sourceKey: "reddit",
        externalId: data.id,
        fetchedAt: fetchedAt.toISOString(),
        parserVersion: REDDIT_PARSER_VERSION,
        rawRef: `sha256:${hash(`${data.id}:${fullname}:${postedAt}`)}`
      }
    };
    const validated = rawCrowdPostSchema.safeParse(candidate);
    if (!validated.success) {
      return { result: { kind: "malformed", reason: "Reddit post failed canonical crowd validation", rawRef: "redacted:reddit-post-validation-error" }, after: null, fullnames: [] };
    }
    items.push(validated.data);
  }
  return { result: { kind: "success", items, fetchedAt: fetchedAt.toISOString() }, after: parsed.data.data.after, fullnames };
}

export function parseRedditPage(payload: unknown, fetchedAt: Date): AdapterResult<RawCrowdPost> {
  return parsePage(payload, fetchedAt).result;
}

export function encodeRedditCheckpoint(fullname: string): string {
  return `reddit:v1:${fullname}`;
}

function decodeRedditCheckpoint(checkpoint: string | undefined): string | undefined {
  if (!checkpoint) return undefined;
  const match = /^reddit:v1:(t3_[A-Za-z0-9_-]+)$/.exec(checkpoint);
  return match?.[1];
}

export class RedditCrowdAdapter implements CrowdSourceAdapter {
  readonly sourceKey = "reddit";
  readonly capabilities = ["crowd_posts"] as const;
  readonly communities: readonly string[];
  private readonly maxPagesPerRun: number;
  private readonly requestTimeoutMs: number;

  constructor(private readonly options: RedditAdapterOptions) {
    this.communities = boundedUnique(options.communities ?? DEFAULT_REDDIT_COMMUNITIES, 20, "communities");
    this.maxPagesPerRun = Math.max(1, Math.min(20, options.maxPagesPerRun ?? 5));
    this.requestTimeoutMs = Math.max(100, Math.min(60_000, options.requestTimeoutMs ?? 15_000));
  }

  async fetchPosts(query: CrowdQuery, context: AdapterContext): Promise<AdapterResult<RawCrowdPost>> {
    if (context.signal.aborted) return { kind: "unavailable", reason: "Reddit request aborted" };
    if (!Number.isInteger(query.pageLimit) || query.pageLimit < 1) return { kind: "malformed", reason: "pageLimit must be a positive integer" };
    let terms: string[];
    try {
      terms = boundedUnique(query.terms, 100, "query terms");
    } catch {
      return { kind: "malformed", reason: "Reddit query terms exceed the configured bound" };
    }
    if (this.options.mode === "unavailable") return { kind: "unavailable", reason: "Reddit approved access is not configured; cached sightings remain visible" };
    if (this.options.mode === "oauth" && !this.options.client) return { kind: "unavailable", reason: "Reddit OAuth mode selected without an approved-access client" };

    const priorCheckpoint = decodeRedditCheckpoint(query.checkpoint);
    if (query.checkpoint && !priorCheckpoint) return { kind: "malformed", reason: "Reddit checkpoint is invalid" };
    const pageCount = Math.min(query.pageLimit, this.maxPagesPerRun);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 100));
    const items: RawCrowdPost[] = [];
    let after: string | undefined;
    let newestFullname: string | undefined;
    let fixtureIndex = 0;

    for (let page = 0; page < pageCount; page += 1) {
      let response: RedditPageResponse;
      if (this.options.mode === "fixture") {
        const payload = this.options.fixturePages?.[fixtureIndex];
        fixtureIndex += 1;
        if (payload === undefined) break;
        response = { kind: "success", payload };
      } else {
        response = await withTimeout(
          this.options.client!.fetchPage({ communities: this.communities, terms, ...(after ? { after } : {}), limit: pageSize }, context),
          this.requestTimeoutMs,
          context.signal
        );
      }
      if (response.kind !== "success") return response;
      const parsed = parsePage(response.payload, context.now);
      if (parsed.result.kind !== "success") return parsed.result;
      newestFullname ??= parsed.fullnames[0];
      const checkpointIndex = priorCheckpoint ? parsed.fullnames.indexOf(priorCheckpoint) : -1;
      const allowedIds = checkpointIndex >= 0 ? new Set(parsed.fullnames.slice(0, checkpointIndex)) : undefined;
      items.push(...parsed.result.items.filter((post) => (!allowedIds || allowedIds.has(post.fullname)) && matchesQueryTerms(post, terms)));
      if (checkpointIndex >= 0 || !parsed.after) break;
      after = parsed.after;
    }

    return {
      kind: "success",
      items,
      fetchedAt: context.now.toISOString(),
      ...(newestFullname ? { nextCursor: encodeRedditCheckpoint(newestFullname) } : query.checkpoint ? { nextCursor: query.checkpoint } : {})
    };
  }
}

function matchesQueryTerms(post: RawCrowdPost, terms: readonly string[]): boolean {
  if (!terms.length) return true;
  const content = `${post.title} ${post.bodyExcerpt ?? ""}`.toLowerCase();
  return terms.some((term) => content.includes(term.toLowerCase()));
}

function boundedUnique(values: readonly string[], max: number, label: string): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalized.length > max) throw new Error(`${label} must remain bounded to ${max}`);
  return normalized;
}

async function withTimeout<T extends RedditPageResponse>(promise: Promise<T>, timeoutMs: number, signal: AbortSignal): Promise<T | { kind: "unavailable"; reason: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ kind: "unavailable"; reason: string }>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "unavailable", reason: "Reddit approved-access request timed out" }), timeoutMs);
  });
  let abortHandler: (() => void) | undefined;
  const aborted = new Promise<{ kind: "unavailable"; reason: string }>((resolve) => {
    abortHandler = () => resolve({ kind: "unavailable", reason: "Reddit request aborted" });
    signal.addEventListener("abort", abortHandler, { once: true });
  });
  try {
    return await Promise.race([promise, timeout, aborted]);
  } finally {
    if (timer) clearTimeout(timer);
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}
