"use client";

import { useState } from "react";
import { useTasks, type TaskFilter } from "@/lib/tasks-store";

const FILTERS: TaskFilter[] = ["all", "open", "done"];

export function TaskBoard() {
  const { visibleTasks, filter, setFilter, addTask, setStatus, removeTask } = useTasks();
  const [draft, setDraft] = useState("");

  return (
    <section className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          addTask(draft);
          setDraft("");
        }}
      >
        <input
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          placeholder="Add a task…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="New task"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Add
        </button>
      </form>

      <div className="flex gap-1" role="group" aria-label="Filter tasks">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${
              filter === value
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {visibleTasks.length === 0 && (
          <li className="py-6 text-center text-sm text-foreground/50">Nothing here yet.</li>
        )}
        {visibleTasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 py-2.5">
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={task.status === "done"}
              onChange={(event) =>
                setStatus(task.id, event.target.checked ? "done" : "open")
              }
              aria-label={`Mark "${task.title}" as done`}
            />
            <span
              className={`flex-1 text-sm ${
                task.status === "done" ? "text-foreground/40 line-through" : ""
              }`}
            >
              {task.title}
            </span>
            <button
              type="button"
              onClick={() => removeTask(task.id)}
              className="rounded px-2 py-1 text-xs text-foreground/50 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              aria-label={`Delete "${task.title}"`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
