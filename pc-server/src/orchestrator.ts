import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// tasks.md lives at the repo root, two levels above pc-server/dist/
const TASKS_FILE = path.resolve(__dirname, "../../tasks.md");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  description: string;
  priority: "high" | "medium" | "low";
  projectName: string;
  projectPath: string;
  projectContext: string;
  lineIndex: number;
}

interface RunResult {
  completed: number;
  skipped: number;
  tasks: string[];
  errors: string[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseTasks(): Task[] {
  const content = fs.readFileSync(TASKS_FILE, "utf-8");
  const lines = content.split("\n");
  const tasks: Task[] = [];

  const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 };

  let currentProject = "";
  let currentPath = "";
  let currentContext = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const projectMatch = line.match(/^## project:\s*(.+)/);
    if (projectMatch) {
      currentProject = projectMatch[1].trim();
      currentPath = "";
      currentContext = "";
      continue;
    }

    const pathMatch = line.match(/^path:\s*(.+)/);
    if (pathMatch) {
      currentPath = pathMatch[1].trim();
      continue;
    }

    const contextMatch = line.match(/^context:\s*(.+)/);
    if (contextMatch) {
      currentContext = contextMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(/^- \[ \] (.+?) \| priority: (high|medium|low)/);
    if (taskMatch && currentProject && currentPath) {
      tasks.push({
        description: taskMatch[1].trim(),
        priority: taskMatch[2] as Task["priority"],
        projectName: currentProject,
        projectPath: currentPath,
        projectContext: currentContext,
        lineIndex: i,
      });
    }
  }

  tasks.sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);

  return tasks;
}

// ─── Mark done ────────────────────────────────────────────────────────────────

function markDone(task: Task) {
  const content = fs.readFileSync(TASKS_FILE, "utf-8");
  const updated = content.replace(
    `- [ ] ${task.description} | priority: ${task.priority}`,
    `- [x] ${task.description} | priority: ${task.priority}`
  );
  fs.writeFileSync(TASKS_FILE, updated, "utf-8");
}

// ─── Run a single task ────────────────────────────────────────────────────────

function runTask(task: Task, stopSignal: { stop: boolean }): "ok" | "stopped" | "error" {
  if (stopSignal.stop) return "stopped";

  const prompt =
    `Project: ${task.projectName}. ` +
    (task.projectContext ? `Context: ${task.projectContext}. ` : "") +
    `Task: ${task.description}. ` +
    `Instructions: work in the current directory, make only the changes needed for this task, ` +
    `commit your changes with a meaningful commit message when done, do not ask for confirmation.`;

  console.log(`\n[orchestrator] ▶ "${task.description}"`);
  console.log(`[orchestrator]   project: ${task.projectName}`);
  console.log(`[orchestrator]   path:    ${task.projectPath}`);

  if (!fs.existsSync(task.projectPath)) {
    console.error(`[orchestrator] ✗ path does not exist: ${task.projectPath}`);
    return "error";
  }

  const result = spawnSync(
    "claude",
    [
      "-p", prompt,
      "--dangerously-skip-permissions",
      "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep",
      "--max-turns", "20",
      "--output-format", "json",
    ],
    {
      cwd: task.projectPath,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
      shell: process.platform === "win32",
    }
  );

  if (result.error) {
    console.error(`[orchestrator] ✗ spawn error: ${result.error.message}`);
    return "error";
  }

  if (result.status !== 0) {
    console.error(`[orchestrator] ✗ claude exited ${result.status}`);
    console.error(result.stderr);
    return "error";
  }

  console.log(`[orchestrator] stdout: ${result.stdout.slice(0, 2000)}`);
  console.log(`[orchestrator] stderr: ${result.stderr.slice(0, 500)}`);
  try {
    const out = JSON.parse(result.stdout);
    console.log(
      `[orchestrator] ✓ done — ${out.num_turns ?? "?"} turns, $${out.cost_usd?.toFixed(4) ?? "?"}`
    );
  } catch {
    console.log(`[orchestrator] ✓ done`);
  }

  return "ok";
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runAll(stopSignal: { stop: boolean }): Promise<RunResult> {
  const tasks = parseTasks();
  const result: RunResult = { completed: 0, skipped: 0, tasks: [], errors: [] };

  if (tasks.length === 0) {
    console.log("[orchestrator] No pending tasks.");
    return result;
  }

  console.log(`[orchestrator] Found ${tasks.length} pending task(s).`);

  for (const task of tasks) {
    if (stopSignal.stop) {
      console.log("[orchestrator] Stop signal received — halting.");
      break;
    }

    const status = runTask(task, stopSignal);

    if (status === "stopped") break;

    if (status === "ok") {
      markDone(task);
      result.completed++;
      result.tasks.push(`[${task.projectName}] ${task.description}`);
    } else {
      result.skipped++;
      result.errors.push(`[${task.projectName}] ${task.description}`);
    }
  }

  return result;
}
