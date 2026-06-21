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
    body: "Hello inbox.\nSecond line."
  });
});
