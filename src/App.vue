<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import SourceCard from "./SourceCard.vue";
import type { LinkEntry, NewLinkEntry } from "./modules/linklist/types";
import type { NewNoteEntry, NoteEntry } from "./modules/notes/types";
import type { FeedEntry, FeedItemEntry, NewFeedEntry } from "./modules/rss/types";
import type { EmailEntry } from "./modules/email/types";
import type { NewTaskEntry, TaskEntry } from "./modules/tasks/types";

type ViewId = "dashboard" | "inbox" | "sources" | "notes" | "tasks" | "reviews";
type SourceStatus = "inbox" | "keep" | "refine" | "archived";
type InboxSelection = { kind: "email" | "rss"; id: number };
type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  changed: boolean;
  conflicts: boolean;
  files: string[];
  remotes: Array<{ name: string; url: string }>;
  authRequired: boolean;
  message: string;
};

const links = ref<LinkEntry[]>([]);
const notes = ref<NoteEntry[]>([]);
const tasks = ref<TaskEntry[]>([]);
const feeds = ref<FeedEntry[]>([]);
const feedItems = ref<FeedItemEntry[]>([]);
const emails = ref<EmailEntry[]>([]);
const gitStatus = ref<GitStatus | null>(null);
const activeView = ref<ViewId>("dashboard");
const search = ref("");
const error = ref("");
const loading = ref(true);
const gitBusy = ref(false);
const gitResult = ref("");
const forcePushConfirmed = ref(false);
const selectedInboxItem = ref<InboxSelection | null>(null);

const sourceForm = reactive({ title: "", url: "", description: "", tags: "" });
const noteForm = reactive({ title: "", body: "" });
const taskForm = reactive({ title: "", notes: "", tags: "" });
const feedForm = reactive({ title: "", url: "" });
const opmlForm = reactive({ body: "" });
const emailForm = reactive({ raw: "" });
const gitForm = reactive({ message: "Sync Second Brain", remote: "", branch: "" });

const navItems: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Cockpit", icon: "fa-table-columns" },
  { id: "inbox", label: "Inbox", icon: "fa-inbox" },
  { id: "sources", label: "Sources", icon: "fa-diagram-project" },
  { id: "notes", label: "Notes", icon: "fa-note-sticky" },
  { id: "tasks", label: "Tasks", icon: "fa-list-check" },
  { id: "reviews", label: "Reviews", icon: "fa-magnifying-glass-chart" }
];

const currentView = computed(() => navItems.find((item) => item.id === activeView.value) ?? navItems[0]);
const query = computed(() => search.value.trim().toLowerCase());

const sources = computed(() => links.value.map((link) => ({
  ...link,
  status: sourceStatus(link),
  body: `${link.title} ${link.description} ${link.url} ${link.categoryName ?? ""} ${link.tags.join(" ")}`
})));

const inboxSources = computed(() => filteredSources.value.filter((source) => source.status === "inbox" || source.status === "refine"));
const keptSources = computed(() => sources.value.filter((source) => source.status === "keep"));
const openTasks = computed(() => tasks.value.filter((task) => !task.done));
const newFeedItems = computed(() => feedItems.value.filter((item) => item.status === "new"));
const newEmails = computed(() => emails.value.filter((email) => email.status === "new"));
const inboxCount = computed(() => inboxSources.value.length + newFeedItems.value.length + newEmails.value.length);
const selectedEmail = computed(() => selectedInboxItem.value?.kind === "email"
  ? emails.value.find((email) => email.id === selectedInboxItem.value?.id && email.status === "new") ?? null
  : null);
const selectedFeedItem = computed(() => selectedInboxItem.value?.kind === "rss"
  ? feedItems.value.find((item) => item.id === selectedInboxItem.value?.id && item.status === "new") ?? null
  : null);
const reviewItems = computed(() => [
  ...sources.value.filter((source) => source.status === "inbox").map((source) => ({
    id: `source-${source.id}`,
    title: source.title,
    kind: "Source",
    icon: "fa-diagram-project",
    reason: "wartet in der Inbox",
    action: "Keep, Refine oder Archive"
  })),
  ...newFeedItems.value.map((item) => ({
    id: `rss-${item.id}`,
    title: item.title,
    kind: "RSS",
    icon: "fa-rss",
    reason: item.feedTitle,
    action: "Save, Note, Task oder Ignore"
  })),
  ...newEmails.value.map((email) => ({
    id: `email-${email.id}`,
    title: email.subject,
    kind: "E-Mail",
    icon: "fa-envelope",
    reason: email.fromAddress || "unknown sender",
    action: "Source, Note, Task oder Ignore"
  })),
  ...notes.value.filter((note) => !note.categoryName && !hasSourceHint(note)).map((note) => ({
    id: `note-${note.id}`,
    title: note.title,
    kind: "Note",
    icon: "fa-note-sticky",
    reason: "ohne Source-Hinweis",
    action: "Quelle im Text verlinken"
  })),
  ...openTasks.value.filter((task) => task.tags.length === 0).map((task) => ({
    id: `task-${task.id}`,
    title: task.title,
    kind: "Task",
    icon: "fa-list-check",
    reason: "ohne Tag",
    action: "Projekt oder Kontext taggen"
  }))
]);

