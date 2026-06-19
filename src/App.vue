<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { matchesLinkSearch } from "./modules/linklist/search";
import type { LinkEntry, NewLinkEntry } from "./modules/linklist/types";

const links = ref<LinkEntry[]>([]);
const search = ref("");
const error = ref("");
const saving = ref(false);
const form = reactive({
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

function addSearchTag(tag: string) {
  const terms = new Set(search.value.split(/\s+/).filter(Boolean));
  terms.add(tag);
  search.value = [...terms].join(" ");
}

onMounted(loadLinks);
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <strong>ChaosToolbox</strong>
      <button class="module active" type="button">Linklist</button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <p>Module</p>
          <h1>Linklist</h1>
        </div>
        <input v-model="search" type="search" placeholder="Search links" aria-label="Search links">
      </header>

      <form class="link-form" @submit.prevent="addLink">
        <input v-model="form.title" required placeholder="Title" aria-label="Title">
        <input v-model="form.url" required type="url" placeholder="https://example.com" aria-label="URL">
        <input v-model="form.description" placeholder="Description" aria-label="Description">
        <input v-model="form.tags" placeholder="Tags, comma separated" aria-label="Tags">
        <button type="submit" :disabled="saving">{{ saving ? "Saving" : "+" }}</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>

      <section class="links" aria-label="Saved links">
        <article v-for="link in filteredLinks" :key="link.id" class="link-row">
          <div>
            <a :href="link.url" target="_blank" rel="noreferrer">{{ link.title }}</a>
            <p>{{ link.description }}</p>
          </div>
          <div class="tags">
            <button v-for="tag in link.tags" :key="tag" type="button" @click="addSearchTag(tag)">
              {{ tag }}
            </button>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>
