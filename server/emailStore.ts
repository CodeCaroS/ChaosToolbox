import Database from "better-sqlite3";
import type { EmailEntry, ParsedEmail } from "../src/modules/email/types";

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
  `);

  function rowToEmail(row: unknown): EmailEntry {
    return row as EmailEntry;
  }

  function getEmail(id: number): EmailEntry | null {
    return (db.prepare(`
      SELECT id, message_id AS messageId, from_address AS fromAddress, to_address AS toAddress,
        subject, received_at AS receivedAt, body, status
      FROM emails
      WHERE id = ?
    `).get(id) as EmailEntry | undefined) ?? null;
  }

  function importEmail(email: ParsedEmail): { created: boolean; email: EmailEntry } {
    const result = db.prepare(`
      INSERT OR IGNORE INTO emails (message_id, from_address, to_address, subject, received_at, body)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email.messageId.trim(), email.fromAddress.trim(), email.toAddress.trim(), email.subject.trim(), email.receivedAt, email.body);

    const row = db.prepare("SELECT id FROM emails WHERE message_id = ?").get(email.messageId.trim()) as { id: number };
    return { created: result.changes > 0, email: getEmail(row.id)! };
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

  return {
    close: () => db.close(),
    getEmail,
    importEmail,
    listEmails,
    markEmail
  };
}
