import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import TelegramBot from "node-telegram-bot-api";

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN       = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID     = process.env.TELEGRAM_CHAT_ID!;
const PC_URL      = process.env.PC_WEBHOOK_URL ?? "http://localhost:3333";
const TIMEOUT_MIN = parseInt(process.env.TIMEOUT_MINUTES ?? "30", 10);

if (!TOKEN || !CHAT_ID) {
  console.error("Missing required env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── State ────────────────────────────────────────────────────────────────────
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
let agentRunning = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function send(text: string) {
  bot.sendMessage(CHAT_ID, text, { parse_mode: "Markdown" });
}

async function pcFetch(endpoint: string, method = "POST"): Promise<any> {
  const res = await fetch(`${PC_URL}${endpoint}`, { method });
  return res.json();
}

function cancelPending() {
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
}

// ─── Session window trigger ───────────────────────────────────────────────────
// Call this when a new Anthropic usage window starts.
// In Railway: expose this as a cron job endpoint or call via webhook.
export function onUsageWindowStart() {
  cancelPending();

  send(
    `⏱ *New usage window started*\n\n` +
    `Do you need Claude for this session?\n\n` +
    `Reply *yes* to claim it.\n` +
    `I'll start working autonomously in *${TIMEOUT_MIN} minutes* if I don't hear from you.`
  );

  pendingTimeout = setTimeout(async () => {
    pendingTimeout = null;

    // Check if PC is reachable
    try {
      const status = await pcFetch("/status", "GET");
      if (status.agentRunning) {
        send("ℹ️ Agent is already running on your PC.");
        return;
      }
    } catch {
      send("❌ Cannot reach your PC. Is it on and is the tunnel running?\n`pc-server` must be running at the configured URL.");
      return;
    }

    send("⚙️ No response — starting autonomous session...");
    startAgent();
  }, TIMEOUT_MIN * 60 * 1000);
}

async function startAgent() {
  agentRunning = true;
  try {
    send("🤖 Agent started. I'll report back when done.\nSend /stop to interrupt.");
    const result = await pcFetch("/run");

    if (result.error) {
      send(`❌ Agent error: ${result.error}`);
      return;
    }

    const taskList = result.tasks?.length
      ? result.tasks.map((t: string) => `• ${t}`).join("\n")
      : "_(none)_";

    const errorList = result.errors?.length
      ? `\n\n⚠️ *Failed:*\n${result.errors.map((e: string) => `• ${e}`).join("\n")}`
      : "";

    send(
      `✅ *Session complete*\n\n` +
      `Completed *${result.completed}* task(s):\n${taskList}` +
      errorList
    );
  } catch (err: any) {
    send(`❌ Could not reach your PC: ${err.message}`);
  } finally {
    agentRunning = false;
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  // Only respond to your own chat
  if (String(msg.chat.id) !== CHAT_ID) return;

  const text = msg.text?.toLowerCase().trim() ?? "";

  // Claim the session
  if (text === "yes" || text === "y") {
    if (pendingTimeout) {
      cancelPending();
      send("Got it — session is yours. I'll stay idle.");
    } else {
      send("No pending session to claim right now.");
    }
    return;
  }

  // Stop the agent mid-run
  if (text === "/stop") {
    if (!agentRunning) {
      send("Agent is not running.");
      return;
    }
    try {
      await pcFetch("/stop");
      send("🛑 Stop signal sent. Agent will finish its current task and then halt.");
    } catch {
      send("❌ Could not reach PC to send stop signal.");
    }
    return;
  }

  // Status check
  if (text === "/status") {
    try {
      const s = await pcFetch("/status", "GET");
      send(
        `*PC server status*\n` +
        `Agent running: ${s.agentRunning ? "yes" : "no"}\n` +
        `Stop requested: ${s.stopRequested ? "yes" : "no"}`
      );
    } catch {
      send("❌ PC is not reachable.");
    }
    return;
  }

  // Manual trigger
  if (text === "/run") {
    if (agentRunning) {
      send("Agent is already running.");
      return;
    }
    cancelPending();
    send("Starting agent manually...");
    startAgent();
    return;
  }

  // Help
  if (text === "/help" || text === "/start") {
    send(
      `*Claude Autonomous Agent*\n\n` +
      `Commands:\n` +
      `*yes* — claim the session (stop the timer)\n` +
      `*/run* — start the agent manually\n` +
      `*/stop* — interrupt a running session\n` +
      `*/status* — check if the agent is running\n` +
      `*/help* — show this message`
    );
    return;
  }
});

// ─── Cron endpoint (Railway cron calls this via HTTP) ─────────────────────────
// Railway can call a webhook at the start of each usage window.
// Expose a tiny HTTP endpoint so Railway's built-in cron can trigger it.
import http from "http";

const CRON_PORT = parseInt(process.env.CRON_PORT ?? "8080", 10);

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/session-start") {
    onUsageWindowStart();
    res.writeHead(200);
    res.end("ok");
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(CRON_PORT, () => {
  console.log(`[bot] Cron endpoint on :${CRON_PORT}/session-start`);
  console.log(`[bot] Telegram bot polling...`);
});
