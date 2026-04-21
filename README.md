# Claude Autonomous Task System

Runs Claude Code on your PC during unused Anthropic usage windows, triggered by a Telegram bot.

---

## Architecture

```
Anthropic usage window starts
        │
        ▼
  Railway (bot/) ──── Telegram message → you
        │                    │
        │              you reply "yes"
        │              → bot cancels timer, does nothing
        │
        │  (30 min timeout / you reply "no")
        │
        ▼
  POST to your PC (pc-server/)
  via Cloudflare Tunnel
        │
        ▼
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

---

## Prerequisites — do these BEFORE opening Claude Code

### 1. Telegram Bot + your Chat ID

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot` → follow prompts → copy the **bot token**
3. Start a conversation with your new bot
4. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
5. Send any message to the bot, refresh the URL
6. Find `"chat":{"id": 123456789}` — that number is your **chat ID**

### 2. Cloudflare Tunnel (exposes your PC to Railway)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Zero Trust** → **Networks** → **Tunnels**
2. Create a tunnel → name it `claude-autonomous`
3. Download `cloudflared.exe` from the page (or from [releases](https://github.com/cloudflare/cloudflared/releases))
   - Put it at `C:\tools\cloudflared.exe`
4. Copy the **tunnel token** shown on the page (long string starting with `eyJ...`)
5. Under **Public Hostname**, add:
   - Subdomain: `claude-pc`  
   - Domain: your Cloudflare domain (e.g. `example.com`)
   - Service: `http://localhost:3333`
6. Your PC will be reachable at `https://claude-pc.example.com`

> No Cloudflare domain? Use the free tunnel URL shown in `cloudflared` logs instead.

### 3. Railway setup (hosts the bot)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Point it at this repo, set **Root Directory** to `bot`
3. Add environment variables:
   ```
   TELEGRAM_BOT_TOKEN   = <from step 1>
   TELEGRAM_CHAT_ID     = <from step 1>
   PC_WEBHOOK_URL       = https://claude-pc.example.com   ← your tunnel URL
   TIMEOUT_MINUTES      = 30
   ```
4. Railway auto-detects `package.json`, builds with `npm run build`, starts with `npm start`
5. Add a **Cron** service in the same Railway project:
   - Schedule: `0 * * * *`  (every hour, adjust to Anthropic's window schedule)
   - Command: `curl -X POST https://<your-railway-bot-url>/session-start`

### 4. Register startup tasks on your PC

Run **as Administrator**:

```bat
cd C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation\scripts
```

Edit `register-startup.bat` first:
- Set `TUNNEL_TOKEN` to the token from step 2

Then run it:
```bat
register-startup.bat
```

This registers two Windows Task Scheduler jobs that auto-start on login:
- `ClaudeAutonomous\CloudflaredTunnel` — the Cloudflare tunnel
- `ClaudeAutonomous\PCServer` — the local HTTP server

### 5. Set ANTHROPIC_API_KEY on your PC

The orchestrator invokes `claude -p` which needs your API key:

```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", "User")
```

(Restart any terminals after setting this.)

---

## Running manually (test before going autonomous)

```powershell
# Start the pc-server
cd C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation\pc-server
npm install && npm run build && npm start

# In another terminal — trigger a run
curl -X POST http://localhost:3333/run

# Check status
curl http://localhost:3333/status

# Stop mid-run
curl -X POST http://localhost:3333/stop
```

---

## Adding tasks

Edit `tasks.md`. Format:

```markdown
## project: my-project
path: C:\Users\ofek\projects\my-project
context: Brief description of the project tech stack

- [ ] do something specific | priority: high
- [ ] another task | priority: medium
```

Tasks are sorted by priority across all projects — `high` always runs first regardless of which project it's in.

---

## Can Claude Code open Chrome or Railway?

Short answer: **not automatically** — and that's intentional for safety.

Claude Code in headless mode (`-p`) can only use the tools you explicitly allow via `--allowedTools`.
The orchestrator allows: `Read, Write, Edit, Bash, Glob, Grep`.

This means it can:
- Read and edit files
- Run shell commands (git, npm, etc.)
- Search the codebase

It **cannot** autonomously open a browser or configure Railway.
For Railway config changes or browser-based tasks, add them as tasks in `tasks.md` only if they're scriptable via CLI (Railway CLI, curl, etc.). Otherwise do them yourself.

---

## Telegram commands

| Message | Action |
|---------|--------|
| `yes`   | Claim the session — cancels the 30-min timer |
| `/run`  | Start the agent manually right now |
| `/stop` | Send a graceful stop signal |
| `/status` | Check if the agent is currently running |
| `/help` | Show command list |
