<script setup lang="ts">
type GitRemote = {
  name: string;
  url: string;
};

type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  changed: boolean;
  conflicts: boolean;
  conflictFiles: string[];
  files: string[];
  remotes: GitRemote[];
  authRequired: boolean;
  message: string;
};

defineProps<{
  gitStatus: GitStatus | null;
  gitForm: { message: string; remote: string; branch: string };
  gitBusy: boolean;
  gitResult: string;
  forcePushConfirmed: boolean;
}>();

const emit = defineEmits<{
  "update:forcePushConfirmed": [value: boolean];
  sync: [];
  commit: [];
  pull: [];
  push: [force: boolean];
}>();
</script>

<template>
  <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div class="grid content-start gap-4 rounded-md border border-base-300 bg-base-200 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p class="text-sm text-base-content/60">Second Brain Git</p>
          <h3 class="text-2xl font-semibold">Sync your notes repo</h3>
        </div>
        <button class="btn btn-primary rounded-md" type="button" :disabled="gitBusy" @click="emit('sync')">
          <i class="fa-solid" :class="gitBusy ? 'fa-spinner fa-spin' : 'fa-rotate'"></i>
          Sync
        </button>
      </div>

      <div v-if="gitStatus" class="grid gap-2 sm:grid-cols-4">
        <div class="rounded-md border border-base-300 bg-base-100 p-3">
          <div class="text-xs text-base-content/60">Branch</div>
          <div class="truncate font-semibold">{{ gitStatus.branch || "unknown" }}</div>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 p-3">
          <div class="text-xs text-base-content/60">Changes</div>
          <div class="font-semibold">{{ gitStatus.changed ? gitStatus.files.length : 0 }}</div>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 p-3">
          <div class="text-xs text-base-content/60">Ahead</div>
          <div class="font-semibold">{{ gitStatus.ahead }}</div>
        </div>
        <div class="rounded-md border border-base-300 bg-base-100 p-3">
          <div class="text-xs text-base-content/60">Behind</div>
          <div class="font-semibold">{{ gitStatus.behind }}</div>
        </div>
      </div>

      <div v-if="gitStatus?.authRequired" class="alert alert-warning rounded-md">
        <i class="fa-solid fa-key"></i>
        <span>Configure Git credentials before syncing.</span>
      </div>
      <div v-if="gitStatus?.conflicts" class="alert alert-error rounded-md">
        <i class="fa-solid fa-code-merge"></i>
        <span>Resolve merge conflicts before Git actions.</span>
      </div>

      <label class="form-control">
        <span class="label-text">Commit message</span>
        <input v-model="gitForm.message" class="input input-bordered rounded-md bg-base-100" placeholder="Commit message" aria-label="Commit message" />
      </label>

      <div class="grid gap-2 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Remote</span>
          <input v-model="gitForm.remote" class="input input-bordered rounded-md bg-base-100" placeholder="Remote" aria-label="Git remote" />
        </label>
        <label class="form-control">
          <span class="label-text">Branch</span>
          <input v-model="gitForm.branch" class="input input-bordered rounded-md bg-base-100" placeholder="Branch" aria-label="Git branch" />
        </label>
      </div>

      <div class="join">
        <button class="btn btn-square btn-outline join-item" type="button" :disabled="gitBusy" aria-label="Pull" title="Pull" @click="emit('pull')">
          <i class="fa-solid fa-arrow-down"></i>
        </button>
        <button class="btn btn-square btn-outline join-item" type="button" :disabled="gitBusy" aria-label="Commit" title="Commit" @click="emit('commit')">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="btn btn-square btn-primary join-item" type="button" :disabled="gitBusy" aria-label="Push" title="Push" @click="emit('push', false)">
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>

      <div class="rounded-md border border-base-300 bg-base-100 p-3">
        <label class="flex items-center gap-2">
          <input
            class="checkbox checkbox-sm"
            type="checkbox"
            :checked="forcePushConfirmed"
            @change="emit('update:forcePushConfirmed', ($event.target as HTMLInputElement).checked)"
          />
          <span class="text-sm">Allow force-with-lease</span>
        </label>
        <button class="btn btn-outline btn-sm mt-3 rounded-md" type="button" :disabled="gitBusy || !forcePushConfirmed" @click="emit('push', true)">
          Force push
        </button>
      </div>

      <p v-if="gitResult" class="whitespace-pre-line rounded-md bg-base-100 p-3 text-sm">{{ gitResult }}</p>
    </div>

    <aside class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4">
      <h3 class="text-lg font-semibold">Repo state</h3>
      <p v-if="gitStatus?.message" class="whitespace-pre-line rounded-md bg-base-100 p-3 text-sm">{{ gitStatus.message }}</p>
      <p v-else class="text-sm text-base-content/70">No Git errors reported.</p>
      <div v-if="gitStatus?.files.length" class="grid gap-2">
        <span class="text-sm font-semibold">Changed files</span>
        <span v-for="file in gitStatus.files.slice(0, 8)" :key="file" class="truncate rounded-md bg-base-100 px-2 py-1 text-xs">{{ file }}</span>
      </div>
    </aside>
  </section>
</template>
