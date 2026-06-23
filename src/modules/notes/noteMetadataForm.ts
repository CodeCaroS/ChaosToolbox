import type { NoteFormMetadata } from "./frontmatter";

export type NoteFormState = {
  title: string;
  kind: string;
  status: string;
  topic: string;
  tags: string;
  summary: string;
  extraYaml: string;
};

export function applySuggestedNoteMetadata(form: NoteFormState, meta: Partial<NoteFormMetadata>): void {
  if (!form.title.trim() && meta.title) form.title = meta.title;
  if (!form.kind.trim() && meta.kind) form.kind = meta.kind;
  if (!form.status.trim() && meta.status) form.status = meta.status;
  if (!form.topic.trim() && meta.topic) form.topic = meta.topic;
  if (!form.summary.trim() && meta.summary) form.summary = meta.summary;
  if (!form.extraYaml.trim() && meta.extraYaml) form.extraYaml = meta.extraYaml;

  const existingTags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const suggestedTags = (meta.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean);
  form.tags = [...new Set([...existingTags, ...suggestedTags])].join(", ");
}
