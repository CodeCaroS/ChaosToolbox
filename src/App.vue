<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { matchesLinkSearch } from "./modules/linklist/search";
import type { LinkEntry, NewLinkEntry } from "./modules/linklist/types";

const links = ref<LinkEntry[]>([]);
const search = ref("");
const error = ref("");
const editingId = ref<number | null>(null);
const previewing = ref(false);
const saving = ref(false);
const theme = ref<"claude" | "claude-dark">("claude");
const form = reactive({
  title: "",
  url: "",
  description: "",
  tags: ""
});
const editForm = reactive({
  title: "",
  url: "",
  description: "",
  tags: ""
});

const filteredLinks = computed(() => links.value.filter((link) => matchesLinkSearch(link, search.value)));

async function loadLinks() {
  const response = await fetch("/api/links");
  links.value = await response.json();
}

async function addLink() {
  error.value = "";
  saving.value = true;

  const payload: NewLinkEntry = {
    title: form.title,
    url: form.url,
    description: form.description,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
  };

  const response = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  saving.value = false;
  if (!response.ok) {
    error.value = "Title and valid URL are required.";
    return;
  }

  links.value.push(await response.json());
  form.title = "";
  form.url = "";
  form.description = "";
  form.tags = "";
}

function startEdit(link: LinkEntry) {
  editingId.value = link.id;
  editForm.title = link.title;
  editForm.url = link.url;
  editForm.description = link.description;
  editForm.tags = link.tags.join(", ");
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  error.value = "";
  const payload: NewLinkEntry = {
    title: editForm.title,
    url: editForm.url,
    description: editForm.description,
    tags: editForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
  };

  const response = await fetch(`/api/links/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    error.value = "Could not update this link.";
    return;
  }

  const updated = await response.json() as LinkEntry;
  links.value = links.value.map((link) => link.id === id ? updated : link);
  editingId.value = null;
}

async function deleteLink(link: LinkEntry) {
  if (!confirm(`Delete "${link.title}"?`)) return;

  const response = await fetch(`/api/links/${link.id}`, { method: "DELETE" });
  if (!response.ok) {
    error.value = "Could not delete this link.";
    return;
  }

  links.value = links.value.filter((current) => current.id !== link.id);
}

async function previewUrl() {
  if (!form.url) return;

  previewing.value = true;
  const response = await fetch("/api/links/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: form.url })
  });
  previewing.value = false;

  if (!response.ok) {
    error.value = "No preview found for this URL.";
    return;
  }

  const preview = await response.json() as NewLinkEntry;
  if (!form.title) form.title = preview.title;
  if (!form.description) form.description = preview.description;
  if (!form.tags) form.tags = preview.tags.join(", ");
}

function addSearchTag(tag: string) {
  const terms = new Set(search.value.split(/\s+/).filter(Boolean));
  terms.add(tag);
  search.value = [...terms].join(" ");
}

function toggleTheme() {
  theme.value = theme.value === "claude" ? "claude-dark" : "claude";
  localStorage.setItem("theme", theme.value);
}

onMounted(() => {
  theme.value = localStorage.getItem("theme") === "claude-dark" ? "claude-dark" : "claude";
  loadLinks();
});
</script>

<template>
  <div :data-theme="theme" class="grid min-h-screen bg-base-100 text-base-content md:grid-cols-[240px_1fr]">
    <aside class="flex flex-col gap-6 border-r border-base-300 bg-base-100 p-6">
      <strong class="font-serif text-2xl font-normal text-base-content">✦ ChaosToolbox</strong>
      <button class="btn btn-primary justify-start rounded-md border-0 text-primary-content" type="button">Linklist</button>
    </aside>

    <main class="p-4 md:p-8">
      <header class="mb-8 grid gap-6 border-b border-base-300 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-base-content/60">Module</p>
          <h1 class="font-serif text-5xl font-normal leading-tight text-base-content">Linklist</h1>
          <p class="mt-2 max-w-2xl text-base leading-relaxed text-base-content/70">Eine warme, ruhige Sammlung fuer Links, Notizen und kleine Code-Fundstuecke.</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input v-model="search" class="input input-bordered w-full rounded-md bg-base-100 focus:border-primary focus:outline-primary/20 sm:w-80" type="search" placeholder="Search links" aria-label="Search links">
          <button class="btn btn-outline rounded-md border-base-300" type="button" @click="toggleTheme">{{ theme === "claude" ? "Dark" : "Light" }}</button>
        </div>
      </header>

      <form class="mb-3 grid gap-2 rounded-md bg-secondary p-3 lg:grid-cols-[1fr_1fr_1.5fr_1fr_auto]" @submit.prevent="addLink">
        <input v-model="form.title" class="input input-bordered rounded-md bg-base-100 focus:border-primary" required placeholder="Title" aria-label="Title">
        <input v-model="form.url" class="input input-bordered rounded-md bg-base-100 focus:border-primary" required type="url" placeholder="https://example.com" aria-label="URL" @blur="previewUrl">
        <input v-model="form.description" class="input input-bordered rounded-md bg-base-100 focus:border-primary" placeholder="Description" aria-label="Description">
        <input v-model="form.tags" class="input input-bordered rounded-md bg-base-100 focus:border-primary" placeholder="Tags, comma separated" aria-label="Tags">
        <button class="btn btn-primary rounded-md border-0 text-xl text-primary-content" type="submit" :disabled="saving || previewing">{{ saving ? "Saving" : previewing ? "..." : "+" }}</button>
      </form>
      <p v-if="error" class="mb-3 text-error">{{ error }}</p>

      <section class="grid gap-2" aria-label="Saved links">
        <article v-for="link in filteredLinks" :key="link.id" class="card rounded-md border border-base-300 bg-secondary shadow-none">
          <div class="card-body grid gap-5 p-4 md:grid-cols-[minmax(240px,1fr)_minmax(180px,340px)]">
            <form v-if="editingId === link.id" class="grid gap-2 md:col-span-2 md:grid-cols-2" @submit.prevent="saveEdit(link.id)">
              <input v-model="editForm.title" class="input input-bordered rounded-md bg-base-100 focus:border-primary" required aria-label="Edit title">
              <input v-model="editForm.url" class="input input-bordered rounded-md bg-base-100 focus:border-primary" required type="url" aria-label="Edit URL">
              <input v-model="editForm.description" class="input input-bordered rounded-md bg-base-100 focus:border-primary" aria-label="Edit description">
              <input v-model="editForm.tags" class="input input-bordered rounded-md bg-base-100 focus:border-primary" aria-label="Edit tags">
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-primary btn-sm rounded-md border-0 text-primary-content" type="submit">Save</button>
                <button class="btn btn-outline btn-sm rounded-md border-base-300" type="button" @click="cancelEdit">Cancel</button>
              </div>
            </form>

            <div v-else>
              <a class="font-serif text-2xl font-normal leading-tight text-base-content no-underline hover:text-primary" :href="link.url" target="_blank" rel="noreferrer">{{ link.title }}</a>
              <p class="mt-1 text-base-content/70">{{ link.description }}</p>
            </div>
            <div v-if="editingId !== link.id" class="grid content-start gap-3">
              <div class="flex flex-wrap content-start gap-1.5">
                <button v-for="tag in link.tags" :key="tag" class="badge cursor-pointer rounded-full border-0 bg-base-100 text-base-content" type="button" @click="addSearchTag(tag)">
                  {{ tag }}
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-outline btn-sm rounded-md border-base-300" type="button" @click="startEdit(link)">Edit</button>
                <button class="btn btn-error btn-sm rounded-md" type="button" @click="deleteLink(link)">Delete</button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>
