import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortInboxItems, type InboxFilter, type InboxSort, type InboxListItem } from "../src/modules/inbox/sortFilter";

const items: InboxListItem[] = [
  { kind: "source", id: 5, title: "Zulu source", date: null },
  { kind: "email", id: 1, title: "Beta mail", date: "2026-06-20T10:00:00Z" },
  { kind: "rss", id: 2, title: "Alpha feed", date: "2026-06-21T10:00:00Z" },
  { kind: "note", id: 3, title: "Gamma note", date: null }
];

test("filterAndSortInboxItems filters by kind", () => {
  const filtered = filterAndSortInboxItems(items, "email", "newest");

  assert.deepEqual(filtered.map((item) => item.kind), ["email"]);
});

test("filterAndSortInboxItems sorts newest oldest and title without mutating input", () => {
  const before = items.map((item) => item.id);

  assert.deepEqual(filterAndSortInboxItems(items, "all", "newest").map((item) => item.id), [2, 1, 5, 3]);
  assert.deepEqual(filterAndSortInboxItems(items, "all", "oldest").map((item) => item.id), [5, 3, 1, 2]);
  assert.deepEqual(filterAndSortInboxItems(items, "all", "title").map((item) => item.title), ["Alpha feed", "Beta mail", "Gamma note", "Zulu source"]);
  assert.deepEqual(items.map((item) => item.id), before);
});

test("filterAndSortInboxItems only accepts supported controls", () => {
  const filter: InboxFilter = "source";
  const sort: InboxSort = "title";

  assert.deepEqual(filterAndSortInboxItems(items, filter, sort).map((item) => item.kind), ["source"]);
});
