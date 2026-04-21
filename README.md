# Claude Autonomous Task System

Runs Claude Code on your PC during unused Anthropic usage windows, triggered and reported via Telegram.
Everything runs locally — no cloud hosting needed, no API key needed.

---

## Architecture

```
Windows Task Scheduler (hourly)
        │
        ▼
  bot/ (local process)
  POST http://localhost:8080/session-start
        │
        ▼
  Telegram message → you
        │
        ├── you reply "yes"  → bot cancels timer, does nothing
        │
        └── 30 min timeout / no reply
                │
                ▼
          POST http://localhost:3333/run
                │
                ▼
          pc-server/ (local process)
          orchestrator reads tasks.md
          cd to project path
          claude -p "task" --dangerously-skip-permissions
                │
                ▼
          mark task [x] done
          git commit
          loop → next task
                │
                ▼
          Telegram summary sent
```

All processes run as Windows scheduled tasks and start automatically on login.

---

## Prerequisites

### 1. Node.js
Download and install from [nodejs.org](https://nodejs.org) (LTS version).
Verify: `node -v` should print v22 or higher.

### 2. Claude Code
```powershell
npm install -g @anthropic-ai/claude-code
```

### 3. Log in to Claude Code
Claude Code uses your claude.ai Pro subscription — no API key needed.

```powershell
claude login
```

Follow the browser prompt to authenticate with your Anthropic account.
Verify it works:

```powershell
claude -p "say hello" --allowedTools "Bash"
```

If it responds without asking for an API key, you're good.

### 4. Telegram Bot + Chat ID
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot` → follow prompts → copy the **bot token** (`123456789:ABC-...`)
3. Start a conversation with your new bot (send it any message)
4. Open in browser (replace token): `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Find `"chat":{"id":XXXXXXXXX}` — that number is your **chat ID**

---

## Setup

### 1. Create bot/.env

Create the file `bot/.env` with your values:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC-your-token-here
TELEGRAM_CHAT_ID=1534788927
PC_WEBHOOK_URL=http://localhost:3333
TIMEOUT_MINUTES=30
CRON_PORT=8080
```

`PC_WEBHOOK_URL` points to localhost because bot and pc-server run on the same machine.

### 2. Build both packages

```powershell
cd pc-server
npm install
npm run build

cd ../bot
npm install
npm run build
```

### 3. Register startup tasks (run once as Administrator)

```powershell
cd C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation\scripts
.\register-startup.bat   # right-click → Run as Administrator
```

This registers three Windows Task Scheduler jobs under `ClaudeAutonomous\`:

| Task | What it runs | When |
|---|---|---|
| `PCServer` | `node pc-server/dist/index.js` | On login, after 30s |
| `Bot` | `node bot/dist/index.js` | On login, after 60s |
| `SessionTrigger` | `curl -X POST http://localhost:8080/session-start` | Hourly |

### 4. Start tasks immediately (without rebooting)

```powershell
schtasks /Run /TN "ClaudeAutonomous\PCServer"
schtasks /Run /TN "ClaudeAutonomous\Bot"
```

### 5. Test end-to-end

```powershell
# Confirm pc-server is up
curl http://localhost:3333/status

# Trigger a session manually — should send you a Telegram message
curl -X POST http://localhost:8080/session-start
```

Reply `yes` to the Telegram message to cancel, or wait 30 minutes (lower `TIMEOUT_MINUTES` for testing).

---

## Adding tasks

Edit `tasks.md`. Format:

```markdown
## project: my-project
path: C:\Users\ofek\projects\my-project
context: Brief one-line description of the tech stack

- [ ] do something specific | priority: high
- [ ] another task | priority: medium
- [ ] low effort cleanup | priority: low
```

Tasks are sorted by priority across all projects — `high` always runs first regardless of project.
The orchestrator marks tasks `[x]` when done and commits `tasks.md` automatically.

---

## Telegram commands

| Message | Action |
|---|---|
| `yes` | Claim the session — cancels the timer, agent stays idle |
| `/run` | Start the agent manually right now |
| `/stop` | Gracefully stop a running session after current task |
| `/status` | Check if agent is running |
| `/help` | Show command list |

---

## Troubleshooting

**Bot doesn't send a Telegram message**
- Check bot is running: `schtasks /Query /TN "ClaudeAutonomous\Bot"`
- Verify `bot/.env` has the correct token and chat ID
- Test manually: `curl -X POST http://localhost:8080/session-start`

**pc-server not reachable**
- Check it's running: `curl http://localhost:3333/status`
- Start manually: `node pc-server/dist/index.js`

**Claude Code fails inside a task**
- Confirm you're logged in: `claude login`
- Test headless mode: `claude -p "list files" --allowedTools "Bash"`
- Check the project path in `tasks.md` exists and is a valid git repo

**Scheduled tasks not starting on login**
- Open Task Scheduler → `ClaudeAutonomous\` folder → check Last Run Result
- Re-run `register-startup.bat` as Administrator if tasks are missing