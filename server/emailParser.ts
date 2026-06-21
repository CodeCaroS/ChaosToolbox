import { createHash } from "node:crypto";
import type { ParsedEmail, ParsedEmailAttachment } from "../src/modules/email/types";

export function parseEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const [headerText, ...bodyParts] = normalized.split(/\n\n/);
  const headers = parseHeaders(headerText);
  const parsedBody = parseBody(headers, bodyParts.join("\n\n"));

  return {
    messageId: headers.get("message-id") ?? `sha256:${createHash("sha256").update(raw).digest("hex")}`,
    fromAddress: decodeHeader(headers.get("from") ?? ""),
    toAddress: decodeHeader(headers.get("to") ?? ""),
    subject: decodeHeader(headers.get("subject") ?? "(no subject)"),
    receivedAt: headers.get("date") ?? null,
    body: parsedBody.body,
    attachments: parsedBody.attachments
  };
}

function parseHeaders(value: string): Map<string, string> {
  const lines: string[] = [];
  for (const line of value.split("\n")) {
    if (/^\s/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += ` ${line.trim()}`;
    } else {
      lines.push(line);
    }
  }

  const headers = new Map<string, string>();
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index < 1) continue;
    headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return headers;
}

function parseBody(headers: Map<string, string>, value: string): { body: string; attachments: ParsedEmailAttachment[] } {
  const contentType = headers.get("content-type") ?? "";
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
  if (!boundary) return { body: decodeText(value.trim(), headers.get("content-transfer-encoding"), getCharset(contentType)), attachments: [] };

  let body = "";
  let htmlBody = "";
  const attachments: ParsedEmailAttachment[] = [];
  for (const part of value.split(`--${boundary}`)) {
    const [partHeaderText, ...partBodyParts] = part.replace(/^\n/, "").split(/\n\n/);
    const partHeaders = parseHeaders(partHeaderText);
    const partBody = partBodyParts.join("\n\n").replace(new RegExp(`\\n?--${boundary}--\\s*$`), "").trim();
    const disposition = partHeaders.get("content-disposition") ?? "";
    const partContentType = partHeaders.get("content-type") ?? "";
    if (partContentType.toLowerCase().startsWith("multipart/")) {
      const nested = parseBody(partHeaders, partBody);
      body ||= nested.body;
      attachments.push(...nested.attachments);
      continue;
    }
    if (partContentType.toLowerCase().startsWith("text/plain")) {
      body ||= decodeText(partBody, partHeaders.get("content-transfer-encoding"), getCharset(partContentType));
    }
    if (partContentType.toLowerCase().startsWith("text/html")) {
      htmlBody ||= stripHtml(decodeText(partBody, partHeaders.get("content-transfer-encoding"), getCharset(partContentType)));
    }
    if (disposition.toLowerCase().startsWith("attachment")) {
      attachments.push({
        filename: cleanFilename(parseFilename(disposition, partContentType)),
        contentType: (partContentType || "application/octet-stream").split(";")[0].trim(),
        contentBase64: partBody.replace(/\s/g, "")
      });
    }
  }

  return { body: body || htmlBody || value.trim(), attachments };
}

function cleanFilename(value: string): string {
  return value.replace(/[\\/]/g, "_").trim() || "attachment";
}

function parseFilename(disposition: string, contentType = ""): string {
  const segments = [...disposition.matchAll(/filename\*(\d+)\*?=([^;]+)/gi)]
    .map((match) => ({ index: Number(match[1]), value: match[2].trim().replace(/^"|"$/g, "") }))
    .sort((left, right) => left.index - right.index);
  if (segments.length > 0) {
    const joined = segments.map((segment) => segment.value).join("");
    return decodeRfc2231(joined.includes("''") ? joined : `utf-8''${joined}`);
  }

  const encoded = disposition.match(/filename\*=([^;]+)/i)?.[1]?.trim().replace(/^"|"$/g, "");
  if (encoded) return decodeRfc2231(encoded);
  return decodeHeader(disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? contentType.match(/name="?([^";]+)"?/i)?.[1] ?? "attachment");
}

function decodeRfc2231(value: string): string {
  const match = value.match(/^([^']*)''(.+)$/);
  const charset = match?.[1] ?? "utf-8";
  const encoded = match?.[2] ?? value;
  const bytes = Buffer.from(encoded.replace(/%([0-9a-f]{2})/gi, (_hex, code: string) => String.fromCharCode(Number.parseInt(code, 16))), "binary");
  return /^iso-8859-1$/i.test(charset) ? bytes.toString("latin1") : bytes.toString("utf8");
}

function getCharset(contentType: string): BufferEncoding {
  return /charset="?iso-8859-1"?/i.test(contentType) ? "latin1" : "utf8";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeText(value: string, encoding = "", charset: BufferEncoding = "utf8"): string {
  if (/^base64$/i.test(encoding)) return Buffer.from(value.replace(/\s/g, ""), "base64").toString(charset).trim();
  if (!/^quoted-printable$/i.test(encoding)) return value;

  const bytes: number[] = [];
  const normalized = value.replace(/=\n/g, "");
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "=" && /^[0-9a-f]{2}$/i.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(normalized.charCodeAt(index));
    }
  }
  return Buffer.from(bytes).toString(charset).trim();
}

function decodeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_match, charset: string, encoding: string, body: string) => {
    const bytes = encoding.toLowerCase() === "b"
      ? Buffer.from(body, "base64")
      : Buffer.from(body.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_hex, code: string) => String.fromCharCode(Number.parseInt(code, 16))), "binary");
    return /^iso-8859-1$/i.test(charset) ? bytes.toString("latin1") : bytes.toString("utf8");
  });
}
