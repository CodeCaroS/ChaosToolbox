import assert from "node:assert/strict";
import test from "node:test";
import { parseEmail } from "../server/emailParser";

test("email parser extracts common headers and text body", () => {
  assert.deepEqual(parseEmail([
    "Message-ID: <abc@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Build inbox",
    "Date: Sun, 21 Jun 2026 10:00:00 GMT",
    "",
    "Hello inbox.",
    "Second line."
  ].join("\r\n")), {
    messageId: "<abc@example.com>",
    fromAddress: "Carol <carol@example.com>",
    toAddress: "Dev <dev@example.com>",
    subject: "Build inbox",
    receivedAt: "Sun, 21 Jun 2026 10:00:00 GMT",
    body: "Hello inbox.\nSecond line.",
    attachments: []
  });
});

test("email parser prefers multipart text plain body", () => {
  assert.equal(parseEmail([
    "Message-ID: <multi@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Multipart inbox",
    "Content-Type: multipart/alternative; boundary=\"abc\"",
    "",
    "--abc",
    "Content-Type: text/html",
    "",
    "<p>Ignore html.</p>",
    "--abc",
    "Content-Type: text/plain",
    "",
    "Keep plain text.",
    "--abc--"
  ].join("\r\n")).body, "Keep plain text.");
});

test("email parser extracts attachment metadata and content", () => {
  const parsed = parseEmail([
    "Message-ID: <attachment@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Attachment inbox",
    "Content-Type: multipart/mixed; boundary=\"abc\"",
    "",
    "--abc",
    "Content-Type: text/plain",
    "",
    "See attachment.",
    "--abc",
    "Content-Type: application/pdf",
    "Content-Disposition: attachment; filename=\"plan.pdf\"",
    "Content-Transfer-Encoding: base64",
    "",
    "UERG",
    "--abc--"
  ].join("\r\n")) as ReturnType<typeof parseEmail> & { attachments?: unknown };

  assert.deepEqual(parsed.attachments, [{
    filename: "plan.pdf",
    contentType: "application/pdf",
    contentBase64: "UERG"
  }]);
});

test("email parser decodes quoted printable text parts", () => {
  assert.equal(parseEmail([
    "Message-ID: <qp@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Encoded inbox",
    "Content-Type: multipart/alternative; boundary=\"abc\"",
    "",
    "--abc",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Gr=C3=BC=C3=9Fe aus der Inbox=2E",
    "--abc--"
  ].join("\r\n")).body, "Grüße aus der Inbox.");
});

test("email parser decodes base64 text body", () => {
  assert.equal(parseEmail([
    "Message-ID: <base64@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Encoded inbox",
    "Content-Transfer-Encoding: base64",
    "",
    "SGVsbG8gaW5ib3gu"
  ].join("\r\n")).body, "Hello inbox.");
});
