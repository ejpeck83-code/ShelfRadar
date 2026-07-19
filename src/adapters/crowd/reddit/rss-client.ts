import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { AdapterContext } from "@/domain/adapters";
import { fetchBoundedText } from "@/adapters/http/bounded-fetch";
import type { RedditApprovedAccessClient, RedditPageResponse } from ".";

const textNodeSchema = z.union([z.string(), z.object({ "#text": z.string() }).passthrough()]);
const categorySchema = z.object({ "@_term": z.string().min(1).max(100) }).passthrough();
const linkSchema = z.object({ "@_href": z.url().max(2_048) }).passthrough();
const entrySchema = z.object({
  id: textNodeSchema,
  title: textNodeSchema,
  updated: textNodeSchema,
  published: textNodeSchema.optional(),
  author: z.object({ name: textNodeSchema }).passthrough().optional(),
  category: z.union([categorySchema, z.array(categorySchema).max(20)]),
  content: textNodeSchema.optional(),
  link: z.union([linkSchema, z.array(linkSchema).max(20)])
}).passthrough();
const feedSchema = z.object({ feed: z.object({ entry: z.union([entrySchema, z.array(entrySchema).max(100)]).optional() }).passthrough() });

type RssClientOptions = {
  userAgent: string;
  requestTimeoutMs?: number;
  minRequestIntervalMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
};

export class RedditRssClient implements RedditApprovedAccessClient {
  private lastRequestAt = 0;

  constructor(private readonly options: RssClientOptions) {}

  async fetchPage(input: { communities: readonly string[]; terms: readonly string[]; after?: string; limit: number }, context: AdapterContext): Promise<RedditPageResponse> {
    const minInterval = Math.max(0, Math.min(60_000, this.options.minRequestIntervalMs ?? 1_000));
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minInterval) await delay(minInterval - elapsed, context.signal);
    const communities = input.communities.map((community) => community.trim()).filter((community) => /^[A-Za-z0-9_]{1,50}$/.test(community));
    if (!communities.length || communities.length !== input.communities.length) return { kind: "unavailable", reason: "Reddit RSS communities failed validation" };
    const url = new URL(`https://www.reddit.com/r/${communities.join("+")}/.rss`);
    this.lastRequestAt = Date.now();
    const response = await fetchBoundedText(url, {
      allowedHostname: "www.reddit.com",
      sourceLabel: "Reddit RSS",
      signal: context.signal,
      now: context.now,
      ...(this.options.requestTimeoutMs ? { requestTimeoutMs: this.options.requestTimeoutMs } : {}),
      maxResponseBytes: this.options.maxResponseBytes ?? 750_000,
      headers: { accept: "application/atom+xml", "user-agent": this.options.userAgent },
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {})
    });
    return response.kind === "success" ? parseRedditRss(response.text) : response;
  }
}

export function parseRedditRss(xml: string): RedditPageResponse {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { kind: "unavailable", reason: "Reddit RSS XML declarations were rejected" };
  let payload: unknown;
  try {
    payload = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: true }).parse(xml) as unknown;
  } catch {
    return { kind: "unavailable", reason: "Reddit RSS response was not valid XML" };
  }
  const parsed = feedSchema.safeParse(payload);
  if (!parsed.success) return { kind: "unavailable", reason: "Reddit RSS response failed source validation" };
  const entries = parsed.data.feed.entry ? (Array.isArray(parsed.data.feed.entry) ? parsed.data.feed.entry : [parsed.data.feed.entry]) : [];
  const children: Array<{ kind: "t3"; data: Record<string, unknown> }> = [];
  for (const entry of entries) {
    const fullname = nodeText(entry.id);
    const title = nodeText(entry.title);
    const timestamp = nodeText(entry.published ?? entry.updated);
    const categories = Array.isArray(entry.category) ? entry.category : [entry.category];
    const community = categories[0]?.["@_term"];
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const permalink = links.map((link) => link["@_href"]).find((value) => isRedditPermalink(value));
    const date = new Date(timestamp);
    if (!/^t3_[A-Za-z0-9_-]+$/.test(fullname) || !title || !community || !permalink || Number.isNaN(date.getTime())) {
      return { kind: "unavailable", reason: "Reddit RSS entry failed source validation" };
    }
    const content = entry.content ? nodeText(entry.content) : "";
    const mediaUrl = firstApprovedMediaUrl(content);
    const author = entry.author ? nodeText(entry.author.name).replace(/^\/(?:u|user)\//, "") : undefined;
    children.push({
      kind: "t3",
      data: {
        id: fullname.slice(3),
        name: fullname,
        subreddit: community,
        title,
        selftext: content,
        permalink: new URL(permalink).pathname,
        created_utc: date.getTime() / 1_000,
        ...(author ? { author } : {}),
        ...(mediaUrl ? { url_overridden_by_dest: mediaUrl, post_hint: "image" } : {})
      }
    });
  }
  return { kind: "success", payload: { kind: "Listing", data: { after: null, children } } };
}

function nodeText(value: z.infer<typeof textNodeSchema>): string {
  return (typeof value === "string" ? value : value["#text"]).trim();
}

function isRedditPermalink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "www.reddit.com" || url.hostname === "reddit.com") && url.pathname.startsWith("/r/");
  } catch { return false; }
}

function firstApprovedMediaUrl(content: string): string | undefined {
  const matches = content.matchAll(/https:\/\/[^\s"'<>]+/g);
  for (const match of matches) {
    try {
      const value = match[0].replaceAll("&amp;", "&");
      const url = new URL(value);
      if (["i.redd.it", "preview.redd.it"].includes(url.hostname) || /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(url.toString())) return url.toString();
    } catch { continue; }
  }
  return undefined;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}
