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

test("email parser decodes rfc2231 attachment filenames", () => {
  const parsed = parseEmail([
    "Message-ID: <filename-star@example.com>",
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
    "Content-Disposition: attachment; filename*=UTF-8''Plan%20M%C3%BCller.pdf",
    "Content-Transfer-Encoding: base64",
    "",
    "UERG",
    "--abc--"
  ].join("\r\n"));

  assert.equal(parsed.attachments?.[0]?.filename, "Plan Müller.pdf");
});

test("email parser decodes continued rfc2231 attachment filenames", () => {
  const parsed = parseEmail([
    "Message-ID: <filename-cont@example.com>",
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
    "Content-Disposition: attachment; filename*0*=UTF-8''Plan%20; filename*1*=M%C3%BCller.pdf",
    "Content-Transfer-Encoding: base64",
    "",
    "UERG",
    "--abc--"
  ].join("\r\n"));

  assert.equal(parsed.attachments?.[0]?.filename, "Plan M\u00fcller.pdf");
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

test("email parser reads text from nested multipart parts", () => {
  const parsed = parseEmail([
    "Message-ID: <nested@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Nested inbox",
    "Content-Type: multipart/mixed; boundary=\"outer\"",
    "",
    "--outer",
    "Content-Type: multipart/alternative; boundary=\"inner\"",
    "",
    "--inner",
    "Content-Type: text/html",
    "",
    "<p>Ignore html.</p>",
    "--inner",
    "Content-Type: text/plain",
    "",
    "Keep nested plain text.",
    "--inner--",
    "--outer",
    "Content-Type: application/pdf",
    "Content-Disposition: attachment; filename=\"plan.pdf\"",
    "Content-Transfer-Encoding: base64",
    "",
    "UERG",
    "--outer--"
  ].join("\r\n"));

  assert.equal(parsed.body, "Keep nested plain text.");
  assert.equal(parsed.attachments?.[0]?.filename, "plan.pdf");
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

test("email parser decodes quoted printable latin1 text parts", () => {
  assert.equal(parseEmail([
    "Message-ID: <latin1@example.com>",
    "From: Carol <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: Encoded inbox",
    "Content-Type: text/plain; charset=iso-8859-1",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Gr=FC=DFe aus der Inbox=2E"
  ].join("\r\n")).body, "Gr\u00fc\u00dfe aus der Inbox.");
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

test("email parser decodes encoded header words", () => {
  const parsed = parseEmail([
    "Message-ID: <headers@example.com>",
    "From: =?UTF-8?Q?Carol_M=C3=BCller?= <carol@example.com>",
    "To: Dev <dev@example.com>",
    "Subject: =?UTF-8?B?R3LDvMOfZQ==?=",
    "",
    "Hello."
  ].join("\r\n"));

  assert.equal(parsed.fromAddress, "Carol Müller <carol@example.com>");
  assert.equal(parsed.subject, "Grüße");
});

test("email parser decodes encoded attachment filenames", () => {
  const parsed = parseEmail([
    "Message-ID: <filename@example.com>",
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
    "Content-Disposition: attachment; filename=\"=?UTF-8?Q?Plan_M=C3=BCller.pdf?=\"",
    "Content-Transfer-Encoding: base64",
    "",
    "UERG",
    "--abc--"
  ].join("\r\n"));

  assert.equal(parsed.attachments?.[0]?.filename, "Plan Müller.pdf");
});
