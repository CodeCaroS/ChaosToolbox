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

  assert.deepEqual(email.importEmail(message), { created: true, email: { id: 1, ...message, status: "new" } });
  assert.equal(email.importEmail(message).created, false);
  assert.equal(email.markEmail(1, "saved"), true);
  assert.deepEqual(email.listEmails(), [{ id: 1, ...message, status: "saved" }]);

  email.close();
});
