import http from "http";
import { runAll } from "./orchestrator";

const PORT = parseInt(process.env.PORT ?? "3333", 10);

// Shared stop signal — set to true when /stop is called
const stopSignal = { stop: false };
let agentRunning = false;

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // ── POST /run ──────────────────────────────────────────────────────────────
  if (method === "POST" && url === "/run") {
    if (agentRunning) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Agent already running" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });

    agentRunning = true;
    stopSignal.stop = false;

    try {
      const result = await runAll(stopSignal);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      agentRunning = false;
    }
    return;
  }

  // ── POST /stop ─────────────────────────────────────────────────────────────
  if (method === "POST" && url === "/stop") {
    stopSignal.stop = true;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, agentRunning }));
    return;
  }

  // ── GET /status ────────────────────────────────────────────────────────────
  if (method === "GET" && url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ agentRunning, stopRequested: stopSignal.stop }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[pc-server] listening on http://localhost:${PORT}`);
  console.log(`[pc-server] Endpoints:`);
  console.log(`  POST /run    — start autonomous agent`);
  console.log(`  POST /stop   — request graceful stop`);
  console.log(`  GET  /status — check if agent is running`);
});
