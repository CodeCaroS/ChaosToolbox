<script setup lang="ts">
import type { TaskEntry } from "../modules/tasks/types";

defineProps<{
  taskForm: { title: string; notes: string; tags: string };
  filteredTasks: TaskEntry[];
}>();

const emit = defineEmits<{
  addTask: [];
  toggleTask: [task: TaskEntry];
}>();
</script>

<template>
  <section class="grid gap-4 xl:grid-cols-[360px_1fr]">
    <form class="grid content-start gap-3 rounded-md border border-base-300 bg-base-200 p-4" @submit.prevent="emit('addTask')">
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
          <button class="btn btn-square btn-sm rounded-md" :class="task.done ? 'btn-primary' : 'btn-outline'" type="button" :aria-label="task.done ? 'Reopen task' : 'Complete task'" @click="emit('toggleTask', task)">
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
</template>
