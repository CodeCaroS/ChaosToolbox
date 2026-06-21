import assert from "node:assert/strict";
import test from "node:test";
import { createPersonStore } from "../server/personStore";

test("person store creates, updates and deletes people", () => {
  const store = createPersonStore(":memory:");
  const saved = store.addPerson({
    name: "Caroline",
    role: "Developer",
    status: "active",
    contact: "discord",
    notes: "Builds small tools."
  });

  assert.deepEqual(store.listPeople(), [saved]);
  assert.deepEqual(store.updatePerson(saved.id, { ...saved, status: "inactive" }), {
    id: saved.id,
    name: "Caroline",
    role: "Developer",
    status: "inactive",
    contact: "discord",
    notes: "Builds small tools."
  });
  assert.equal(store.deletePerson(saved.id), true);
  assert.deepEqual(store.listPeople(), []);

  store.close();
});
