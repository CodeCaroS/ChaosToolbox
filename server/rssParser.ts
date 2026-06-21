import type { ParsedFeedItem } from "../src/modules/rss/types";

export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.flatMap((block) => {
    const title = text(block, "title");
    const url = text(block, "link") || atomAlternateLink(block) || attr(block, "link", "href") || permalinkGuid(block);
    if (!title || !url) return [];
    return [{
      title,
      url,
      publishedAt: text(block, "pubDate") || text(block, "updated") || text(block, "published") || null,
      summary: stripTags(text(block, "description") || text(block, "summary") || text(block, "content") || text(block, "content:encoded"))
    }];
  });
}

function text(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decode(match[1].trim()) : "";
}

function attr(block: string, tag: string, name: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*\\s${name}=["']([^"']+)["'][^>]*\\/?>`, "i"));
  return match ? decode(match[1].trim()) : "";
}

function atomAlternateLink(block: string): string {
  const link = [...block.matchAll(/<link\b[^>]*\/?>/gi)]
    .map((match) => match[0])
    .find((tag) => /\srel=["']alternate["']/i.test(tag));
  return link ? attr(link, "link", "href") : "";
}

function permalinkGuid(block: string): string {
  const match = block.match(/<guid\b[^>]*\sisPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i);
  return match ? decode(match[1].trim()) : "";
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
