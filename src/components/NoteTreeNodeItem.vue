<script setup lang="ts">
import type { NoteEntry } from "../modules/notes/types";
import type { NoteTreeNode } from "../modules/notes/noteTree";

defineProps<{
  node: NoteTreeNode;
  selectedNoteId: number | null;
  isOpen: (path: string) => boolean;
  openNote: (note: NoteEntry) => void;
  toggleGroup: (path: string, event: Event) => void;
  hasSourceHint: (note: NoteEntry) => boolean;
  showFullPath: boolean;
}>();
</script>

<template>
  <li v-if="node.type === 'note' && node.note" class="note-tree-node">
    <button
      type="button"
      :class="['note-tree-item', { active: selectedNoteId === node.note.id }]"
      :title="node.note.sourcePath || node.note.title"
      @click="openNote(node.note)"
    >
      <i class="fa-solid fa-file-lines"></i>
      <span class="truncate">{{ showFullPath ? node.path : node.name }}</span>
      <span v-if="hasSourceHint(node.note)" class="badge badge-outline badge-xs rounded-md">link</span>
    </button>
  </li>

  <li v-else class="note-tree-node">
    <details class="note-tree-folder" :open="isOpen(node.path)" @toggle="toggleGroup(node.path, $event)">
      <summary class="note-tree-summary">
        <i :class="['fa-solid', isOpen(node.path) ? 'fa-folder-open' : 'fa-folder']"></i>
        <span class="truncate">{{ node.name }}</span>
      </summary>
      <ul class="note-tree-children">
        <NoteTreeNodeItem
          v-for="child in node.children ?? []"
          :key="child.id"
          :node="child"
          :selected-note-id="selectedNoteId"
          :is-open="isOpen"
          :open-note="openNote"
          :toggle-group="toggleGroup"
          :has-source-hint="hasSourceHint"
          :show-full-path="showFullPath"
        />
      </ul>
    </details>
  </li>
</template>
