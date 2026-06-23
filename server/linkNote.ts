import { generateLinkNote } from "./aiProvider";

export type LinkNoteSource = {
  title: string;
  url: string;
  description?: string;
  source?: string;
};

export async function createLinkNoteMarkdown(input: LinkNoteSource): Promise<string> {
  const pageText = await readModeText(input.url);
  const fallback = [input.description, input.url].filter(Boolean).join("\n");
  const text = pageText || fallback;
  if (text.trim().length < 20) throw new Error("read mode returned no useful text");

  return generateLinkNote({
    title: input.title,
    url: input.url,
    source: input.source ?? "link",
    text
  });
}

export async function readModeText(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await fetchFn(url, {
    headers: { "User-Agent": "ChaosToolbox/1.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`read mode fetch failed (${response.status})`);

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  return contentType.includes("html") ? htmlToText(text) : compactText(text);
}

function htmlToText(html: string): string {
  return compactText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'"));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 50000);
}
