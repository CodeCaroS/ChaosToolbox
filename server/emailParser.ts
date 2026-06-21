import { createHash } from "node:crypto";
import type { ParsedEmail } from "../src/modules/email/types";

export function parseEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const [headerText, ...bodyParts] = normalized.split(/\n\n/);
  const headers = parseHeaders(headerText);
  const body = bodyParts.join("\n\n").trim();

  return {
    messageId: headers.get("message-id") ?? `sha256:${createHash("sha256").update(raw).digest("hex")}`,
    fromAddress: headers.get("from") ?? "",
    toAddress: headers.get("to") ?? "",
    subject: headers.get("subject") ?? "(no subject)",
    receivedAt: headers.get("date") ?? null,
    body
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
