import Database from "better-sqlite3";
import type { EmailAttachment, EmailEntry, ParsedEmail } from "../src/modules/email/types";

type EmailStatus = EmailEntry["status"];

export function createEmailStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      from_address TEXT NOT NULL DEFAULT '',
      to_address TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      received_at TEXT,
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new'
    );
    CREATE TABLE IF NOT EXISTS email_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      content_base64 TEXT NOT NULL DEFAULT ''
    );
  `);

  function rowToEmail(row: unknown): EmailEntry {
    const email = row as Omit<EmailEntry, "attachments">;
    return { ...email, attachments: listAttachments(email.id) };
  }

  function getEmail(id: number): EmailEntry | null {
    const row = db.prepare(`
      SELECT id, message_id AS messageId, from_address AS fromAddress, to_address AS toAddress,
        subject, received_at AS receivedAt, body, status
      FROM emails
      WHERE id = ?
    `).get(id);
    return row ? rowToEmail(row) : null;
  }

  const importEmailTx = db.transaction((email: ParsedEmail) => {
    const messageId = email.messageId.trim();
    const result = db.prepare(`
        INSERT OR IGNORE INTO emails (message_id, from_address, to_address, subject, received_at, body)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(messageId, email.fromAddress.trim(), email.toAddress.trim(), email.subject.trim(), email.receivedAt, email.body);

    const row = db.prepare("SELECT id FROM emails WHERE message_id = ?").get(messageId) as { id: number };
    if (result.changes > 0) {
      const insertAttachment = db.prepare(`
        INSERT INTO email_attachments (email_id, filename, content_type, content_base64)
        VALUES (?, ?, ?, ?)
      `);
      for (const attachment of email.attachments ?? []) {
        insertAttachment.run(row.id, attachment.filename.trim(), attachment.contentType.trim(), attachment.contentBase64);
      }
    }
    return { created: result.changes > 0, email: getEmail(row.id)! };
  });

  function importEmail(email: ParsedEmail): { created: boolean; email: EmailEntry } {
    return importEmailTx(email);
  }

  function listEmails(status?: EmailStatus): EmailEntry[] {
    const query = `
      SELECT id, message_id AS messageId, from_address AS fromAddress, to_address AS toAddress,
        subject, received_at AS receivedAt, body, status
      FROM emails
      ${status ? "WHERE status = ?" : ""}
      ORDER BY id DESC
    `;
    return (status ? db.prepare(query).all(status) : db.prepare(query).all()).map(rowToEmail);
  }

  function markEmail(id: number, status: EmailStatus): boolean {
    return db.prepare("UPDATE emails SET status = ? WHERE id = ?").run(status, id).changes > 0;
  }

  function listAttachments(emailId: number): EmailAttachment[] {
    return db.prepare(`
      SELECT id, email_id AS emailId, filename, content_type AS contentType, content_base64 AS contentBase64
      FROM email_attachments
      WHERE email_id = ?
      ORDER BY id
    `).all(emailId) as EmailAttachment[];
  }

  return {
    close: () => db.close(),
    getEmail,
    importEmail,
    listEmails,
    markEmail
  };
}
