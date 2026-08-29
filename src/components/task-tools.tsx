"use client";

import { useWebMcpTool } from "@/lib/webmcp/use-webmcp-tool";
import { useTasks, type TaskFilter } from "@/lib/tasks-store";

/**
 * The agent-facing surface of the app. Every tool here operates on the same
 * state the human UI renders, so an agent action is immediately visible on
 * screen and vice versa.
 *
 * Tool-writing rules of thumb (see
 * https://developer.chrome.com/docs/ai/webmcp/secure-tools):
 *  - validate input in `execute`; the model can send anything
 *  - never expose a tool that does something the signed-in human could not do
 *  - return a short, factual string the agent can relay
 */
export function TaskTools() {
  const { tasks, filter, addTask, setStatus, removeTask, setFilter, findByTitle } =
    useTasks();

  useWebMcpTool<{ status?: TaskFilter }>({
    name: "list_tasks",
    description:
      "List the tasks on the board. Optionally filter by status. Call this before updating or deleting a task so you have the exact task titles.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "open", "done"],
          description: "Which tasks to return. Defaults to the board's current filter.",
        },
      },
    },
    execute: ({ status }) => {
      const scope = status ?? filter;
      const matching =
        scope === "all" ? tasks : tasks.filter((task) => task.status === scope);
      if (matching.length === 0) return `No ${scope === "all" ? "" : scope + " "}tasks.`;
      return matching
        .map((task) => `- [${task.status === "done" ? "x" : " "}] ${task.title}`)
        .join("\n");
    },
  });

  useWebMcpTool<{ title?: string }>({
    name: "add_task",
    description: "Add a new open task to the board.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short description of the task." },
      },
      required: ["title"],
    },
    execute: ({ title }) => {
      if (typeof title !== "string" || title.trim().length === 0) {
        return "Cannot add a task without a title.";
      }
      if (title.length > 200) return "Task title is too long (max 200 characters).";
      const task = addTask(title);
      return `Added "${task.title}".`;
    },
  });

  useWebMcpTool<{ task?: string; status?: "open" | "done" }>({
    name: "set_task_status",
    description:
      "Mark a task as done or reopen it. Identify the task by its exact title from list_tasks.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task title (or id) to update." },
        status: { type: "string", enum: ["open", "done"] },
      },
      required: ["task", "status"],
    },
    execute: ({ task, status }) => {
      if (!task || (status !== "open" && status !== "done")) {
        return "Provide a task and a status of 'open' or 'done'.";
      }
      const match = findByTitle(task);
      if (!match) return `No task matching "${task}". Call list_tasks first.`;
      setStatus(match.id, status);
      return `"${match.title}" is now ${status}.`;
    },
  });

  useWebMcpTool<{ task?: string }>({
    name: "delete_task",
    description:
      "Permanently delete a task from the board. Confirm with the user before calling this.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task title (or id) to delete." },
      },
      required: ["task"],
    },
    execute: ({ task }) => {
      if (!task) return "Provide the task to delete.";
      const match = findByTitle(task);
      if (!match) return `No task matching "${task}".`;
      removeTask(match.id);
      return `Deleted "${match.title}".`;
    },
  });

  useWebMcpTool<{ status?: TaskFilter }>({
    name: "set_board_filter",
    description:
      "Change what the person sees on screen — show all tasks, only open ones, or only completed ones.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["all", "open", "done"] } },
      required: ["status"],
    },
    execute: ({ status }) => {
      if (status !== "all" && status !== "open" && status !== "done") {
        return "Filter must be 'all', 'open', or 'done'.";
      }
      setFilter(status);
      const count =
        status === "all"
          ? tasks.length
          : tasks.filter((task) => task.status === status).length;
      return `Board now showing ${status} tasks (${count} visible).`;
    },
  });

  return null;
}
