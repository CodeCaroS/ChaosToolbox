<script setup lang="ts">
import { computed } from "vue";
import SourceCard from "../SourceCard.vue";
import type { LinkEntry } from "../modules/linklist/types";
import type { NoteEntry } from "../modules/notes/types";
import type { FeedItemEntry } from "../modules/rss/types";
import type { EmailEntry } from "../modules/email/types";
import type { InboxFilter, InboxListItem, InboxSort } from "../modules/inbox/sortFilter";

type SourceStatus = "inbox" | "keep" | "refine" | "archived";
type InboxItem =
  | (InboxListItem & { kind: "email"; email: EmailEntry })
  | (InboxListItem & { kind: "rss"; feedItem: FeedItemEntry })
  | (InboxListItem & { kind: "source"; source: LinkEntry & { status: SourceStatus; body: string } })
  | (InboxListItem & { kind: "note"; note: NoteEntry });

const props = defineProps<{
  inboxFilter: InboxFilter;
  inboxSort: InboxSort;
  sourceForm: { url: string };
  visibleInboxItems: InboxItem[];
  selectedEmail: EmailEntry | null;
  selectedFeedItem: FeedItemEntry | null;
  selectEmail: (email: EmailEntry) => void;
  selectFeedItem: (item: FeedItemEntry) => void;
  closeInboxDetail: () => void;
  openInboxNote: (note: NoteEntry) => void;
  saveEmail: (email: EmailEntry) => void;
  noteEmail: (email: EmailEntry) => void;
  taskEmail: (email: EmailEntry) => void;
  ignoreEmail: (email: EmailEntry) => void;
  saveFeedItem: (item: FeedItemEntry) => void;
  noteFeedItem: (item: FeedItemEntry) => void;
  taskFeedItem: (item: FeedItemEntry) => void;
  ignoreFeedItem: (item: FeedItemEntry) => void;
  importArticle: () => void;
  noteSource: (source: LinkEntry & { status: SourceStatus; body: string }) => void;
  setSourceStatus: (source: LinkEntry & { status: SourceStatus; body: string }, status: SourceStatus) => void;
}>();

const emit = defineEmits<{
  "update:inboxFilter": [value: InboxFilter];
  "update:inboxSort": [value: InboxSort];
}>();

const inboxFilterModel = computed({
  get: () => props.inboxFilter,
  set: (value) => emit("update:inboxFilter", value)
});
const inboxSortModel = computed({
  get: () => props.inboxSort,
  set: (value) => emit("update:inboxSort", value)
});
</script>

