// HTTP entrypoint: WAHA webhook receiver + health check, plus the outbox
// poller and stale-hold sweeper. Runs on the VPS; WAHA's session webhook
// points at http://<bridge>:8080/webhook/waha (local/private network only).

import http from "node:http";
import { loadConfig } from "./config.js";
import { Bridge } from "./runner.js";

const MAX_BODY_BYTES = 512 * 1024;

function main() {
  const cfg = loadConfig(process.env);
  const bridge = new Bridge(cfg);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (url.pathname === "/webhook/waha" && req.method === "POST") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "payload too large" }));
            return;
          }
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const headers = {};
        for (const [k, v] of Object.entries(req.headers)) headers[String(k).toLowerCase()] = v;
        try {
          await bridge.handleWebhook(rawBody, headers);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          const status = e?.status ?? 500;
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: e?.message ?? "error" }));
        }
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not found" }));
    } catch (e) {
      console.error("[server] request error", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "internal" }));
      }
    }
  });

  server.listen(cfg.port, () => {
    console.error(`[server] WA booking bridge listening on :${cfg.port}`);
    bridge.startPollers();
  });

  const shutdown = () => {
    console.error("[server] shutting down");
    bridge.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("unhandledRejection", (reason) => console.error("[server] unhandledRejection", reason));
}

main();