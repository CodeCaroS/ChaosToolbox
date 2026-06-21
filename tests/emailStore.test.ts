import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmailStore } from "../server/emailStore";

test("email store imports unique messages and updates status", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-email-")), "email.sqlite");
  const email = createEmailStore(filename);
  const message = {
    messageId: "<abc@example.com>",
    fromAddress: "carol@example.com",
    toAddress: "dev@example.com",
    subject: "Build inbox",
    receivedAt: "2026-06-21",
    body: "Hello."
  };

  assert.deepEqual(email.importEmail(message), { created: true, email: { id: 1, ...message, status: "new", attachments: [] } });
  assert.equal(email.importEmail(message).created, false);
  assert.equal(email.markEmail(1, "saved"), true);
  assert.deepEqual(email.listEmails(), [{ id: 1, ...message, status: "saved", attachments: [] }]);

  email.close();
});

test("email store persists imported attachments", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-email-attachments-")), "email.sqlite");
  const email = createEmailStore(filename);
  const imported = email.importEmail({
    messageId: "<attachment@example.com>",
    fromAddress: "carol@example.com",
    toAddress: "dev@example.com",
    subject: "Attachment inbox",
    receivedAt: null,
    body: "See attachment.",
    attachments: [{
      filename: "plan.pdf",
      contentType: "application/pdf",
      contentBase64: "UERG"
    }]
  } as Parameters<typeof email.importEmail>[0] & { attachments: Array<{ filename: string; contentType: string; contentBase64: string }> });

  assert.deepEqual(imported.email.attachments, [{
    id: 1,
    emailId: 1,
    filename: "plan.pdf",
    contentType: "application/pdf",
    contentBase64: "UERG"
  }]);

  email.close();
});
