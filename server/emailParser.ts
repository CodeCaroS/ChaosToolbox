import { createHash } from "node:crypto";
import type { ParsedEmail, ParsedEmailAttachment } from "../src/modules/email/types";

export function parseEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const [headerText, ...bodyParts] = normalized.split(/\n\n/);
  const headers = parseHeaders(headerText);
  const parsedBody = parseBody(headers, bodyParts.join("\n\n"));

  return {
    messageId: headers.get("message-id") ?? `sha256:${createHash("sha256").update(raw).digest("hex")}`,
    fromAddress: headers.get("from") ?? "",
    toAddress: headers.get("to") ?? "",
    subject: headers.get("subject") ?? "(no subject)",
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
  if (!boundary) return { body: decodeText(value.trim(), headers.get("content-transfer-encoding")), attachments: [] };

  let body = "";
  const attachments: ParsedEmailAttachment[] = [];
  for (const part of value.split(`--${boundary}`)) {
    const [partHeaderText, ...partBodyParts] = part.replace(/^\n/, "").split(/\n\n/);
    const partHeaders = parseHeaders(partHeaderText);
    const partBody = partBodyParts.join("\n\n").replace(new RegExp(`\\n?--${boundary}--\\s*$`), "").trim();
    const disposition = partHeaders.get("content-disposition") ?? "";
    if ((partHeaders.get("content-type") ?? "").toLowerCase().startsWith("text/plain")) {
      body ||= decodeText(partBody, partHeaders.get("content-transfer-encoding"));
    }
    if (disposition.toLowerCase().startsWith("attachment")) {
      attachments.push({
        filename: cleanFilename(disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "attachment"),
        contentType: (partHeaders.get("content-type") ?? "application/octet-stream").split(";")[0].trim(),
        contentBase64: partBody.replace(/\s/g, "")
      });
    }
  }

  return { body: body || value.trim(), attachments };
}

function cleanFilename(value: string): string {
  return value.replace(/[\\/]/g, "_").trim() || "attachment";
}

function decodeText(value: string, encoding = ""): string {
  if (/^base64$/i.test(encoding)) return Buffer.from(value.replace(/\s/g, ""), "base64").toString("utf8").trim();
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
  return Buffer.from(bytes).toString("utf8").trim();
}
