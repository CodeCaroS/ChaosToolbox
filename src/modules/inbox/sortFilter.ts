export type InboxFilter = "all" | "email" | "rss" | "source" | "note";
export type InboxSort = "newest" | "oldest" | "title";

export type InboxListItem = {
  kind: Exclude<InboxFilter, "all">;
  id: number;
  title: string;
  date: string | null;
};

function time(value: string | null) {
  return value ? Date.parse(value) || 0 : Number.NEGATIVE_INFINITY;
}

export function filterAndSortInboxItems<T extends InboxListItem>(items: T[], filter: InboxFilter, sort: InboxSort): T[] {
  const filtered = filter === "all" ? [...items] : items.filter((item) => item.kind === filter);

  return filtered.sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title);
    return sort === "newest" ? time(right.date) - time(left.date) : time(left.date) - time(right.date);
  });
}
