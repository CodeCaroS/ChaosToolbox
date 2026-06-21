import type { NewFeedEntry } from "../src/modules/rss/types";

export function parseOpmlFeeds(opml: string): NewFeedEntry[] {
  return [...opml.matchAll(/<outline\b[^>]*\bxmlUrl=["']([^"']+)["'][^>]*\/?>/gi)].map((match) => {
    const tag = match[0];
    return {
      title: attr(tag, "title") || attr(tag, "text") || match[1],
      url: decode(match[1])
    };
  });
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match ? decode(match[1].trim()) : "";
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