const filteredSources = computed(() => {
  if (!query.value) return sources.value;
  return sources.value.filter((source) => source.body.toLowerCase().includes(query.value));
});

const filteredNotes = computed(() => {
  if (!query.value) return notes.value;
  return notes.value.filter((note) => `${note.title} ${note.body} ${note.categoryName ?? ""}`.toLowerCase().includes(query.value));
});

const filteredTasks = computed(() => {
  if (!query.value) return tasks.value;
  return tasks.value.filter((task) => `${task.title} ${task.notes} ${task.categoryName ?? ""} ${task.tags.join(" ")}`.toLowerCase().includes(query.value));
});

const stats = computed(() => [
  { label: "Inbox", value: inboxCount.value, icon: "fa-inbox" },
  { label: "Sources", value: links.value.length, icon: "fa-diagram-project" },
  { label: "Notes", value: notes.value.length, icon: "fa-note-sticky" },
  { label: "Open Tasks", value: openTasks.value.length, icon: "fa-list-check" },
  { label: "Reviews", value: reviewItems.value.length, icon: "fa-magnifying-glass-chart" }
]);

onMounted(async () => {
  await Promise.all([loadLinks(), loadNotes(), loadTasks(), loadFeeds(), loadFeedItems(), loadEmails(), loadGitStatus()]);
  loading.value = false;
});

async function loadLinks() {
  links.value = await getJson<LinkEntry[]>("/api/links");
}

async function loadNotes() {
  notes.value = await getJson<NoteEntry[]>("/api/notes");
}

async function loadTasks() {
  tasks.value = await getJson<TaskEntry[]>("/api/tasks");
}

async function loadFeeds() {
  feeds.value = await getJson<FeedEntry[]>("/api/rss/feeds");
}

async function loadFeedItems() {
  feedItems.value = await getJson<FeedItemEntry[]>("/api/rss/items");
}

async function loadEmails() {
  emails.value = await getJson<EmailEntry[]>("/api/email/messages");
}

async function loadGitStatus() {
  gitStatus.value = await getJson<GitStatus>("/api/second-brain/git/status");
  if (!gitForm.remote && gitStatus.value.remotes.length > 0) gitForm.remote = gitStatus.value.remotes[0].name;
  if (!gitForm.branch && gitStatus.value.branch) gitForm.branch = gitStatus.value.branch;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}

async function addSource() {
  error.value = "";
  const payload: NewLinkEntry = {
    title: sourceForm.title.trim(),
    url: sourceForm.url.trim(),
    description: sourceForm.description.trim(),
    categoryId: null,
    tags: normalizeTags(sourceForm.tags, "status:inbox")
  };

  const response = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "Source braucht Titel und gueltige URL.";
    return;
  }

  links.value.unshift(await response.json() as LinkEntry);
  sourceForm.title = "";
  sourceForm.url = "";
  sourceForm.description = "";
  sourceForm.tags = "";
}

async function addNote() {
  error.value = "";
  const payload: NewNoteEntry = {
    title: noteForm.title.trim(),
    body: noteForm.body.trim(),
    categoryId: null
  };

  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "Note braucht einen Titel.";
    return;
  }

  notes.value.unshift(await response.json() as NoteEntry);
  noteForm.title = "";
  noteForm.body = "";
}

async function addTask() {
  error.value = "";
  const payload: NewTaskEntry = {
    title: taskForm.title.trim(),
    notes: taskForm.notes.trim(),
    priority: 0,
    dueDate: null,
    repeat: "",
    categoryId: null,
    tags: normalizeTags(taskForm.tags),
    steps: []
  };

  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "Task braucht einen Titel.";
    return;
  }

  tasks.value.unshift(await response.json() as TaskEntry);
  taskForm.title = "";
  taskForm.notes = "";
  taskForm.tags = "";
}

async function addFeed() {
  error.value = "";
  const payload: NewFeedEntry = {
    title: feedForm.title.trim(),
    url: feedForm.url.trim()
  };

  const response = await fetch("/api/rss/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "RSS Feed braucht Titel und gueltige URL.";
    return;
  }

  const feed = await response.json() as FeedEntry;
  feeds.value.unshift(feed);
  feedForm.title = "";
  feedForm.url = "";
  await fetchFeed(feed);
}

async function importOpml() {
  const response = await fetch("/api/rss/opml", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opml: opmlForm.body })
  });

  if (!response.ok) {
    error.value = "OPML konnte nicht importiert werden.";
    return;
  }

  gitResult.value = JSON.stringify(await response.json());
  opmlForm.body = "";
  await loadFeeds();
}

async function refreshAllFeeds() {
  const response = await fetch("/api/rss/refresh", { method: "POST" });
  if (!response.ok) {
    error.value = "RSS Feeds konnten nicht abgerufen werden.";
    return;
  }

  gitResult.value = JSON.stringify(await response.json());
  await loadFeedItems();
}

async function fetchFeed(feed: FeedEntry) {
  const response = await fetch(`/api/rss/feeds/${feed.id}/fetch`, { method: "POST" });
  if (!response.ok) {
    error.value = "RSS Feed konnte nicht abgerufen werden.";
    return;
  }
  gitResult.value = JSON.stringify(await response.json());
  await loadFeedItems();
}

