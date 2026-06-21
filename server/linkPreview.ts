import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NewLinkEntry } from "../src/modules/linklist/types";

export type LinkPreview = NewLinkEntry;

export function parseLinkPreviewHtml(url: string, html: string): LinkPreview {
  return {
    title: firstMeta(html, ["og:title", "twitter:title"]) || titleTag(html),
    description: firstMeta(html, ["og:description", "twitter:description", "description"]),
    url,
    categoryId: null,
    tags: (firstMeta(html, ["keywords"]) || "")
      .split(",")
      .map((tag) => decodeHtml(tag.trim()))
      .filter(Boolean)
  };
}

export function isBlockedPreviewUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;

    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return true;
    if (isIP(host)) return isPrivateIp(host);

    return false;
  } catch {
    return true;
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  if (isBlockedPreviewUrl(rawUrl)) return null;

  const url = new URL(rawUrl);
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((address) => isPrivateIp(address.address))) return null;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { "User-Agent": "ChaosToolbox/1.0" }
  });
  if (!response.ok) return null;

  const html = await readLimited(response, 200_000);
  return parseLinkPreviewHtml(url.toString(), html);
}

function firstMeta(html: string, names: string[]): string {
  for (const name of names) {
    const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${quoted}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
    const reversed = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${quoted}["'][^>]*>`, "i");
    const match = html.match(pattern) || html.match(reversed);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }

  return "";
}

function titleTag(html: string): string {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "");
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function isPrivateIp(address: string): boolean {
  if (address === "::1") return true;

  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }

  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

async function readLimited(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;

  while (size < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }

  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, limit));
}
