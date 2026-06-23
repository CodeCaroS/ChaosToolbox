<script setup lang="ts">
import SourceCard from "../SourceCard.vue";
import type { LinkEntry } from "../modules/linklist/types";

type ViewId = "dashboard" | "inbox" | "sources" | "notes" | "git" | "tasks";
type SourceStatus = "inbox" | "keep" | "refine" | "archived";
type DashboardStat = { label: string; value: number; icon: string };
type DashboardSource = LinkEntry & { status: SourceStatus; body: string };
type ReviewQueueItem = {
  entityType: string;
  entityId: number;
  type: string;
  title: string;
  status: string;
  summary: string | null;
  reviewStage: string;
  reviewOrder: number;
};
type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  changed: boolean;
  conflicts: boolean;
  files: string[];
  authRequired: boolean;
};

defineProps<{
  stats: DashboardStat[];
  inboxSources: DashboardSource[];
  reviewQueue: ReviewQueueItem[];
  gitStatus: GitStatus | null;
  gitBusy: boolean;
}>();

const emit = defineEmits<{
  navigate: [view: ViewId];
  syncGit: [];
  setSourceStatus: [source: DashboardSource, status: SourceStatus];
  setReviewStatus: [item: ReviewQueueItem, status: string];
}>();

function statView(label: string): ViewId {
  if (label === "Open Tasks") return "tasks";
  if (label === "Sources") return "sources";
  if (label === "Notes") return "notes";
  return label.toLowerCase() as ViewId;
}

function reviewStatus(item: ReviewQueueItem, action: "keep" | "refine" | "archive") {
  if (action === "archive") return "archived";
  if (action === "keep") return item.type === "source" ? "keep" : "reviewed";
  return item.type === "source" ? "refine" : "review";
}
</script>

<template>
  <section class="grid gap-6">
    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="grid gap-3 rounded-md border border-base-300 bg-base-200 p-4">
        <div>
          <p class="text-sm text-base-content/60">Command Center</p>
          <h3 class="text-2xl font-semibold">Today in your Second Brain</h3>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-md border border-base-300 bg-base-100 p-4 text-left transition hover:border-primary"
            type="button"
            @click="emit('navigate', statView(stat.label))"
          >
            <i class="fa-solid text-primary" :class="stat.icon"></i>
            <div class="mt-4 text-3xl font-semibold">{{ stat.value }}</div>
            <div class="text-sm text-base-content/60">{{ stat.label }}</div>
          </button>
        </div>
      </div>

      <aside class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-base-content/60">Second Brain Git</p>
            <h3 class="text-xl font-semibold">{{ gitStatus?.branch || "No branch" }}</h3>
          </div>
          <span class="badge rounded-md" :class="gitStatus?.conflicts || gitStatus?.authRequired ? 'badge-error' : gitStatus?.changed ? 'badge-warning' : 'badge-success'">
            {{ gitStatus?.conflicts ? "conflicts" : gitStatus?.authRequired ? "auth" : gitStatus?.changed ? "changed" : "clean" }}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-md bg-base-100 p-2">
            <div class="text-lg font-semibold">{{ gitStatus?.files.length ?? 0 }}</div>
            <div class="text-xs text-base-content/60">changes</div>
          </div>
          <div class="rounded-md bg-base-100 p-2">
            <div class="text-lg font-semibold">{{ gitStatus?.ahead ?? 0 }}</div>
            <div class="text-xs text-base-content/60">ahead</div>
          </div>
          <div class="rounded-md bg-base-100 p-2">
            <div class="text-lg font-semibold">{{ gitStatus?.behind ?? 0 }}</div>
            <div class="text-xs text-base-content/60">behind</div>
          </div>
        </div>
        <div class="join">
          <button class="btn btn-primary btn-sm btn-square join-item" type="button" :disabled="gitBusy" aria-label="Sync Git" title="Sync Git" @click="emit('syncGit')">
            <i class="fa-solid" :class="gitBusy ? 'fa-spinner fa-spin' : 'fa-rotate'"></i>
          </button>
          <button class="btn btn-outline btn-sm btn-square join-item" type="button" aria-label="Open Git" title="Open Git" @click="emit('navigate', 'git')">
            <i class="fa-solid fa-code-branch"></i>
          </button>
        </div>
      </aside>
    </div>

    <div class="grid gap-6">
      <section class="grid gap-3">
        <h3 class="text-lg font-semibold">
          <i class="fa-solid fa-inbox mr-2 text-primary"></i>
          Inbox
        </h3>
        <SourceCard
          v-for="source in inboxSources.slice(0, 5)"
          :key="source.id"
          :source="source"
          @keep="emit('setSourceStatus', source, 'keep')"
          @refine="emit('setSourceStatus', source, 'refine')"
          @archive="emit('setSourceStatus', source, 'archived')"
        />
      </section>

      <section class="grid gap-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold">
            <i class="fa-solid fa-list-check mr-2 text-primary"></i>
            Review Queue
          </h3>
          <span class="badge rounded-md badge-outline">{{ reviewQueue.length }}</span>
        </div>
        <div v-if="reviewQueue.length" class="grid gap-3">
          <article
            v-for="item in reviewQueue.slice(0, 5)"
            :key="`${item.entityType}:${item.entityId}`"
            class="grid gap-3 rounded-md border border-base-300 bg-base-200 p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="badge rounded-md badge-outline">{{ item.reviewStage }}</span>
                  <span class="badge rounded-md badge-ghost">{{ item.type }}</span>
                </div>
                <h4 class="mt-2 truncate text-base font-semibold">{{ item.title }}</h4>
                <p v-if="item.summary" class="mt-1 line-clamp-2 text-sm text-base-content/70">{{ item.summary }}</p>
              </div>
              <div class="join shrink-0">
                <button class="btn btn-sm btn-square join-item" type="button" aria-label="Keep item" title="Keep" @click="emit('setReviewStatus', item, reviewStatus(item, 'keep'))">
                  <i class="fa-solid fa-bookmark"></i>
                </button>
                <button class="btn btn-sm btn-square join-item" type="button" aria-label="Refine item" title="Refine" @click="emit('setReviewStatus', item, reviewStatus(item, 'refine'))">
                  <i class="fa-solid fa-wand-magic-sparkles"></i>
                </button>
                <button class="btn btn-sm btn-square join-item" type="button" aria-label="Archive item" title="Archive" @click="emit('setReviewStatus', item, reviewStatus(item, 'archive'))">
                  <i class="fa-solid fa-box-archive"></i>
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="rounded-md border border-dashed border-base-300 bg-base-200 p-3 text-sm text-base-content/70">No review items yet.</p>
      </section>
    </div>
  </section>
</template>