async function setFeedEnabled(feed: FeedEntry, enabled: boolean) {
  const response = await fetch(`/api/rss/feeds/${feed.id}/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) {
    error.value = "RSS Feed konnte nicht aktualisiert werden.";
    return;
  }

  const updated = await response.json() as FeedEntry;
  feeds.value = feeds.value.map((current) => current.id === feed.id ? updated : current);
}

async function deleteFeed(feed: FeedEntry) {
  const response = await fetch(`/api/rss/feeds/${feed.id}`, { method: "DELETE" });
  if (!response.ok) {
    error.value = "RSS Feed konnte nicht geloescht werden.";
    return;
  }

  feeds.value = feeds.value.filter((current) => current.id !== feed.id);
  await loadFeedItems();
}

async function saveFeedItem(item: FeedItemEntry) {
  await actOnFeedItem("/api/rss/items/save", item, (payload) => {
    links.value.unshift(payload as LinkEntry);
  });
  closeInboxDetail();
}

async function noteFeedItem(item: FeedItemEntry) {
  await actOnFeedItem("/api/rss/items/note", item, (payload) => {
    notes.value.unshift(payload as NoteEntry);
  });
  closeInboxDetail();
}

async function taskFeedItem(item: FeedItemEntry) {
  await actOnFeedItem("/api/rss/items/task", item, (payload) => {
    tasks.value.unshift(payload as TaskEntry);
  });
  closeInboxDetail();
}

async function ignoreFeedItem(item: FeedItemEntry) {
  await actOnFeedItem("/api/rss/items/ignore", item);
  closeInboxDetail();
}

async function actOnFeedItem(url: string, item: FeedItemEntry, apply?: (payload: unknown) => void) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });

  if (!response.ok) {
    error.value = "RSS Item konnte nicht verarbeitet werden.";
    return;
  }

  if (response.status !== 204 && apply) apply(await response.json());
  await loadFeedItems();
}

async function importEmail() {
  const response = await fetch("/api/email/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: emailForm.raw })
  });

  if (!response.ok) {
    error.value = "E-Mail konnte nicht importiert werden.";
    return;
  }

  emailForm.raw = "";
  await loadEmails();
}

async function saveEmail(email: EmailEntry) {
  await actOnEmail(`/api/email/messages/${email.id}/source`, (payload) => {
    links.value.unshift(payload as LinkEntry);
  });
  closeInboxDetail();
}

async function noteEmail(email: EmailEntry) {
  await actOnEmail(`/api/email/messages/${email.id}/note`, (payload) => {
    notes.value.unshift(payload as NoteEntry);
  });
  closeInboxDetail();
}

async function taskEmail(email: EmailEntry) {
  await actOnEmail(`/api/email/messages/${email.id}/task`, (payload) => {
    tasks.value.unshift(payload as TaskEntry);
  });
  closeInboxDetail();
}

async function ignoreEmail(email: EmailEntry) {
  await actOnEmail(`/api/email/messages/${email.id}/ignore`);
  closeInboxDetail();
}

async function actOnEmail(url: string, apply?: (payload: unknown) => void) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    error.value = "E-Mail konnte nicht verarbeitet werden.";
    return;
  }

  if (response.status !== 204 && apply) apply(await response.json());
  await loadEmails();
}

async function setSourceStatus(link: LinkEntry, status: SourceStatus) {
  const payload: NewLinkEntry = {
    title: link.title,
    url: link.url,
    description: link.description,
    categoryId: link.categoryId,
    tags: [`status:${status}`, ...link.tags.filter((tag) => !tag.startsWith("status:"))]
  };

  const response = await fetch(`/api/links/${link.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "Source konnte nicht aktualisiert werden.";
    return;
  }

  const updated = await response.json() as LinkEntry;
  links.value = links.value.map((current) => current.id === link.id ? updated : current);
}

async function toggleTask(task: TaskEntry) {
  const response = await fetch(`/api/tasks/${task.id}/toggle`, { method: "PATCH" });
  if (!response.ok) {
    error.value = "Task konnte nicht aktualisiert werden.";
    return;
  }

  const updated = await response.json() as TaskEntry;
  tasks.value = tasks.value.map((current) => current.id === task.id ? updated : current);
}

async function syncSecondBrain() {
  await runGitAction("/api/second-brain/import", {});
  await loadNotes();
}

async function commitSecondBrain() {
  await runGitAction("/api/second-brain/git/commit", { message: gitForm.message });
}

async function pullSecondBrain() {
  await runGitAction("/api/second-brain/git/pull", gitTarget());
  await loadNotes();
}

async function pushSecondBrain(force: boolean) {
  if (force && !forcePushConfirmed.value) {
    gitResult.value = "Force push requires confirmation.";
    return;
  }

  await runGitAction(force ? "/api/second-brain/git/force-push" : "/api/second-brain/git/push", force ? { ...gitTarget(), confirm: true } : gitTarget());
  forcePushConfirmed.value = false;
}

async function runGitAction(url: string, body: object) {
  gitBusy.value = true;
  gitResult.value = "";
  error.value = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
      gitResult.value = payload.error ?? "Git action failed.";
      return;
    }

    gitResult.value = payload.message ?? JSON.stringify(payload);
  } finally {
    gitBusy.value = false;
    await loadGitStatus();
  }
}

