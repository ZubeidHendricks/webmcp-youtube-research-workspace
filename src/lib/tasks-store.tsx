"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TaskStatus = "open" | "done";
export type TaskFilter = TaskStatus | "all";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
}

const SEED: Task[] = [
  { id: "t1", title: "Read the WebMCP explainer", status: "done", createdAt: 1 },
  { id: "t2", title: "Register the first page tool", status: "open", createdAt: 2 },
  { id: "t3", title: "Record the demo video", status: "open", createdAt: 3 },
];

interface TasksValue {
  tasks: Task[];
  filter: TaskFilter;
  visibleTasks: Task[];
  addTask: (title: string) => Task;
  setStatus: (id: string, status: TaskStatus) => Task | undefined;
  removeTask: (id: string) => Task | undefined;
  setFilter: (filter: TaskFilter) => void;
  findByTitle: (query: string) => Task | undefined;
}

const TasksContext = createContext<TasksValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(SEED);
  const [filter, setFilter] = useState<TaskFilter>("all");

  const addTask = useCallback((title: string) => {
    const task: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      status: "open",
      createdAt: Date.now(),
    };
    setTasks((current) => [...current, task]);
    return task;
  }, []);

  const setStatus = useCallback((id: string, status: TaskStatus) => {
    let updated: Task | undefined;
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        updated = { ...task, status };
        return updated;
      }),
    );
    return updated;
  }, []);

  const removeTask = useCallback((id: string) => {
    let removed: Task | undefined;
    setTasks((current) => {
      removed = current.find((task) => task.id === id);
      return current.filter((task) => task.id !== id);
    });
    return removed;
  }, []);

  const value = useMemo<TasksValue>(() => {
    const visibleTasks =
      filter === "all" ? tasks : tasks.filter((task) => task.status === filter);

    return {
      tasks,
      filter,
      visibleTasks,
      addTask,
      setStatus,
      removeTask,
      setFilter,
      findByTitle: (query) => {
        const needle = query.trim().toLowerCase();
        return (
          tasks.find((task) => task.id === query) ??
          tasks.find((task) => task.title.toLowerCase() === needle) ??
          tasks.find((task) => task.title.toLowerCase().includes(needle))
        );
      },
    };
  }, [tasks, filter, addTask, setStatus, removeTask]);

  return <TasksContext value={value}>{children}</TasksContext>;
}

export function useTasks() {
  const value = useContext(TasksContext);
  if (!value) throw new Error("useTasks must be used inside <TasksProvider>");
  return value;
}
