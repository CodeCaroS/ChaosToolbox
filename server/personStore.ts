import Database from "better-sqlite3";
import type { NewPersonEntry, PersonEntry } from "../src/modules/people/types";

export function createPersonStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  function getPerson(id: number): PersonEntry {
    return db.prepare("SELECT id, name, role, status, contact, notes FROM people WHERE id = ?").get(id) as PersonEntry;
  }

  function listPeople(): PersonEntry[] {
    return db.prepare("SELECT id, name, role, status, contact, notes FROM people ORDER BY name").all() as PersonEntry[];
  }

  function addPerson(person: NewPersonEntry): PersonEntry {
    const result = db
      .prepare("INSERT INTO people (name, role, status, contact, notes) VALUES (?, ?, ?, ?, ?)")
      .run(person.name.trim(), person.role.trim(), person.status.trim(), person.contact.trim(), person.notes.trim());
    return getPerson(Number(result.lastInsertRowid));
  }

  function updatePerson(id: number, person: NewPersonEntry): PersonEntry | null {
    const result = db
      .prepare("UPDATE people SET name = ?, role = ?, status = ?, contact = ?, notes = ? WHERE id = ?")
      .run(person.name.trim(), person.role.trim(), person.status.trim(), person.contact.trim(), person.notes.trim(), id);
    return result.changes === 0 ? null : getPerson(id);
  }

  function deletePerson(id: number): boolean {
    return db.prepare("DELETE FROM people WHERE id = ?").run(id).changes > 0;
  }

  return {
    addPerson,
    close: () => db.close(),
    deletePerson,
    listPeople,
    updatePerson
  };
}
