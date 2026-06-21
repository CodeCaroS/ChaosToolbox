export type TaskStep = {
  text: string;
  done: boolean;
};

export type TaskEntry = {
  id: number;
  title: string;
  notes: string;
  priority: number;
  done: boolean;
  dueDate: string | null;
  repeat: "" | "weekly" | "biweekly" | "monthly" | "quarterly";
  categoryId: number | null;
  categoryName: string | null;
  tags: string[];
  steps: TaskStep[];
};

export type NewTaskEntry = Omit<TaskEntry, "id" | "done" | "categoryName">;
