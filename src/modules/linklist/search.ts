import type { LinkEntry } from "./types";

export function splitSearchTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[,\s]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function matchesLinkSearch(link: LinkEntry, search: string): boolean {
  const terms = splitSearchTerms(search);
  if (terms.length === 0) return true;

  const haystack = [link.title, link.description, link.categoryName || "", ...link.tags].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
