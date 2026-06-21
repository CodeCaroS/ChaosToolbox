import type { ParsedFeedItem } from "../src/modules/rss/types";

export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.flatMap((block) => {
    const title = text(block, "title");
    const url = text(block, "link") || attr(block, "link", "href");
    if (!title || !url) return [];
    return [{ title, url, publishedAt: text(block, "pubDate") || text(block, "updated") || text(block, "published") || null }];
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

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