function sourceStatus(link: LinkEntry): SourceStatus {
  const tag = link.tags.find((current) => current.startsWith("status:"));
  const status = tag?.replace("status:", "");
  return status === "keep" || status === "refine" || status === "archived" ? status : "inbox";
}

function normalizeTags(value: string, fallback?: string) {
  const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return fallback && !tags.some((tag) => tag.startsWith("status:")) ? [fallback, ...tags] : tags;
}

function gitTarget() {
  return { remote: gitForm.remote, branch: gitForm.branch };
}

function hasSourceHint(note: NoteEntry) {
  return /source|quelle|http|derived_from|supports/i.test(note.body);
}

function selectEmail(email: EmailEntry) {
  selectedInboxItem.value = { kind: "email", id: email.id };
}

function selectFeedItem(item: FeedItemEntry) {
  selectedInboxItem.value = { kind: "rss", id: item.id };
}

function closeInboxDetail() {
  selectedInboxItem.value = null;
}
</script>

<template>
  <div class="min-h-screen bg-base-100 text-base-content">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-base-300 bg-base-200 p-4 lg:block">
      <div class="mb-8">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">ChaosToolbox v2</p>
        <h1 class="mt-2 text-2xl font-semibold">Dev Cockpit</h1>
      </div>
      <nav class="grid gap-1" aria-label="Main navigation">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="btn justify-start rounded-md border-0"
          :class="activeView === item.id ? 'btn-primary text-primary-content' : 'btn-ghost'"
          type="button"
          @click="activeView = item.id"
        >
          <i class="fa-solid w-5" :class="item.icon"></i>
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <main class="lg:pl-64">
      <header class="sticky top-0 z-10 border-b border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur md:px-8">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="flex items-center gap-2 text-sm text-base-content/60">
              <i class="fa-solid" :class="currentView.icon"></i>
              {{ currentView.label }}
            </p>
            <h2 class="text-2xl font-semibold">
              <i class="fa-solid fa-toolbox mr-2 text-primary"></i>
              Local Knowledge Orchestrator
            </h2>
          </div>
          <div class="flex gap-2">
            <label class="input input-bordered flex min-w-0 items-center gap-2 rounded-md bg-base-200 md:w-96">
              <i class="fa-solid fa-magnifying-glass text-base-content/50"></i>
              <input v-model="search" class="grow" placeholder="Search" aria-label="Search">
            </label>
          </div>
        </div>
        <div class="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="btn btn-sm rounded-md"
            :class="activeView === item.id ? 'btn-primary text-primary-content' : 'btn-outline'"
            type="button"
            @click="activeView = item.id"
          >
            <i class="fa-solid" :class="item.icon"></i>
            {{ item.label }}
          </button>
        </div>
      </header>

      <div class="px-4 py-6 md:px-8">
        <div v-if="error" class="alert alert-error mb-4 rounded-md">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{{ error }}</span>
        </div>

        <div v-if="loading" class="flex min-h-80 items-center justify-center text-base-content/60">
          Loading...
        </div>

        <template v-else>
          <section v-if="activeView === 'dashboard'" class="grid gap-6">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <button
                v-for="stat in stats"
                :key="stat.label"
                class="rounded-md border border-base-300 bg-base-200 p-4 text-left transition hover:border-primary"
                type="button"
                @click="activeView = stat.label === 'Open Tasks' ? 'tasks' : stat.label.toLowerCase() as ViewId"
              >
                <i class="fa-solid text-primary" :class="stat.icon"></i>
                <div class="mt-4 text-3xl font-semibold">{{ stat.value }}</div>
                <div class="text-sm text-base-content/60">{{ stat.label }}</div>
              </button>
            </div>

            <section class="grid gap-4 rounded-md border border-base-300 bg-base-200 p-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 class="text-lg font-semibold">
                    <i class="fa-brands fa-git-alt mr-2 text-primary"></i>
                    Second Brain Git
                  </h3>
                  <p class="mt-1 text-sm text-base-content/60">
                    {{ gitStatus?.branch || "unknown" }}
                    <span v-if="gitStatus"> · ahead {{ gitStatus.ahead }} · behind {{ gitStatus.behind }}</span>
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span class="badge rounded-md" :class="gitStatus?.changed ? 'badge-warning' : 'badge-success'">
                    <i class="fa-solid" :class="gitStatus?.changed ? 'fa-code-branch' : 'fa-check'"></i>
                    {{ gitStatus?.changed ? 'changed' : 'clean' }}
                  </span>
                  <span v-if="gitStatus?.conflicts" class="badge badge-error rounded-md">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    conflicts
                  </span>
                  <span v-if="gitStatus?.authRequired" class="badge badge-error rounded-md">
                    <i class="fa-solid fa-key"></i>
                    auth required
                  </span>
                </div>
              </div>

              <div v-if="gitStatus?.authRequired" class="alert alert-warning rounded-md">
                <i class="fa-solid fa-key"></i>
                <span>Git authentication is missing or rejected. Configure Git credentials for the checked-out repo, then retry push or pull.</span>
              </div>
              <div v-if="gitStatus?.conflicts" class="alert alert-error rounded-md">
                <i class="fa-solid fa-code-merge"></i>
                <span>Merge conflicts need manual resolution in data/second-brain before the next sync or push.</span>
              </div>

              <label class="form-control">
                <span class="label-text">Commit message</span>
                <input v-model="gitForm.message" class="input input-bordered rounded-md bg-base-100" placeholder="Sync Second Brain" aria-label="Commit message">
              </label>

              <div class="grid gap-3 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Remote</span>
                  <select v-if="gitStatus?.remotes.length" v-model="gitForm.remote" class="select select-bordered rounded-md bg-base-100" aria-label="Git remote">
                    <option v-for="remote in gitStatus.remotes" :key="remote.name" :value="remote.name">
                      {{ remote.name }} · {{ remote.url }}
                    </option>
                  </select>
                  <input v-else v-model="gitForm.remote" class="input input-bordered rounded-md bg-base-100" placeholder="origin" aria-label="Git remote">
                </label>
                <label class="form-control">
                  <span class="label-text">Branch</span>
                  <input v-model="gitForm.branch" class="input input-bordered rounded-md bg-base-100" placeholder="main" aria-label="Git branch">
                </label>
              </div>

              <div class="flex flex-wrap gap-2">
                <button class="btn btn-outline rounded-md" type="button" :disabled="gitBusy" @click="syncSecondBrain">
                  <i class="fa-solid fa-rotate"></i>
                  Sync
                </button>
                <button class="btn btn-primary rounded-md" type="button" :disabled="gitBusy" @click="commitSecondBrain">
                  <i class="fa-solid fa-floppy-disk"></i>
                  Commit
                </button>
                <button class="btn btn-outline rounded-md" type="button" :disabled="gitBusy" @click="pullSecondBrain">
                  <i class="fa-solid fa-code-pull-request"></i>
                  Pull merge
                </button>
                <button class="btn btn-outline rounded-md" type="button" :disabled="gitBusy" @click="pushSecondBrain(false)">
                  <i class="fa-solid fa-upload"></i>
                  Push
                </button>
              </div>

              <div class="flex flex-col gap-2 border-t border-base-300 pt-3 sm:flex-row sm:items-center">
                <label class="label cursor-pointer justify-start gap-3">
                  <input v-model="forcePushConfirmed" type="checkbox" class="checkbox checkbox-warning" aria-label="Confirm force push">
                  <span class="label-text">Confirm force-with-lease push</span>
                </label>
                <button class="btn btn-warning rounded-md sm:ml-auto" type="button" :disabled="gitBusy || !forcePushConfirmed" @click="pushSecondBrain(true)">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  Force push
                </button>
              </div>

              <pre v-if="gitResult" class="max-h-40 overflow-auto rounded-md bg-base-300 p-3 text-xs whitespace-pre-wrap">{{ gitResult }}</pre>
              <div v-if="gitStatus?.files.length" class="grid gap-1 text-sm text-base-content/70">
                <span v-for="file in gitStatus.files.slice(0, 8)" :key="file" class="font-mono">{{ file }}</span>
              </div>
            </section>

            <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section class="grid gap-3">
                <h3 class="text-lg font-semibold">
                  <i class="fa-solid fa-inbox mr-2 text-primary"></i>
                  Inbox
                </h3>
                <SourceCard
                  v-for="source in inboxSources.slice(0, 5)"
                  :key="source.id"
                  :source="source"
                  @keep="setSourceStatus(source, 'keep')"
                  @refine="setSourceStatus(source, 'refine')"
                  @archive="setSourceStatus(source, 'archived')"
                />
              </section>

              <section class="grid gap-3">
                <h3 class="text-lg font-semibold">
                  <i class="fa-solid fa-magnifying-glass-chart mr-2 text-primary"></i>
                  Review Queue
                </h3>
                <article v-for="item in reviewItems.slice(0, 6)" :key="item.id" class="rounded-md border border-base-300 bg-base-200 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <span class="badge badge-outline rounded-md">
                        <i class="fa-solid" :class="item.icon"></i>
                        {{ item.kind }}
                      </span>
                      <h4 class="mt-2 font-semibold">{{ item.title }}</h4>
                      <p class="text-sm text-base-content/60">{{ item.reason }}</p>
                    </div>
                    <span class="text-right text-xs text-primary">{{ item.action }}</span>
                  </div>
                </article>
              </section>
            </div>
          </section>

          <section v-if="activeView === 'inbox'" class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
            <div class="grid content-start gap-4">
              <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="addSource">
                <h3 class="text-lg font-semibold">
                  <i class="fa-solid fa-link mr-2 text-primary"></i>
                  New Source
                </h3>
                <input v-model="sourceForm.title" class="input input-bordered rounded-md bg-base-100" required placeholder="Title" aria-label="Source title">
                <input v-model="sourceForm.url" class="input input-bordered rounded-md bg-base-100" required type="url" placeholder="https://..." aria-label="Source URL">
                <textarea v-model="sourceForm.description" class="textarea textarea-bordered min-h-28 rounded-md bg-base-100" placeholder="Notes" aria-label="Source notes"></textarea>
                <input v-model="sourceForm.tags" class="input input-bordered rounded-md bg-base-100" placeholder="tags" aria-label="Source tags">
                <button class="btn btn-primary rounded-md" type="submit">
                  <i class="fa-solid fa-plus"></i>
                  Add
                </button>
              </form>

              <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="addFeed">
                <h3 class="text-lg font-semibold">
                  <i class="fa-solid fa-rss mr-2 text-primary"></i>
                  RSS Feed
                </h3>
                <input v-model="feedForm.title" class="input input-bordered rounded-md bg-base-100" required placeholder="Title" aria-label="Feed title">
                <input v-model="feedForm.url" class="input input-bordered rounded-md bg-base-100" required type="url" placeholder="https://.../feed.xml" aria-label="Feed URL">
                <button class="btn btn-primary rounded-md" type="submit">
                  <i class="fa-solid fa-plus"></i>
                  Add feed
                </button>
                <button class="btn btn-outline rounded-md" type="button" :disabled="feeds.length === 0" @click="refreshAllFeeds">
                  <i class="fa-solid fa-arrows-rotate"></i>
                  Refresh all
                </button>
                <div v-for="feed in feeds" :key="feed.id" class="flex items-center gap-2 rounded-md border border-base-300 bg-base-100 p-2">
                  <button class="btn btn-sm btn-outline min-w-0 flex-1 justify-start rounded-md" type="button" :disabled="!feed.enabled" @click="fetchFeed(feed)">
                    <i class="fa-solid fa-rotate"></i>
                    <span class="truncate">{{ feed.title }}</span>
                  </button>
                  <button class="btn btn-sm btn-square rounded-md" :class="feed.enabled ? 'btn-outline' : 'btn-primary'" type="button" :aria-label="feed.enabled ? 'Pause feed' : 'Resume feed'" @click="setFeedEnabled(feed, !feed.enabled)">
                    <i class="fa-solid" :class="feed.enabled ? 'fa-pause' : 'fa-play'"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-ghost rounded-md" type="button" aria-label="Delete feed" @click="deleteFeed(feed)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
                <textarea v-model="opmlForm.body" class="textarea textarea-bordered min-h-28 rounded-md bg-base-100" placeholder="OPML import" aria-label="OPML import"></textarea>
                <button class="btn btn-outline rounded-md" type="button" :disabled="!opmlForm.body.trim()" @click="importOpml">
                  <i class="fa-solid fa-file-import"></i>
                  Import OPML
                </button>
              </form>

              <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="importEmail">
                <h3 class="text-lg font-semibold">
                  <i class="fa-solid fa-envelope mr-2 text-primary"></i>
                  E-Mail Import
                </h3>
                <textarea v-model="emailForm.raw" class="textarea textarea-bordered min-h-40 rounded-md bg-base-100 font-mono text-xs" required placeholder="Raw .eml" aria-label="Raw email"></textarea>
                <button class="btn btn-primary rounded-md" type="submit" :disabled="!emailForm.raw.trim()">
                  <i class="fa-solid fa-file-import"></i>
                  Import
                </button>
              </form>
            </div>

            <div class="grid content-start gap-3">
              <article v-for="email in emails.filter((current) => current.status === 'new').slice(0, 10)" :key="email.id" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <span class="badge badge-outline rounded-md">
                      <i class="fa-solid fa-envelope"></i>
                      {{ email.fromAddress || 'unknown sender' }}
                    </span>
                    <h3 class="mt-2 text-xl font-semibold">{{ email.subject }}</h3>
                    <p class="mt-1 text-sm text-base-content/60">{{ email.receivedAt || 'no date' }}</p>
                    <p class="mt-2 line-clamp-3 whitespace-pre-line text-sm text-base-content/75">{{ email.body }}</p>
                    <div v-if="email.attachments.length" class="mt-3 flex flex-wrap gap-2">
                      <a
                        v-for="attachment in email.attachments"
                        :key="attachment.id"
                        class="badge badge-outline rounded-md"
                        :href="`/api/email/messages/${email.id}/attachments/${attachment.id}`"
                      >
                        <i class="fa-solid fa-paperclip"></i>
                        {{ attachment.filename }}
                      </a>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 md:justify-end">
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="selectEmail(email)">
                      <i class="fa-solid fa-eye"></i>
                      Open
                    </button>
                    <button class="btn btn-sm btn-primary rounded-md" type="button" @click="saveEmail(email)">
                      <i class="fa-solid fa-inbox"></i>
                      Source
                    </button>
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="noteEmail(email)">
                      <i class="fa-solid fa-note-sticky"></i>
                      Note
                    </button>
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="taskEmail(email)">
                      <i class="fa-solid fa-list-check"></i>
                      Task
                    </button>
                    <button class="btn btn-sm btn-ghost rounded-md" type="button" @click="ignoreEmail(email)">
                      <i class="fa-solid fa-box-archive"></i>
                      Ignore
                    </button>
                  </div>
                </div>
              </article>

              <article v-for="item in feedItems.filter((current) => current.status === 'new').slice(0, 10)" :key="item.id" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <span class="badge badge-outline rounded-md">
                      <i class="fa-solid fa-rss"></i>
                      {{ item.feedTitle }}
                    </span>
                    <h3 class="mt-2 text-xl font-semibold">{{ item.title }}</h3>
                    <a class="mt-1 inline-flex max-w-full items-center gap-2 truncate text-sm text-primary" :href="item.url" target="_blank" rel="noreferrer">
                      <i class="fa-solid fa-arrow-up-right-from-square"></i>
                      <span class="truncate">{{ item.url }}</span>
                    </a>
                    <p v-if="item.summary" class="mt-2 line-clamp-3 text-sm text-base-content/75">{{ item.summary }}</p>
                  </div>
                  <div class="flex flex-wrap gap-2 md:justify-end">
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="selectFeedItem(item)">
                      <i class="fa-solid fa-eye"></i>
                      Open
                    </button>
                    <button class="btn btn-sm btn-primary rounded-md" type="button" @click="saveFeedItem(item)">
                      <i class="fa-solid fa-inbox"></i>
                      Save
                    </button>
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="noteFeedItem(item)">
                      <i class="fa-solid fa-note-sticky"></i>
                      Note
                    </button>
                    <button class="btn btn-sm btn-outline rounded-md" type="button" @click="taskFeedItem(item)">
                      <i class="fa-solid fa-list-check"></i>
                      Task
                    </button>
                    <button class="btn btn-sm btn-ghost rounded-md" type="button" @click="ignoreFeedItem(item)">
                      <i class="fa-solid fa-box-archive"></i>
                      Ignore
                    </button>
                  </div>
                </div>
              </article>
              <SourceCard
                v-for="source in inboxSources"
                :key="source.id"
                :source="source"
                @keep="setSourceStatus(source, 'keep')"
                @refine="setSourceStatus(source, 'refine')"
                @archive="setSourceStatus(source, 'archived')"
              />
            </div>

            <aside class="grid content-start gap-3 xl:sticky xl:top-28">
              <article v-if="selectedEmail" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex items-start justify-between gap-3">
                  <span class="badge badge-outline rounded-md">
                    <i class="fa-solid fa-envelope"></i>
                    E-Mail
                  </span>
                  <button class="btn btn-sm btn-square btn-ghost rounded-md" type="button" aria-label="Close detail" @click="closeInboxDetail">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <h3 class="mt-3 text-xl font-semibold">{{ selectedEmail.subject }}</h3>
                <dl class="mt-3 grid gap-1 text-sm text-base-content/70">
                  <div><dt class="inline font-semibold">From:</dt> <dd class="inline">{{ selectedEmail.fromAddress || 'unknown sender' }}</dd></div>
                  <div><dt class="inline font-semibold">To:</dt> <dd class="inline">{{ selectedEmail.toAddress || 'unknown recipient' }}</dd></div>
                  <div><dt class="inline font-semibold">Date:</dt> <dd class="inline">{{ selectedEmail.receivedAt || 'no date' }}</dd></div>
                </dl>
                <p class="mt-4 max-h-[50vh] overflow-auto whitespace-pre-line rounded-md bg-base-100 p-3 text-sm leading-6">{{ selectedEmail.body }}</p>
                <div v-if="selectedEmail.attachments.length" class="mt-3 flex flex-wrap gap-2">
                  <a
                    v-for="attachment in selectedEmail.attachments"
                    :key="attachment.id"
                    class="badge badge-outline rounded-md"
                    :href="`/api/email/messages/${selectedEmail.id}/attachments/${attachment.id}`"
                  >
                    <i class="fa-solid fa-paperclip"></i>
                    {{ attachment.filename }}
                  </a>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="btn btn-sm btn-primary rounded-md" type="button" @click="saveEmail(selectedEmail)">
                    <i class="fa-solid fa-inbox"></i>
                    Source
                  </button>
                  <button class="btn btn-sm btn-outline rounded-md" type="button" @click="noteEmail(selectedEmail)">
                    <i class="fa-solid fa-note-sticky"></i>
                    Note
                  </button>
                  <button class="btn btn-sm btn-outline rounded-md" type="button" @click="taskEmail(selectedEmail)">
                    <i class="fa-solid fa-list-check"></i>
                    Task
                  </button>
                  <button class="btn btn-sm btn-ghost rounded-md" type="button" @click="ignoreEmail(selectedEmail)">
                    <i class="fa-solid fa-box-archive"></i>
                    Ignore
                  </button>
                </div>
              </article>

              <article v-else-if="selectedFeedItem" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex items-start justify-between gap-3">
                  <span class="badge badge-outline rounded-md">
                    <i class="fa-solid fa-rss"></i>
                    {{ selectedFeedItem.feedTitle }}
                  </span>
                  <button class="btn btn-sm btn-square btn-ghost rounded-md" type="button" aria-label="Close detail" @click="closeInboxDetail">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <h3 class="mt-3 text-xl font-semibold">{{ selectedFeedItem.title }}</h3>
                <a class="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-primary" :href="selectedFeedItem.url" target="_blank" rel="noreferrer">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span class="truncate">{{ selectedFeedItem.url }}</span>
                </a>
                <p v-if="selectedFeedItem.publishedAt" class="mt-2 text-sm text-base-content/60">{{ selectedFeedItem.publishedAt }}</p>
                <p class="mt-4 max-h-[50vh] overflow-auto whitespace-pre-line rounded-md bg-base-100 p-3 text-sm leading-6">
                  {{ selectedFeedItem.summary || 'No summary available.' }}
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="btn btn-sm btn-primary rounded-md" type="button" @click="saveFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-inbox"></i>
                    Save
                  </button>
                  <button class="btn btn-sm btn-outline rounded-md" type="button" @click="noteFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-note-sticky"></i>
                    Note
                  </button>
                  <button class="btn btn-sm btn-outline rounded-md" type="button" @click="taskFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-list-check"></i>
                    Task
                  </button>
                  <button class="btn btn-sm btn-ghost rounded-md" type="button" @click="ignoreFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-box-archive"></i>
                    Ignore
                  </button>
                </div>
              </article>

              <article v-else class="rounded-md border border-dashed border-base-300 bg-base-200 p-4 text-sm text-base-content/60">
                <i class="fa-solid fa-eye mr-2"></i>
                Select an RSS item or e-mail to inspect it.
              </article>
            </aside>
          </section>

          <section v-if="activeView === 'sources'" class="grid gap-3">
            <SourceCard
              v-for="source in filteredSources"
              :key="source.id"
              :source="source"
              @keep="setSourceStatus(source, 'keep')"
              @refine="setSourceStatus(source, 'refine')"
              @archive="setSourceStatus(source, 'archived')"
            />
          </section>

          <section v-if="activeView === 'notes'" class="grid gap-4 xl:grid-cols-[360px_1fr]">
            <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="addNote">
              <h3 class="text-lg font-semibold">
                <i class="fa-solid fa-note-sticky mr-2 text-primary"></i>
                New Note
              </h3>
              <input v-model="noteForm.title" class="input input-bordered rounded-md bg-base-100" required placeholder="Title" aria-label="Note title">
              <textarea v-model="noteForm.body" class="textarea textarea-bordered min-h-40 rounded-md bg-base-100" placeholder="Markdown" aria-label="Note body"></textarea>
              <button class="btn btn-primary rounded-md" type="submit">
                <i class="fa-solid fa-plus"></i>
                Add
              </button>
            </form>

            <div class="grid content-start gap-3">
              <article v-for="note in filteredNotes" :key="note.id" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-wrap gap-2">
                  <span v-if="note.categoryName" class="badge badge-primary rounded-md">
                    <i class="fa-solid fa-folder"></i>
                    {{ note.categoryName }}
                  </span>
                  <span v-if="hasSourceHint(note)" class="badge badge-outline rounded-md">
                    <i class="fa-solid fa-link"></i>
                    source-linked
                  </span>
                </div>
                <h3 class="mt-2 text-xl font-semibold">{{ note.title }}</h3>
                <p class="mt-2 whitespace-pre-line text-sm leading-6 text-base-content/75">{{ note.body }}</p>
              </article>
            </div>
          </section>

          <section v-if="activeView === 'tasks'" class="grid gap-4 xl:grid-cols-[360px_1fr]">
            <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="addTask">
              <h3 class="text-lg font-semibold">
                <i class="fa-solid fa-list-check mr-2 text-primary"></i>
                New Task
              </h3>
              <input v-model="taskForm.title" class="input input-bordered rounded-md bg-base-100" required placeholder="Title" aria-label="Task title">
              <textarea v-model="taskForm.notes" class="textarea textarea-bordered min-h-28 rounded-md bg-base-100" placeholder="Notes" aria-label="Task notes"></textarea>
              <input v-model="taskForm.tags" class="input input-bordered rounded-md bg-base-100" placeholder="tags" aria-label="Task tags">
              <button class="btn btn-primary rounded-md" type="submit">
                <i class="fa-solid fa-plus"></i>
                Add
              </button>
            </form>

            <div class="grid content-start gap-3">
              <article v-for="task in filteredTasks" :key="task.id" class="rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex items-start gap-3">
                  <button class="btn btn-square btn-sm rounded-md" :class="task.done ? 'btn-primary' : 'btn-outline'" type="button" :aria-label="task.done ? 'Reopen task' : 'Complete task'" @click="toggleTask(task)">
                    <i class="fa-solid" :class="task.done ? 'fa-check' : 'fa-circle'"></i>
                  </button>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold" :class="task.done ? 'line-through text-base-content/50' : ''">{{ task.title }}</h3>
                    <p v-if="task.notes" class="mt-1 text-sm text-base-content/70">{{ task.notes }}</p>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <span v-for="tag in task.tags" :key="tag" class="badge badge-outline rounded-md">
                        <i class="fa-solid fa-tag"></i>
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section v-if="activeView === 'reviews'" class="grid gap-3">
            <article v-for="item in reviewItems" :key="item.id" class="rounded-md border border-base-300 bg-base-200 p-4">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <span class="badge badge-outline rounded-md">
                    <i class="fa-solid" :class="item.icon"></i>
                    {{ item.kind }}
                  </span>
                  <h3 class="mt-2 text-xl font-semibold">{{ item.title }}</h3>
                  <p class="text-base-content/60">{{ item.reason }}</p>
                </div>
                <span class="badge badge-primary rounded-md">{{ item.action }}</span>
              </div>
            </article>
          </section>
        </template>
      </div>
    </main>
  </div>
</template>
