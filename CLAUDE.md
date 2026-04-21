# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo does

Runs Claude Code autonomously on this PC during unused Anthropic usage windows. A Telegram bot notifies the user at the top of each hour; if no reply within 30 minutes, it POSTs to the local pc-server which runs pending tasks from `tasks.md` using `claude -p`.

Three local processes (all Windows Task Scheduler jobs):
- **pc-server** (port 3333) — HTTP server that runs the orchestrator on `POST /run`
- **bot** (port 8080) — Telegram bot + cron endpoint (`POST /session-start`)
- **SessionTrigger** — hourly schtask that POSTs to `localhost:8080/session-start`

## Build commands

```powershell
# pc-server
cd pc-server && npm install && npm run build

# bot
cd bot && npm install && npm run build
```

Both use `tsc` with no test suite. There is no lint step.

## Running locally for debug

```powershell
# Start pc-server (logs to console)
node pc-server/dist/index.js

# Trigger a run
Invoke-RestMethod -Uri http://localhost:3333/run -Method POST | ConvertTo-Json -Depth 5

# Check status
Invoke-RestMethod -Uri http://localhost:3333/status

# Trigger a bot session (sends Telegram message)
Invoke-RestMethod -Uri http://localhost:8080/session-start -Method POST
```

Use `curl.exe` (not `curl`) in PowerShell — the bare alias maps to `Invoke-WebRequest` and rejects `-X`.

## Architecture

### pc-server (`pc-server/src/`)
- `index.ts` — HTTP server with three routes: `POST /run`, `POST /stop`, `GET /status`
- `orchestrator.ts` — parses `tasks.md`, spawns `claude -p <prompt>` per task, marks tasks `[x]` on success

`TASKS_FILE` resolves to repo root `tasks.md` via `path.resolve(__dirname, "../../tasks.md")` (relative to `pc-server/dist/`).

### bot (`bot/src/index.ts`)
Single file. Loads `bot/.env` via dotenv (path anchored to `__dirname/../.env`). Runs two things in one process:
- Telegram polling via `node-telegram-bot-api`
- HTTP server on `CRON_PORT` (default 8080) for the `/session-start` webhook

`PC_WEBHOOK_URL` defaults to `http://localhost:3333`.

### tasks.md format
```
## project: <name>
path: C:\absolute\path\to\repo
context: one-line description

- [ ] task description | priority: high|medium|low
- [x] completed task   | priority: high
```

Parser regex for pending tasks: `^- \[ \] (.+?) \| priority: (high|medium|low)` — the space inside `[ ]` is required. Tasks missing `| priority:` are silently skipped.

## Key known issues / gotchas

**Prompt must be single-line.** On Windows, `spawnSync` with `shell: true` uses `cmd.exe`, which mangles multiline strings passed as CLI arguments. The prompt in `orchestrator.ts` is deliberately kept as a single concatenated string.

**Project path must exist.** If `path:` in `tasks.md` points to a non-existent directory, `spawnSync` throws a misleading `ENOENT` pointing at `cmd.exe`. The orchestrator now checks `fs.existsSync` first and logs a clear error.

**`context:` can be empty** but the line must still be present for the project block to parse correctly.

## Scheduled tasks (register once as Administrator)

```powershell
cd scripts
# right-click → Run as Administrator
.\register-startup.bat

# Start immediately without reboot
schtasks /Run /TN "ClaudeAutonomous\PCServer"
schtasks /Run /TN "ClaudeAutonomous\Bot"
```

## Required environment / files

- `bot/.env` — must contain `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- `claude login` — must be authenticated (uses claude.ai Pro, no API key)
- `node` in PATH, `claude` in PATH (installed via `npm i -g @anthropic-ai/claude-code`)
