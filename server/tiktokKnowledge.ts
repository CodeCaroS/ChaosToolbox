import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateKnowledgeNote, ocrTikTokImages } from "./aiProvider";

type FetchFn = typeof fetch;

export type TranscriptResult = {
  provider: string;
  transcript: string;
};

export type TranscriptProvider = (url: string) => Promise<TranscriptResult>;

export type TikTokKnowledgeNoteResult = {
  path: string;
  provider: string;
  title: string;
};

type GenerateFn = (input: { url: string; transcript: string; template: string }) => Promise<string>;
type PhotoReader = (url: string) => Promise<TranscriptResult>;

export async function createTikTokKnowledgeNote(
  url: string,
  secondBrainRoot: string,
  providers = defaultTranscriptProviders(),
  generate: GenerateFn = generateKnowledgeNote,
  readPhoto: PhotoReader = readPhotoPostText
): Promise<TikTokKnowledgeNoteResult> {
  const cleanUrl = parseTikTokUrl(url);
  const transcript = isPhotoUrl(cleanUrl) ? await readPhoto(cleanUrl) : await fetchTranscript(cleanUrl, providers);
  const template = readTemplate(secondBrainRoot);
  const markdown = await generate({ url: cleanUrl, transcript: transcript.transcript, template });
  const title = markdown.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? "TikTok Knowledge Note";
  const path = writeInboxNote(secondBrainRoot, title, markdown);
  return { path, provider: transcript.provider, title };
}

export async function fetchTranscript(url: string, providers: TranscriptProvider[]): Promise<TranscriptResult> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(url);
      if (result.transcript.trim().length >= 20 && !looksLikeProviderPage(result.transcript)) return result;
      errors.push(`${result.provider}: empty transcript`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`No transcript provider worked: ${errors.join("; ")}`);
}

export function defaultTranscriptProviders(fetchFn: FetchFn = fetch): TranscriptProvider[] {
  return [
    httpProvider("transcript24", "https://www.transcript24.com/free/youtube-transcript", fetchFn),
    quickUrlProvider("tokscript", "https://tokscript.com/", fetchFn),
    httpProvider("saveto", "https://saveto.ai/app/tiktok-transcript-generator/", fetchFn)
  ];
}

export async function readPhotoPostText(url: string, fetchFn: FetchFn = fetch): Promise<TranscriptResult> {
  const page = await fetchFn(url, { headers: { "Accept": "text/html" } });
  if (!page.ok) throw new Error("tiktok-photo: page request failed");
  let imageUrls = extractTikTokImageUrls(await page.text());
  if (!imageUrls.length) imageUrls = await fetchTikwmImageUrls(url, fetchFn);
  if (!imageUrls.length) throw new Error("tiktok-photo: no images found");

  const images = [];
  for (const imageUrl of imageUrls.slice(0, 8)) {
    const response = await fetchFn(imageUrl, { headers: { "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*" } });
    if (!response.ok) continue;
    images.push({
      mimeType: response.headers.get("content-type")?.split(";")[0] || "image/jpeg",
      data: Buffer.from(await response.arrayBuffer()).toString("base64")
    });
  }
  if (!images.length) throw new Error("tiktok-photo: image download failed");
  return { provider: "tiktok-photo-ocr", transcript: await ocrTikTokImages({ url, images }) };
}

export function extractTikTokImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const normalized = decodeEntities(html).replace(/\\u002F/g, "/").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  for (const match of normalized.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\\\s]*)?/gi)) {
    const url = match[0];
    if (/tiktokcdn|tiktok/i.test(url)) urls.add(url);
  }
  return [...urls];
}

async function fetchTikwmImageUrls(url: string, fetchFn: FetchFn): Promise<string[]> {
  const response = await fetchFn(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) return [];
  return extractTikwmImageUrls(await response.json());
}

export function extractTikwmImageUrls(payload: unknown): string[] {
  const images = (payload as { data?: { images?: unknown } })?.data?.images;
  return Array.isArray(images) ? images.filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)) : [];
}

function httpProvider(provider: string, endpoint: string, fetchFn: FetchFn): TranscriptProvider {
  return async (url) => {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json,text/plain,text/html"
      },
      body: JSON.stringify({ url })
    });
    if (!response.ok) throw new Error(`${provider}: request failed`);
    return { provider, transcript: extractTranscript(await response.text()) };
  };
}

function quickUrlProvider(provider: string, prefix: string, fetchFn: FetchFn): TranscriptProvider {
  return async (url) => {
    const response = await fetchFn(`${prefix}${url}`, { headers: { "Accept": "text/plain,text/html,application/json" } });
    if (!response.ok) throw new Error(`${provider}: request failed`);
    return { provider, transcript: extractTranscript(await response.text()) };
  };
}

function extractTranscript(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const found = findText(parsed);
    if (found) return found;
  } catch (_error) {
    // ponytail: providers may return plain text or html.
  }

  const textarea = raw.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)?.[1];
  const text = textarea ?? raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "\n");
  return decodeEntities(text).replace(/\n{3,}/g, "\n\n").trim();
}

function looksLikeProviderPage(text: string): boolean {
  const lower = text.toLowerCase();
  const markers = [
    "free youtube transcript generator",
    "kostenloser youtube transkript generator",
    "paste a video url",
    "tiktok transcript generator"
  ];
  const markerCount = markers.filter((marker) => lower.includes(marker)).length;
  const css = /[{;]\s*(display|font-|background|color|padding|margin)\s*:/.test(text);
  return markerCount > 1 || (markerCount === 1 && css);
}

function findText(value: unknown): string | null {
  if (typeof value === "string") return value.length >= 20 ? value : null;
  if (!value || typeof value !== "object") return null;
  for (const key of ["transcript", "text", "captions", "caption", "content", "data"]) {
    const found = findText((value as Record<string, unknown>)[key]);
    if (found) return found;
  }
  if (Array.isArray(value)) return value.map(findText).filter(Boolean).join("\n") || null;
  return null;
}

function parseTikTokUrl(value: string): string {
  const url = new URL(value.trim());
  if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) throw new Error("valid TikTok URL is required");
  return url.toString();
}

function isPhotoUrl(value: string): boolean {
  return new URL(value).pathname.includes("/photo/");
}

function readTemplate(root: string): string {
  const path = join(root, "99-system", "templates", "ai-capture.template.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function writeInboxNote(root: string, title: string, markdown: string): string {
  const folder = join(root, "00-inbox", "ai-captures");
  mkdirSync(folder, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const name = `${date}-${slug(title)}-${createHash("sha1").update(markdown).digest("hex").slice(0, 6)}.md`;
  writeFileSync(join(folder, name), `${markdown.trimEnd()}\n`);
  return `00-inbox/ai-captures/${name}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "tiktok-note";
}

function decodeEntities(value: string): string {
  return value.replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
