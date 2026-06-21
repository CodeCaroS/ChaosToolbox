<script setup lang="ts">
import type { LinkEntry } from "./modules/linklist/types";

type SourceStatus = "inbox" | "keep" | "refine" | "archived";

defineProps<{
  source: LinkEntry & { status: SourceStatus; body: string };
}>();

defineEmits<{
  keep: [];
  refine: [];
  archive: [];
}>();

const statusIcons: Record<SourceStatus, string> = {
  inbox: "fa-inbox",
  keep: "fa-bookmark",
  refine: "fa-pen-nib",
  archived: "fa-box-archive"
};
</script>

<template>
  <article class="rounded-md border border-base-300 bg-base-200 p-4">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap gap-2">
          <span class="badge rounded-md" :class="source.status === 'keep' ? 'badge-primary' : 'badge-outline'">
            <i class="fa-solid" :class="statusIcons[source.status]"></i>
            {{ source.status }}
          </span>
          <span v-for="tag in source.tags.filter((current) => !current.startsWith('status:'))" :key="tag" class="badge badge-outline rounded-md">
            <i class="fa-solid fa-tag"></i>
            {{ tag }}
          </span>
        </div>
        <h3 class="mt-2 text-xl font-semibold">{{ source.title }}</h3>
        <p v-if="source.description" class="mt-1 text-sm leading-6 text-base-content/70">{{ source.description }}</p>
        <a class="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-primary" :href="source.url" target="_blank" rel="noreferrer">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
          <span class="truncate">{{ source.url }}</span>
        </a>
      </div>
      <div class="flex shrink-0 gap-1 rounded-md border border-base-300 bg-base-100 p-1">
        <button class="btn btn-sm btn-square rounded-md" type="button" aria-label="Keep" title="Keep" @click="$emit('keep')">
          <i class="fa-solid fa-bookmark"></i>
        </button>
        <button class="btn btn-sm btn-square rounded-md" type="button" aria-label="Refine" title="Refine" @click="$emit('refine')">
          <i class="fa-solid fa-pen-nib"></i>
        </button>
        <button class="btn btn-sm btn-square rounded-md" type="button" aria-label="Archive" title="Archive" @click="$emit('archive')">
          <i class="fa-solid fa-box-archive"></i>
        </button>
      </div>
    </div>
  </article>
</template>