<template>
          <section class="grid max-w-full min-w-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div class="grid min-w-0 content-start gap-3">
              <form class="flex min-w-0 gap-2 rounded-md border border-base-300 bg-base-200 p-3" @submit.prevent="importArticle">
                <label class="input input-bordered flex min-w-0 flex-1 items-center gap-2 rounded-md bg-base-100">
                  <i class="fa-solid fa-link text-base-content/50"></i>
                  <input v-model="sourceForm.url" class="grow" type="url" required placeholder="Artikel-URL" aria-label="Artikel-URL" />
                </label>
                <button class="btn btn-square btn-primary rounded-md" type="submit" aria-label="Artikel importieren" title="Artikel importieren">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </form>

              <div class="flex flex-col gap-2 rounded-md border border-base-300 bg-base-200 p-3 sm:flex-row sm:items-center">
                <label class="select select-bordered min-w-0 rounded-md bg-base-100 sm:w-44">
                  <span class="label">Filter</span>
                  <select v-model="inboxFilterModel" aria-label="Inbox filter">
                    <option value="all">All</option>
                    <option value="email">E-Mail</option>
                    <option value="rss">RSS</option>
                    <option value="source">Sources</option>
                    <option value="note">Notes</option>
                  </select>
                </label>
                <label class="select select-bordered min-w-0 rounded-md bg-base-100 sm:w-48">
                  <span class="label">Sort</span>
                  <select v-model="inboxSortModel" aria-label="Inbox sort">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </label>
                <span class="text-sm text-base-content/60 sm:ml-auto">{{ visibleInboxItems.length }} items</span>
              </div>

              <template v-for="inboxItem in visibleInboxItems" :key="`${inboxItem.kind}-${inboxItem.id}`">
              <article v-if="inboxItem.kind === 'email'" class="min-w-0 rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <span class="badge badge-outline max-w-full rounded-md">
                      <i class="fa-solid fa-envelope"></i>
                      <span class="truncate">{{ inboxItem.email.fromAddress || 'unknown sender' }}</span>
                    </span>
                    <h3 class="mt-2 break-words text-xl font-semibold">{{ inboxItem.email.subject }}</h3>
                    <p class="mt-1 text-sm text-base-content/60">{{ inboxItem.email.receivedAt || 'no date' }}</p>
                    <p class="mt-2 line-clamp-3 break-words whitespace-pre-line text-sm text-base-content/75">{{ inboxItem.email.body }}</p>
                    <div v-if="inboxItem.email.attachments.length" class="mt-3 flex flex-wrap gap-2">
                      <a
                        v-for="attachment in inboxItem.email.attachments"
                        :key="attachment.id"
                        class="badge badge-outline max-w-full rounded-md"
                        :href="`/api/email/messages/${inboxItem.email.id}/attachments/${attachment.id}`"
                      >
                        <i class="fa-solid fa-paperclip"></i>
                        <span class="truncate">{{ attachment.filename }}</span>
                      </a>
                    </div>
                  </div>
                  <div class="join md:justify-end">
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Open e-mail" title="Open e-mail" @click="selectEmail(inboxItem.email)">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-primary join-item" type="button" aria-label="Save e-mail as source" title="Save e-mail as source" @click="saveEmail(inboxItem.email)">
                      <i class="fa-solid fa-inbox"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create note from e-mail" title="Create note from e-mail" @click="noteEmail(inboxItem.email)">
                      <i class="fa-solid fa-note-sticky"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create task from e-mail" title="Create task from e-mail" @click="taskEmail(inboxItem.email)">
                      <i class="fa-solid fa-list-check"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-ghost join-item" type="button" aria-label="Ignore e-mail" title="Ignore e-mail" @click="ignoreEmail(inboxItem.email)">
                      <i class="fa-solid fa-box-archive"></i>
                    </button>
                  </div>
                </div>
              </article>

              <article v-else-if="inboxItem.kind === 'rss'" class="min-w-0 rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <span class="badge badge-outline max-w-full rounded-md">
                      <i class="fa-solid fa-rss"></i>
                      <span class="truncate">{{ inboxItem.feedItem.feedTitle }}</span>
                    </span>
                    <h3 class="mt-2 break-words text-xl font-semibold">{{ inboxItem.feedItem.title }}</h3>
                    <a class="mt-1 inline-flex max-w-full items-center gap-2 truncate text-sm text-primary" :href="inboxItem.feedItem.url" target="_blank" rel="noreferrer">
                      <i class="fa-solid fa-arrow-up-right-from-square"></i>
                      <span class="truncate">{{ inboxItem.feedItem.url }}</span>
                    </a>
                    <p v-if="inboxItem.feedItem.summary" class="mt-2 line-clamp-3 break-words text-sm text-base-content/75">{{ inboxItem.feedItem.summary }}</p>
                  </div>
                  <div class="join md:justify-end">
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Open RSS item" title="Open RSS item" @click="selectFeedItem(inboxItem.feedItem)">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-primary join-item" type="button" aria-label="Save RSS item" title="Save RSS item" @click="saveFeedItem(inboxItem.feedItem)">
                      <i class="fa-solid fa-inbox"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create note from RSS item" title="Create note from RSS item" @click="noteFeedItem(inboxItem.feedItem)">
                      <i class="fa-solid fa-note-sticky"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create task from RSS item" title="Create task from RSS item" @click="taskFeedItem(inboxItem.feedItem)">
                      <i class="fa-solid fa-list-check"></i>
                    </button>
                    <button class="btn btn-sm btn-square btn-ghost join-item" type="button" aria-label="Ignore RSS item" title="Ignore RSS item" @click="ignoreFeedItem(inboxItem.feedItem)">
                      <i class="fa-solid fa-box-archive"></i>
                    </button>
                  </div>
                </div>
              </article>
              <SourceCard
                v-else-if="inboxItem.kind === 'source'"
                :source="inboxItem.source"
                show-note
                @keep="setSourceStatus(inboxItem.source, 'keep')"
                @refine="setSourceStatus(inboxItem.source, 'refine')"
                @note="noteSource(inboxItem.source)"
                @archive="setSourceStatus(inboxItem.source, 'archived')"
              />

              <article v-else class="min-w-0 rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <span class="badge badge-outline max-w-full rounded-md">
                      <i class="fa-solid fa-note-sticky"></i>
                      <span class="truncate">{{ inboxItem.note.sourcePath || '00-inbox' }}</span>
                    </span>
                    <h3 class="mt-2 break-words text-xl font-semibold">{{ inboxItem.note.title }}</h3>
                    <p class="mt-2 line-clamp-3 break-words whitespace-pre-line text-sm text-base-content/75">{{ inboxItem.note.body }}</p>
                  </div>
                  <button class="btn btn-sm btn-square btn-outline rounded-md" type="button" aria-label="Open note" title="Open note" @click="openInboxNote(inboxItem.note)">
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
              </article>
              </template>
            </div>

            <aside class="grid min-w-0 content-start gap-3 xl:sticky xl:top-28">
              <article v-if="selectedEmail" class="min-w-0 rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex items-start justify-between gap-3">
                  <span class="badge badge-outline rounded-md">
                    <i class="fa-solid fa-envelope"></i>
                    E-Mail
                  </span>
                  <button class="btn btn-sm btn-square btn-ghost rounded-md" type="button" aria-label="Close detail" @click="closeInboxDetail">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <h3 class="mt-3 break-words text-xl font-semibold">{{ selectedEmail.subject }}</h3>
                <dl class="mt-3 grid gap-1 text-sm text-base-content/70">
                  <div class="break-words"><dt class="inline font-semibold">From:</dt> <dd class="inline">{{ selectedEmail.fromAddress || 'unknown sender' }}</dd></div>
                  <div class="break-words"><dt class="inline font-semibold">To:</dt> <dd class="inline">{{ selectedEmail.toAddress || 'unknown recipient' }}</dd></div>
                  <div><dt class="inline font-semibold">Date:</dt> <dd class="inline">{{ selectedEmail.receivedAt || 'no date' }}</dd></div>
                </dl>
                <p class="mt-4 max-h-[50vh] overflow-auto break-words whitespace-pre-line rounded-md bg-base-100 p-3 text-sm leading-6">{{ selectedEmail.body }}</p>
                <div v-if="selectedEmail.attachments.length" class="mt-3 flex flex-wrap gap-2">
                  <a
                    v-for="attachment in selectedEmail.attachments"
                    :key="attachment.id"
                    class="badge badge-outline max-w-full rounded-md"
                    :href="`/api/email/messages/${selectedEmail.id}/attachments/${attachment.id}`"
                  >
                    <i class="fa-solid fa-paperclip"></i>
                    <span class="truncate">{{ attachment.filename }}</span>
                  </a>
                </div>
                <div class="join mt-4">
                  <button class="btn btn-sm btn-square btn-primary join-item" type="button" aria-label="Save e-mail as source" title="Save e-mail as source" @click="saveEmail(selectedEmail)">
                    <i class="fa-solid fa-inbox"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create note from e-mail" title="Create note from e-mail" @click="noteEmail(selectedEmail)">
                    <i class="fa-solid fa-note-sticky"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create task from e-mail" title="Create task from e-mail" @click="taskEmail(selectedEmail)">
                    <i class="fa-solid fa-list-check"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-ghost join-item" type="button" aria-label="Ignore e-mail" title="Ignore e-mail" @click="ignoreEmail(selectedEmail)">
                    <i class="fa-solid fa-box-archive"></i>
                  </button>
                </div>
              </article>

              <article v-else-if="selectedFeedItem" class="min-w-0 rounded-md border border-base-300 bg-base-200 p-4">
                <div class="flex items-start justify-between gap-3">
                  <span class="badge badge-outline max-w-full rounded-md">
                    <i class="fa-solid fa-rss"></i>
                    <span class="truncate">{{ selectedFeedItem.feedTitle }}</span>
                  </span>
                  <button class="btn btn-sm btn-square btn-ghost rounded-md" type="button" aria-label="Close detail" @click="closeInboxDetail">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <h3 class="mt-3 break-words text-xl font-semibold">{{ selectedFeedItem.title }}</h3>
                <a class="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-primary" :href="selectedFeedItem.url" target="_blank" rel="noreferrer">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span class="truncate">{{ selectedFeedItem.url }}</span>
                </a>
                <p v-if="selectedFeedItem.publishedAt" class="mt-2 text-sm text-base-content/60">{{ selectedFeedItem.publishedAt }}</p>
                <p class="mt-4 max-h-[50vh] overflow-auto break-words whitespace-pre-line rounded-md bg-base-100 p-3 text-sm leading-6">
                  {{ selectedFeedItem.summary || 'No summary available.' }}
                </p>
                <div class="join mt-4">
                  <button class="btn btn-sm btn-square btn-primary join-item" type="button" aria-label="Save RSS item" title="Save RSS item" @click="saveFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-inbox"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create note from RSS item" title="Create note from RSS item" @click="noteFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-note-sticky"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-outline join-item" type="button" aria-label="Create task from RSS item" title="Create task from RSS item" @click="taskFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-list-check"></i>
                  </button>
                  <button class="btn btn-sm btn-square btn-ghost join-item" type="button" aria-label="Ignore RSS item" title="Ignore RSS item" @click="ignoreFeedItem(selectedFeedItem)">
                    <i class="fa-solid fa-box-archive"></i>
                  </button>
                </div>
              </article>
            </aside>
          </section>
</template>
