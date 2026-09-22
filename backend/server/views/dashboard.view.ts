import os from "os";
import { configs } from "../configs";

export interface DashboardData {
  db: boolean;
  onlineUsers: number;
  apiRoutes: string[];
  apiVersion: string;
  port: number | string;
  host: string;
  nodeEnv: string;
  allowedOrigins: string;
  // real-time hardware
  cpuTemp: number | null; // °C
  cpuSpeed: number | null; // GHz current
  cpuSpeedMax: number | null;
  diskUsedGB: number | null;
  diskTotalGB: number | null;
  diskPct: number | null;
  netRxSec: number | null; // bytes/sec
  netTxSec: number | null;
  netIface: string | null;
  processCount: number | null;
  processRunning: number | null;
  cpuLoadCurrent: number | null;
  cpuCoresLoad: number[];
  tenantCounts: { total: number; active: number; suspended: number; failed: number };
  redisConnected: boolean;
  jobs: { running: boolean; startedAt: string | null; registeredSchedulers: number };
  requestsPerMinute: number;
  requestErrorRate: number;
  averageResponseMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function badge(
  ok: boolean,
  trueLabel: string,
  falseLabel: string,
  trueClass: string,
  falseClass: string,
) {
  return ok
    ? `<span class="status-badge ${trueClass}">${trueLabel}</span>`
    : `<span class="status-badge ${falseClass}">${falseLabel}</span>`;
}

function okBadge(v: boolean) {
  return badge(v, "● ACTIVE", "✘ MISSING", "ok", "warn");
}

function memBar(pct: number) {
  if (pct > 85) return "bar-err";
  if (pct > 65) return "bar-warn";
  return "bar-ok";
}

function fmtBytesPerSec(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "N/A";
  if (v < 1024) return `${v.toFixed(0)} B/s`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB/s`;
  return `${(v / 1024 / 1024).toFixed(2)} MB/s`;
}

// ── Template ─────────────────────────────────────────────────────────────────

export function renderDashboard(data: DashboardData): string {
  const {
    db,
    onlineUsers,
    apiRoutes,
    apiVersion,
    port,
    host,
    nodeEnv,
    allowedOrigins,
    cpuTemp,
    cpuSpeed,
    cpuSpeedMax,
    diskUsedGB,
    diskTotalGB,
    diskPct,
    netRxSec,
    netTxSec,
    netIface,
    processCount,
    processRunning,
    cpuLoadCurrent,
    cpuCoresLoad,
    tenantCounts,
    redisConnected,
    jobs,
    requestsPerMinute,
    requestErrorRate,
    averageResponseMs,
  } = data;

  // ── Runtime stats ──────────────────────────────────────────────────────────
  const upSec = Math.floor(process.uptime());
  const uptime = `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m ${upSec % 60}s`;

  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const memPct = ((usedMem / totalMem) * 100).toFixed(1);
  const sysTotalGB = (totalMem / 1024 / 1024 / 1024).toFixed(1);
  const sysUsedGB = (usedMem / 1024 / 1024 / 1024).toFixed(1);

  const cpuModel = os.cpus()[0]?.model.trim().replace(/\s+/g, " ") ?? "Unknown";
  const cpuCount = os.cpus().length;
  const loadAvg = os
    .loadavg()
    .map((v) => v.toFixed(2))
    .join("  ");
  const cpuLoadPct =
    cpuLoadCurrent !== null
      ? cpuLoadCurrent.toFixed(1)
      : Math.min((os.loadavg()[0] / cpuCount) * 100, 100).toFixed(0);

  // CPU temp colour
  const isLinux = process.platform === "linux";
  const tempStr = cpuTemp !== null ? `${cpuTemp.toFixed(1)} °C` : isLinux ? "N/A" : "OS restricted";
  const tempClass = cpuTemp === null ? "dim" : cpuTemp > 85 ? "err" : cpuTemp > 65 ? "warn" : "ok";
  const speedStr = cpuSpeed !== null ? `${cpuSpeed.toFixed(2)} GHz` : "N/A";
  const speedMaxStr = cpuSpeedMax !== null ? `/ ${cpuSpeedMax.toFixed(2)} GHz` : "";

  // Disk
  const diskPctNum = diskPct ?? 0;
  const diskStr =
    diskUsedGB !== null && diskTotalGB !== null
      ? `${diskUsedGB.toFixed(1)} / ${diskTotalGB.toFixed(1)} GB`
      : "N/A";
  const diskBarClass = memBar(diskPctNum);

  // Network
  const netIfaceStr = netIface ? `Interface: ${netIface}` : "Interface: N/A";

  const nodeVer = process.version;
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const year = new Date().getFullYear();

  // ── Badges ─────────────────────────────────────────────────────────────────
  const dbBadge = badge(db, "● CONNECTED", "● DISCONNECTED", "ok", "err");

  // ── Config checks ──────────────────────────────────────────────────────────
  const configChecks = [
    { label: "MONGODB_URI", ok: !!configs.MONGODB_URI, note: db ? "connected" : "disconnected" },
    { label: "JWT_SECRET", ok: !!configs.JWT_SECRET, note: "" },
    { label: "JWT_REFRESH_SECRET", ok: !!configs.JWT_REFRESH_SECRET, note: "" },
    { label: "ALLOWED_ORIGINS", ok: !!configs.ALLOWED_ORIGINS, note: allowedOrigins },
    {
      label: "ADMIN_IP_WHITELIST",
      ok: !!configs.ADMIN_IP_WHITELIST,
      note: configs.ADMIN_IP_WHITELIST ? "configured" : "required in production",
    },
    {
      label: "DASHBOARD_CREDENTIALS",
      ok: !!configs.DASHBOARD_USERNAME && configs.DASHBOARD_PASSWORD.length >= 16,
      note: "HTTP Basic authentication; 16+ character password",
    },
    {
      label: "TRUST_PROXY_HOPS",
      ok: configs.TRUST_PROXY_HOPS >= 0,
      note: String(configs.TRUST_PROXY_HOPS),
    },
    { label: "REDIS_URL", ok: redisConnected, note: redisConnected ? "connected" : "offline" },
  ];

  const configOkCount = configChecks.filter((c) => c.ok).length;

  // ── Security stack ─────────────────────────────────────────────────────────
  const securityLayers = [
    {
      label: "Helmet Defense",
      desc: "Enables HTTP Security headers including CSP, HSTS, and X-Frame-Options to block clickjacking.",
    },
    {
      label: "CORS Isolation",
      desc: `Restricts API access only to configured domain gates: ${allowedOrigins}`,
    },
    {
      label: "DDoS Rate Limiter",
      desc: "Restricts API access caps to 100 requests per 15 mins to mitigate system exhaustion.",
    },
    {
      label: "Dashboard Authentication",
      desc: "Requires constant-time verified operational credentials in addition to the IP allowlist.",
    },
    {
      label: "NoSQL Injection Guard",
      desc: "Strips $ and . characters from incoming JSON payloads to block database queries.",
    },
    {
      label: "HPP Param Protection",
      desc: "Deduplicates query array parameter structures to safeguard controller parsers.",
    },
    {
      label: "Gzip Compression",
      desc: "Shrinks outgoing bandwidth payloads by 60% using compression.",
    },
    {
      label: "Payload Size Cap",
      desc: "Enforces a strict 25 MB file upload cap to protect system buffers.",
    },
    {
      label: "IP Firewall Filter",
      desc: "Restricts access to critical dashboard telemetry to whitelisted administrative IPs.",
    },
  ];

  // ── HTML rows ──────────────────────────────────────────────────────────────
  const configRows = configChecks
    .map(
      ({ label, ok, note }) =>
        `<tr><td class="cfg-key">${label}</td><td>${okBadge(ok)}</td><td class="cfg-note">${note}</td></tr>`,
    )
    .join("\n");

  const routeRows = apiRoutes
    .map((r) => {
      const base = `/${apiVersion}/${r}`;
      return `<tr><td class="purple">${r}</td><td class="dim-sm"><a href="${base}" target="_blank">${base}</a></td><td class="ok">✔ Registered</td></tr>`;
    })
    .join("\n");

  // ── Socket events ──────────────────────────────────────────────────────────
  const socketEvents = [
    {
      name: "send_message",
      dir: "c→s",
      desc: "Send chat message (text / file / image / audio / video + replyTo)",
    },
    { name: "new_message", dir: "s→c", desc: "Broadcast new message to conversation room" },
    { name: "react_message", dir: "c→s", desc: "Add emoji reaction to a message" },
    { name: "message_reaction", dir: "s→c", desc: "Broadcast reaction update" },
    { name: "typing_start / typing_stop", dir: "c→s", desc: "Typing indicator events" },
    { name: "typing", dir: "s→c", desc: "Typing indicator broadcast" },
    { name: "mark_read", dir: "c→s", desc: "Mark conversation as read" },
    { name: "message_read", dir: "s→c", desc: "Read receipt broadcast" },
    { name: "user_online", dir: "s→all", desc: "User came online" },
    { name: "user_offline", dir: "s→all", desc: "User went offline + lastSeenAt timestamp" },
    { name: "notification_push", dir: "s→c", desc: "In-app notification push" },
    {
      name: "call_user / accept_call",
      dir: "c→s",
      desc: "WebRTC audio/video call signaling initiates / accepts",
    },
    {
      name: "incoming_call / call_accepted",
      dir: "s→c",
      desc: "WebRTC calling alerts forwarded to caller/acceptor",
    },
    {
      name: "reject_call / end_call",
      dir: "c→s",
      desc: "Reject or hang up WebRTC calling sessions",
    },
    {
      name: "call_rejected / call_ended",
      dir: "s→c",
      desc: "Calling termination signals broadcast to peer",
    },
  ];

  const socketRows = socketEvents
    .map(
      (e) =>
        `<tr><td class="purple">${e.name}</td><td class="${e.dir.startsWith("c") ? "info" : "warn-text"}">${e.dir}</td><td class="dim-sm">${e.desc}</td></tr>`,
    )
    .join("\n");

  // Generate per-core progress bars
  const coresHtml = (cpuCoresLoad.length > 0 ? cpuCoresLoad : Array(cpuCount).fill(0))
    .map((load, index) => {
      return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; font-family: var(--font-mono); font-size: 11px;">
        <span style="color: var(--dim-sm); font-weight: 500;">Core ${index}</span>
        <div style="flex: 1; background: rgba(0, 0, 0, 0.3); border-radius: 99px; height: 4px; overflow: hidden;">
          <div class="bar-fill bar-ok" style="width: ${load.toFixed(0)}%; height: 100%;"></div>
        </div>
        <span style="color: var(--cyan); font-weight: bold; width: 35px; text-align: right;">${load.toFixed(0)}%</span>
      </div>`;
    })
    .join("\n");

  // ── Full HTML ──────────────────────────────────────────────────────────────
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="data:," />
  <title>Devvelocity — DevOps Live Control Centre</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #05070c;
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(8, 12, 28, 0.95) 0%, rgba(5, 7, 12, 1) 90%);
      --bg-panel: rgba(13, 17, 30, 0.45);
      --bg-panel-hover: rgba(18, 24, 43, 0.6);
      --bg-card: rgba(17, 25, 46, 0.35);
      --bd: rgba(255, 255, 255, 0.05);
      --bd-glowing: rgba(59, 130, 246, 0.2);
      --text: #f8fafc;
      --dim: #94a3b8;
      --dim-sm: #64748b;
      
      /* Neon Accents */
      --ok: #10b981;
      --ok-glow: rgba(16, 185, 129, 0.15);
      --info: #3b82f6;
      --info-glow: rgba(59, 130, 246, 0.15);
      --purple: #8b5cf6;
      --purple-glow: rgba(139, 92, 246, 0.15);
      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.15);
      --warn: #f59e0b;
      --warn-glow: rgba(245, 158, 11, 0.15);
      --err: #ef4444;
      --err-glow: rgba(239, 68, 68, 0.15);

      --sidebar-w: 240px;
      --font-main: 'Plus Jakarta Sans', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      background-image: var(--bg-gradient);
      color: var(--text);
      font-family: var(--font-main);
      font-size: 13px;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      overflow-x: hidden;
    }
    
    a { color: var(--info); text-decoration: none; transition: all 0.2s ease; }
    a:hover { color: var(--cyan); text-decoration: none; }

    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 99px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }

    /* ── Sidebar ─────────────────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      background: rgba(8, 10, 18, 0.7);
      backdrop-filter: blur(25px);
      border-right: 1px solid var(--bd);
      padding: 24px 16px;
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 10;
    }
    .sb-logo {
      font-size: 20px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.5px;
      padding: 4px 12px 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sb-logo span {
      background: linear-gradient(135deg, var(--info), var(--cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sb-logo-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: var(--info);
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sb-section-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.8px;
      color: var(--dim-sm);
      padding: 16px 12px 6px;
    }
    .sb-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      color: var(--dim);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      background: none;
      width: 100%;
      text-align: left;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sb-item svg {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      transition: transform 0.2s ease;
    }
    .sb-item:hover {
      background: var(--bg-panel);
      color: var(--text);
      border-color: var(--bd);
    }
    .sb-item:hover svg {
      transform: translateX(2px);
    }
    .sb-item.active {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.25);
      color: var(--text);
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.05);
    }
    .sb-item .count {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--cyan);
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.2);
      border-radius: 99px;
      padding: 1px 8px;
    }
    .sb-footer {
      margin-top: auto;
      padding: 12px;
      font-size: 11px;
      color: var(--dim-sm);
      border-top: 1px solid var(--bd);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* ── Main ────────────────────────────────────────────────────────────── */
    .main {
      flex: 1;
      min-width: 0;
      padding: 30px 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      transition: padding 0.2s ease;
    }
    .panel { display: none; }
    .panel.active { display: flex; flex-direction: column; gap: 24px; animation: fadein 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes fadein {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .panel-title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .panel-sub { font-size: 13px; color: var(--dim); margin-top: 2px; }

    /* Top Control Bar */
    .header {
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--bd);
      border-radius: 20px;
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
    }
    .header-meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .header-meta .title { font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -0.2px; }
    .header-meta .sub-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .sub-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--dim);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 3px 8px;
    }
    .sub-badge svg {
      width: 12px;
      height: 12px;
      stroke: var(--dim-sm);
    }
    
    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    /* Custom Badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--bd);
      border-radius: 99px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-badge.ok { background: var(--ok-glow); border-color: rgba(16, 185, 129, 0.2); color: var(--ok); }
    .status-badge.err { background: var(--err-glow); border-color: rgba(239, 68, 68, 0.2); color: var(--err); }
    .status-badge.info { background: var(--info-glow); border-color: rgba(59, 130, 246, 0.2); color: var(--info); }
    .status-badge.warn { background: var(--warn-glow); border-color: rgba(245, 158, 11, 0.2); color: var(--warn); }
    .status-badge.purple { background: var(--purple-glow); border-color: rgba(139, 92, 246, 0.2); color: var(--purple); }

    .live-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
    }

    /* Select Speed dropdown */
    .refresh-selector {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--bd);
      color: var(--text);
      font-family: var(--font-main);
      font-size: 11px;
      font-weight: 700;
      border-radius: 99px;
      padding: 6px 16px;
      cursor: pointer;
      outline: none;
      transition: all 0.2s ease;
    }
    .refresh-selector:hover {
      border-color: var(--info);
      background: rgba(59, 130, 246, 0.05);
    }

    /* Grid layouts */
    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    
    .card {
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--bd);
      border-radius: 20px;
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--bd-glowing), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.1);
      background: var(--bg-panel-hover);
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
    }
    .card:hover::before {
      opacity: 1;
    }
    
    .card-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--dim);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-label svg {
      width: 14px;
      height: 14px;
      stroke: var(--dim-sm);
    }
    .stat {
      font-size: 24px;
      font-weight: 800;
      font-family: var(--font-mono);
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .stat-sub {
      font-size: 11.5px;
      color: var(--dim-sm);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    /* Metrics Progress Bar */
    .bar {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 99px;
      height: 5px;
      margin-top: 14px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 99px;
      width: 0%;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bar-ok   { background: linear-gradient(90deg, var(--info), var(--cyan)); }
    .bar-warn { background: linear-gradient(90deg, var(--warn), #f59e0b); }
    .bar-err  { background: linear-gradient(90deg, var(--err), #dc2626); }
    .bar-purple { background: linear-gradient(90deg, var(--purple), #a78bfa); }

    /* Canvas Sparklines */
    .chart-container {
      width: 100%;
      height: 80px;
      margin-top: 14px;
      position: relative;
    }
    .chart-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* Terminal logs */
    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: rgba(8, 10, 18, 0.8);
      border-bottom: 1px solid var(--bd);
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
    }
    .term-dots { display: flex; gap: 6px; }
    .term-dots span { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .term-dots .dot-r { background: var(--err); }
    .term-dots .dot-y { background: var(--warn); }
    .term-dots .dot-g { background: var(--ok); }
    .term-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--dim);
      font-family: var(--font-mono);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .terminal-container {
      border: 1px solid var(--bd);
      border-radius: 20px;
      overflow: hidden;
      background: #030508;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    .terminal-body {
      padding: 20px;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.6;
      height: 480px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: height 0.2s ease;
    }
    .term-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border-bottom: 1px solid rgba(255,255,255,0.01);
      padding: 4px 6px;
      border-radius: 7px;
    }
    .term-row-http { align-items: center; gap: 8px; }
    .term-row-http:hover { background: rgba(255,255,255,0.035); }
    .term-ts { color: var(--dim-sm); flex-shrink: 0; width: 65px; }
    .term-msg-info { color: #e2e8f0; }
    .term-msg-warn { color: var(--warn); font-weight: 500; }
    .term-msg-err  { color: var(--err); font-weight: 600; }
    .term-msg-ok   { color: var(--ok); }
    .term-http-method,
    .term-http-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 5px;
      padding: 1px 7px;
      font-size: 10px;
      line-height: 18px;
      font-weight: 900;
      letter-spacing: 0.35px;
    }
    .term-http-method { min-width: 52px; }
    .term-method-get { color: #67e8f9; background: rgba(6,182,212,.14); }
    .term-method-post { color: #86efac; background: rgba(34,197,94,.14); }
    .term-method-put, .term-method-patch { color: #fcd34d; background: rgba(245,158,11,.14); }
    .term-method-delete { color: #fca5a5; background: rgba(239,68,68,.14); }
    .term-method-options, .term-method-head { color: #c4b5fd; background: rgba(139,92,246,.14); }
    .term-http-route {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      color: #dbeafe;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .term-status-2xx { color: #86efac; background: rgba(34,197,94,.14); }
    .term-status-3xx { color: #67e8f9; background: rgba(6,182,212,.14); }
    .term-status-4xx { color: #fcd34d; background: rgba(245,158,11,.14); }
    .term-status-5xx { color: #fca5a5; background: rgba(239,68,68,.16); }
    .term-http-duration { flex-shrink: 0; color: #94a3b8; }
    .term-http-duration.slow { color: #fbbf24; font-weight: 700; }
    .term-http-size { flex-shrink: 0; min-width: 52px; text-align: right; color: #64748b; }
    .term-empty { color: var(--dim-sm); font-style: italic; padding: 20px 0; text-align: center; }

    /* Custom Tables */
    .table-section {
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--bd);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
    }
    .table-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--bd);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .table-title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.2px;
    }
    .table-container {
      max-height: 480px;
      overflow-y: auto;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      padding: 14px 24px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--dim);
      background: rgba(8, 10, 18, 0.5);
      border-bottom: 1px solid var(--bd);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    td {
      padding: 14px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.02);
      font-size: 12.5px;
      font-family: var(--font-mono);
      color: var(--text);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    
    .table-filter-input {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--bd);
      border-radius: 99px;
      color: var(--text);
      font-size: 12px;
      padding: 8px 20px;
      font-family: var(--font-main);
      width: 240px;
      outline: none;
      transition: all 0.2s ease;
    }
    .table-filter-input:focus {
      border-color: var(--info);
      background: rgba(59, 130, 246, 0.05);
    }

    /* Advanced Security UI Grid */
    .security-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .security-card {
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--bd);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.2s ease;
    }
    .security-card:hover {
      transform: translateY(-2px);
      border-color: rgba(16, 185, 129, 0.3);
      background: var(--bg-panel-hover);
    }
    .security-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      color: var(--text);
      font-size: 14px;
    }
    .security-card-desc {
      font-size: 12px;
      color: var(--dim);
      line-height: 1.5;
    }

    /* Network Specific Layout Grid */
    .net-layout-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .net-meta-row {
      grid-column: span 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .net-layout-grid { grid-template-columns: 1fr; }
      .net-meta-row { grid-template-columns: 1fr; grid-column: span 1; }
    }

    /* Utility color badges */
    .purple { color: var(--purple); font-weight: 600; }
    .cyan { color: var(--cyan); }
    .ok { color: var(--ok); }
    .dim { color: var(--dim); }

    /* Footer */
    .footer {
      margin-top: auto;
      text-align: center;
      color: var(--dim-sm);
      font-size: 11px;
      padding: 30px 0 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.02);
      transition: display 0.2s ease;
    }

    @media (max-width: 1024px) {
      body { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: relative; padding: 16px 24px; border-right: none; border-bottom: 1px solid var(--bd); }
      .sb-logo { padding-bottom: 0; }
      .sb-section-label { display: none; }
      .sidebar nav { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
      .sb-footer { display: none; }
      .main { padding: 24px 20px; }
    }
  </style>
</head>
<body>

<!-- ── Sidebar navigation ─────────────────────────────────────────────────── -->
<aside class="sidebar">
  <div class="sb-logo">Devvelocity <span>ERP</span> <span class="sb-logo-badge">DevOps</span></div>

  <div class="sb-section-label">Telemetry Monitor</div>
  <button class="sb-item active" data-target="overview" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
    Overview
  </button>
  <button class="sb-item" data-target="system" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
    System Nodes
  </button>
  <button class="sb-item" data-target="network" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
    Bandwidth &amp; Net
  </button>

  <div class="sb-section-label">System Specs</div>
  <button class="sb-item" data-target="security" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
    Security Stack
  </button>
  <button class="sb-item" data-target="routes" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
    API Gateways <span class="count">${apiRoutes.length}</span>
  </button>
  <button class="sb-item" data-target="sockets" type="button">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
    Socket Bus <span class="count">${socketEvents.length}</span>
  </button>

  <div class="sb-footer">
    <div>Node ${nodeVer}</div>
    <div>Env: ${nodeEnv}</div>
    <div>Port: ${port}</div>
  </div>
</aside>

<!-- ── Main content ───────────────────────────────────────────────────────── -->
<main class="main">

  <!-- Shared Controller Header -->
  <header class="header">
    <div class="header-meta">
      <div class="title">Devvelocity ERP — Core Control Console</div>
      <div class="sub-badges">
        <span class="sub-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><rect x="6" y="6" width="12" height="12"></rect></svg> Host: <strong>${host}</strong></span>
        <span class="sub-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg> Env: <strong>${nodeEnv.toUpperCase()}</strong></span>
        <span class="sub-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Uptime: <span id="live-uptime">${uptime}</span></span>
        <span class="sub-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> <span id="clock">${now}</span></span>
      </div>
    </div>
    
    <div class="header-controls">
      <div class="status-badge info">
        <span class="live-dot"></span>
        <span>Telemetry Tick: <span id="refresh-countdown">30</span>s</span>
      </div>
      
      <select class="refresh-selector" id="refresh-speed-selector" aria-label="Refresh speed selector">
        <option value="2000">Interval: 2s (Real-time)</option>
        <option value="5000">Interval: 5s</option>
        <option value="10000">Interval: 10s</option>
        <option value="30000" selected>Interval: 30s (Default)</option>
        <option value="0">Interval: Pause</option>
      </select>
      
      <div id="live-db-badge">${dbBadge}</div>
      <div class="status-badge purple" id="live-online-badge">● ${onlineUsers} online</div>
    </div>
  </header>

  <!-- ═══════════════════ OVERVIEW ═══════════════════ -->
  <section class="panel active" data-panel="overview">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">Console Output Stream</h1>
        <div class="panel-sub">Real-time system telemetry and standard outputs tail stream</div>
      </div>
    </div>

    <!-- Direct live terminal on the overview tab -->
    <div class="terminal-container">
      <div class="terminal-header">
        <div class="term-dots"><span class="dot-r"></span><span class="dot-y"></span><span class="dot-g"></span></div>
        <div class="term-title">Stdout Console Tail Logs</div>
        <div style="display:flex; gap:12px; align-items:center;">
          <span class="status-badge" id="log-conn-badge" style="background:rgba(255,255,255,0.03); font-size:9px; padding:2px 8px;"><span class="live-dot" style="background:var(--dim)"></span>connecting...</span>
          <button class="status-badge info" style="cursor:pointer; font-size:9px; padding:2px 8px;" type="button" onclick="clearTerminal()">Clear terminal</button>
          <label class="status-badge" style="cursor:pointer; display: flex; align-items: center; gap: 8px; font-size:9px; padding:2px 8px;">
            <input type="checkbox" id="autoscroll-toggle" checked />
            <span>Autoscroll</span>
          </label>
        </div>
      </div>
      <div class="terminal-body" id="overview-terminal" style="height: 480px;">
        <div class="term-row"><span class="term-ts">[SYSTEM]</span><span class="term-msg-info">Devvelocity ERP Core Pipeline Boot Sequence Ready. Logs attached...</span></div>
        <div class="term-empty">Waiting for incoming log frames...</div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ SYSTEM ═══════════════════ -->
  <section class="panel" data-panel="system">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">System Performance &amp; Hardware Status</h1>
        <div class="panel-sub">Active nodes and core parameters monitored in real-time</div>
      </div>
    </div>
    
    <!-- Core nodes shifted here from Overview -->
    <div class="grid">
      <div class="card">
        <div class="card-label">
          <span>Database Node</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z"></path><path d="M22 7c0 2.76-4.477 5-10 5S2 9.76 2 7"></path><path d="M2 12c0 2.76 4.477 5 10 5s10-2.24 10-5"></path></svg>
        </div>
        <div class="stat ${db ? "ok" : "err"}" id="live-db-stat">${db ? "Online" : "Offline"}</div>
        <div class="stat-sub">MongoDB cluster • pool: 2-10</div>
        <div class="bar"><div class="bar-fill ${db ? "bar-ok" : "bar-err"}" id="live-db-bar" style="width:${db ? "100" : "0"}%"></div></div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>Socket Gateway Users</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <div class="stat" id="live-online-stat" style="color:var(--purple)">${onlineUsers}</div>
        <div class="stat-sub">Connected client sockets</div>
        <div class="bar"><div class="bar-fill bar-purple" id="live-online-bar" style="width:${Math.min(onlineUsers * 10, 100)}%"></div></div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>OS Process Count</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <div class="stat" id="live-proc">${processCount ?? "N/A"}</div>
        <div class="stat-sub" id="live-proc-sub">${processRunning !== null ? `${processRunning} active threads` : "N/A on this host"}</div>
        <div class="bar"><div class="bar-fill bar-ok" style="width:100%"></div></div>
      </div>

      <div class="card">
        <div class="card-label"><span>SaaS Tenants</span></div>
        <div class="stat" id="live-tenants">${tenantCounts.active} / ${tenantCounts.total}</div>
        <div class="stat-sub" id="live-tenants-sub">Active / total • ${tenantCounts.suspended} suspended • ${tenantCounts.failed} failed</div>
      </div>

      <div class="card">
        <div class="card-label"><span>Schedulers &amp; Cache</span></div>
        <div class="stat ${jobs.running ? "ok" : "err"}" id="live-jobs">${jobs.running ? `${jobs.registeredSchedulers} scheduled` : "Stopped"}</div>
        <div class="stat-sub" id="live-redis">Redis: ${redisConnected ? "connected" : "offline"}</div>
      </div>

      <div class="card">
        <div class="card-label"><span>API Throughput</span></div>
        <div class="stat" id="live-rpm">${requestsPerMinute.toFixed(1)} req/min</div>
        <div class="stat-sub" id="live-latency">Average response: ${averageResponseMs.toFixed(1)} ms</div>
      </div>

      <div class="card">
        <div class="card-label"><span>Server Error Rate</span></div>
        <div class="stat ${requestErrorRate > 5 ? "err" : requestErrorRate > 1 ? "warn" : "ok"}" id="live-error-rate">${requestErrorRate.toFixed(2)}%</div>
        <div class="stat-sub">HTTP 5xx responses since process start</div>
      </div>
    </div>

    <!-- Live Telemetry Charts and core loads -->
    <div class="grid" style="margin-top: 10px;">
      <div class="card">
        <div class="card-label">
          <span>CPU load average</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><rect x="6" y="6" width="12" height="12"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>
        </div>
        <div class="stat" id="live-cpu-val">${cpuLoadPct}%</div>
        <div class="stat-sub" id="live-load">${cpuCount} cores (${cpuModel}) • loadavg: ${loadAvg}</div>
        <div class="chart-container">
          <canvas class="chart-canvas" id="chart-cpu"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>CPU Core Loads</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 120px; overflow-y: auto;" id="cores-container">
          ${coresHtml}
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>Node Runtime Heap</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </div>
        <div class="stat" id="live-heap">${heapUsedMB} / ${heapTotalMB} MB</div>
        <div class="stat-sub" id="live-rss">RSS total: ${rssMB} MB</div>
        <div class="chart-container">
          <canvas class="chart-canvas" id="chart-heap"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>System Memory (RAM)</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 12h-6l-3 9L9 3l-3 9H2"></path></svg>
        </div>
        <div class="stat" id="live-mem">${sysUsedGB} / ${sysTotalGB} GB</div>
        <div class="stat-sub" id="live-mem-sub">Usage: ${memPct}%</div>
        <div class="chart-container">
          <canvas class="chart-canvas" id="chart-ram"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>Core Thermal &amp; Throttling</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
        <div class="stat ${tempClass}" id="live-temp">${tempStr}</div>
        <div class="stat-sub" id="live-speed">Speed: ${speedStr} ${speedMaxStr}</div>
        <div class="chart-container">
          <canvas class="chart-canvas" id="chart-temp"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>Primary disk storage</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
        </div>
        <div class="stat" id="live-disk">${diskStr}</div>
        <div class="stat-sub" id="live-disk-sub">${diskPct !== null ? `Usage: ${diskPct.toFixed(1)}%` : "N/A"}</div>
        <div class="bar"><div class="bar-fill ${diskBarClass}" id="live-disk-bar" style="width:${diskPctNum}%"></div></div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ NETWORK ═══════════════════ -->
  <section class="panel" data-panel="network">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">Network Statistics &amp; Throughput</h1>
        <div class="panel-sub">Real-time incoming and outgoing network traffic bandwidth data graphs</div>
      </div>
    </div>
    
    <div class="net-layout-grid">
      <div class="card">
        <div class="card-label">
          <span>Network Bandwidth incoming (Rx)</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="17 11 12 16 7 11"></polyline><line x1="12" y1="4" x2="12" y2="16"></line></svg>
        </div>
        <div class="stat" id="live-net-rx" style="font-size:18px">↓ ${fmtBytesPerSec(netRxSec)}</div>
        <div class="stat-sub" id="live-net-rx-sub">${netIfaceStr}</div>
        <div class="chart-container" style="height: 100px;">
          <canvas class="chart-canvas" id="chart-net-rx"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          <span>Network Bandwidth Outgoing (Tx)</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="7 13 12 8 17 13"></polyline><line x1="12" y1="20" x2="12" y2="8"></line></svg>
        </div>
        <div class="stat" id="live-net-tx" style="font-size:18px">↑ ${fmtBytesPerSec(netTxSec)}</div>
        <div class="stat-sub" id="live-net-tx-sub">${netIfaceStr}</div>
        <div class="chart-container" style="height: 100px;">
          <canvas class="chart-canvas" id="chart-net-tx"></canvas>
        </div>
      </div>

      <div class="net-meta-row">
        <div class="card">
          <div class="card-label">
            <span>CORS Settings</span>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <div class="stat" style="font-size:14px; word-break:break-all;">Allowed Origins</div>
          <div class="stat-sub" style="margin-top: 4px; font-family: var(--font-mono); font-size:11px;">${allowedOrigins}</div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Request ID tracing</span>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="stat ok">Active</div>
          <div class="stat-sub">Header: X-Request-ID (UUIDv4)</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ SECURITY ═══════════════════ -->
  <section class="panel" data-panel="security">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">Security Firewall &amp; System Gates</h1>
        <div class="panel-sub">Active environment flags and middleware protection nodes</div>
      </div>
    </div>

    <div class="table-section" style="margin-bottom: 24px;">
      <div class="table-header">
        <div class="table-title">⚙ Environment Config Variables</div>
        <span class="status-badge info">${configOkCount} / ${configChecks.length} Secure</span>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Environment key</th><th>Status flag</th><th>Note</th></tr></thead>
          <tbody>${configRows}</tbody>
        </table>
      </div>
    </div>

    <div class="panel-head" style="margin-top: 10px; margin-bottom: 10px;">
      <div>
        <h2 class="panel-title" style="font-size: 15px;">🛡 Active Defense Infrastructure</h2>
        <div class="panel-sub">System gates hardening the API runtime boundaries</div>
      </div>
    </div>

    <div class="security-grid">
      ${securityLayers
        .map((layer) => {
          return `<div class="security-card">
          <div class="security-card-header">
            <span>${layer.label}</span>
            <span class="status-badge ok" style="padding: 2px 10px; font-size: 9px;">Active</span>
          </div>
          <p class="security-card-desc">${layer.desc}</p>
        </div>`;
        })
        .join("\n")}
    </div>
  </section>

  <!-- ═══════════════════ API ROUTES ═══════════════════ -->
  <section class="panel" data-panel="routes">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">Registered API Gateways</h1>
        <div class="panel-sub">${apiRoutes.length} route controllers mounted under /${apiVersion}/</div>
      </div>
      <input class="table-filter-input" id="route-filter" type="search" placeholder="Search gateways..." oninput="filterTable('route-filter','route-table')" />
    </div>
    
    <div class="table-section">
      <div class="table-container">
        <table id="route-table">
          <thead><tr><th>Gateway name</th><th>Endpoint path</th><th>Status</th></tr></thead>
          <tbody>${routeRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ SOCKET.IO ═══════════════════ -->
  <section class="panel" data-panel="sockets">
    <div class="panel-head">
      <div>
        <h1 class="panel-title">Socket Gateway Event Bus</h1>
        <div class="panel-sub">Active real-time events for communication, collaboration, and WebRTC streaming</div>
      </div>
      <input class="table-filter-input" id="socket-filter" type="search" placeholder="Search events..." oninput="filterTable('socket-filter','socket-table')" />
    </div>

    <div class="table-section">
      <div class="table-container">
        <table id="socket-table">
          <thead><tr><th>Event key</th><th>Direction</th><th>Event payload description</th></tr></thead>
          <tbody>${socketRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div style="margin-bottom:6px">
      Devvelocity ERP System Console • Powered by Express, MongoDB, Socket.io, and TypeScript
    </div>
    <div>
      © ${year} Devvelocity
    </div>
  </footer>

</main>

<script>
  (function () {
    var cpuCount = ${cpuCount};
    var tempUnavailableMsg = '${cpuTemp === null ? (process.platform === "linux" ? "N/A" : "OS restricted") : ""}';
    
    // ── Navigation tabs ──────────────────────────────────────────────────────
    var sbItems = document.querySelectorAll('.sb-item');
    var panels = document.querySelectorAll('.panel');

    sbItems.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-target');
        sbItems.forEach(function (b) { b.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); p.style.display = 'none'; });
        btn.classList.add('active');
        
        var panel = document.querySelector('.panel[data-panel="' + target + '"]');
        if (panel) {
          panel.classList.add('active');
          panel.style.display = 'block';
        }

        try { history_replace(target); } catch (e) {}
        
        // Trigger resize so Canvas charts layout properly in new tab
        setTimeout(function() {
          window.dispatchEvent(new Event('resize'));
        }, 50);
      });
    });

    function history_replace(target) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#' + target);
      }
    }
    var initialHash = (location.hash || '').replace('#', '');
    if (initialHash) {
      var initialBtn = document.querySelector('.sb-item[data-target="' + initialHash + '"]');
      if (initialBtn) initialBtn.click();
    } else {
      // Trigger display styles for active panel on boot
      var activePanel = document.querySelector('.panel.active');
      if (activePanel) activePanel.style.display = 'block';
    }

    // ── Table filtering helper ───────────────────────────────────────────────
    window.filterTable = function (inputId, tableId) {
      var q = (document.getElementById(inputId).value || '').toLowerCase();
      var rows = document.querySelectorAll('#' + tableId + ' tbody tr');
      rows.forEach(function (row) {
        row.style.display = row.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : '';
      });
    };

    // ── Clock update ─────────────────────────────────────────────────────────
    setInterval(function () {
      var el = document.getElementById('clock');
      if (el) el.textContent = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }, 1000);

    // ── Lightweight Glowing Canvas Chart Renderer ──────────────────────────
    function NeonChart(canvasId, color, glowColor) {
      this.canvas = document.getElementById(canvasId);
      this.color = color;
      this.glowColor = glowColor;
      this.data = [];
      this.maxPoints = 40;
      
      var self = this;
      this.resize = function() {
        if (!self.canvas) return;
        var p = self.canvas.parentElement;
        self.canvas.width = p.clientWidth * window.devicePixelRatio;
        self.canvas.height = p.clientHeight * window.devicePixelRatio;
        self.render();
      };
      
      this.push = function(val) {
        self.data.push(val);
        if (self.data.length > self.maxPoints) self.data.shift();
        self.render();
      };

      this.render = function() {
        if (!self.canvas) return;
        var ctx = self.canvas.getContext('2d');
        var w = self.canvas.width;
        var h = self.canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (self.data.length < 2) return;

        // Background grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1 * window.devicePixelRatio;
        for (var i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, h * i / 4);
          ctx.lineTo(w, h * i / 4);
          ctx.stroke();
        }

        var maxVal = Math.max.apply(null, self.data.concat([10]));
        var step = w / (self.maxPoints - 1);
        
        // Fill under the curve path
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (var idx = 0; idx < self.data.length; idx++) {
          var cx = idx * step;
          var cy = h - (self.data[idx] / maxVal) * (h - 10) - 5;
          ctx.lineTo(cx, cy);
        }
        ctx.lineTo((self.data.length - 1) * step, h);
        ctx.closePath();

        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, self.glowColor);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw Line with shadow/neon glow
        ctx.beginPath();
        for (var idx = 0; idx < self.data.length; idx++) {
          var cx = idx * step;
          var cy = h - (self.data[idx] / maxVal) * (h - 10) - 5;
          if (idx === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.strokeStyle = self.color;
        ctx.lineWidth = 2 * window.devicePixelRatio;
        ctx.shadowBlur = 8 * window.devicePixelRatio;
        ctx.shadowColor = self.color;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      };
      
      window.addEventListener('resize', this.resize);
      this.resize();
    }

    // Initialize Chart Instances
    var chartCpu = new NeonChart('chart-cpu', '#3b82f6', 'rgba(59, 130, 246, 0.15)');
    var chartHeap = new NeonChart('chart-heap', '#06b6d4', 'rgba(6, 182, 212, 0.15)');
    var chartRam = new NeonChart('chart-ram', '#8b5cf6', 'rgba(139, 92, 246, 0.15)');
    var chartTemp = new NeonChart('chart-temp', '#ef4444', 'rgba(239, 68, 68, 0.15)');
    var chartNetRx = new NeonChart('chart-net-rx', '#10b981', 'rgba(16, 185, 129, 0.15)');
    var chartNetTx = new NeonChart('chart-net-tx', '#f59e0b', 'rgba(245, 158, 11, 0.15)');

    // ── Metric Polling System ────────────────────────────────────────────────
    var secs = 30;
    var tickInterval = 30000;
    var cdEl = document.getElementById('refresh-countdown');
    var pollTimer = null;
    var countdownTimer = null;

    function setBar(id, pct, cls) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.width = Math.min(pct, 100) + '%';
      el.className = 'bar-fill ' + cls;
    }
    function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    function setHtml(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; }
    function barClass(pct) { return pct > 85 ? 'bar-err' : pct > 65 ? 'bar-warn' : 'bar-ok'; }
    function tempCls(t)    { return t === null ? 'dim' : t > 85 ? 'err' : t > 65 ? 'warn' : 'ok'; }
    function fmtBytesPerSec(v) {
      if (v === null || v === undefined || isNaN(v)) return '0 B/s';
      if (v < 1024) return v.toFixed(0) + ' B/s';
      if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB/s';
      return (v / 1024 / 1024).toFixed(2) + ' MB/s';
    }

    function triggerPoll() {
      fetch('/__stats')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          // DB Status
          setHtml('live-db-badge', d.db
            ? '<span class="status-badge ok">\u25CF CONNECTED</span>'
            : '<span class="status-badge err">\u25CF DISCONNECTED</span>');
          var dbStat = document.getElementById('live-db-stat');
          if (dbStat) { dbStat.textContent = d.db ? 'Online' : 'Offline'; dbStat.className = 'stat ' + (d.db ? 'ok' : 'err'); }
          setBar('live-db-bar', d.db ? 100 : 0, d.db ? 'bar-ok' : 'bar-err');

          // Users online
          setText('live-online-badge', '\u25CF ' + d.onlineUsers + ' online');
          setText('live-online-stat', d.onlineUsers);
          setBar('live-online-bar', Math.min(d.onlineUsers * 10, 100), 'bar-purple');

          // Processes
          setText('live-proc', d.processCount !== null && d.processCount !== undefined ? d.processCount : 'N/A');
          setText('live-proc-sub', d.processRunning !== null && d.processRunning !== undefined ? d.processRunning + ' active threads' : 'N/A on this host');

          // SaaS and application operations
          if (d.tenantCounts) {
            setText('live-tenants', d.tenantCounts.active + ' / ' + d.tenantCounts.total);
            setText('live-tenants-sub', 'Active / total • ' + d.tenantCounts.suspended + ' suspended • ' + d.tenantCounts.failed + ' failed');
          }
          setText('live-jobs', d.jobs && d.jobs.running ? d.jobs.registeredSchedulers + ' scheduled' : 'Stopped');
          setText('live-redis', 'Redis: ' + (d.redisConnected ? 'connected' : 'offline'));
          setText('live-rpm', Number(d.requestsPerMinute || 0).toFixed(1) + ' req/min');
          setText('live-latency', 'Average response: ' + Number(d.averageResponseMs || 0).toFixed(1) + ' ms');
          var errorRate = Number(d.requestErrorRate || 0);
          var errorRateEl = document.getElementById('live-error-rate');
          if (errorRateEl) {
            errorRateEl.textContent = errorRate.toFixed(2) + '%';
            errorRateEl.className = 'stat ' + (errorRate > 5 ? 'err' : errorRate > 1 ? 'warn' : 'ok');
          }

          // Uptime
          setText('live-uptime', d.uptime);

          // Heap Memory
          setText('live-heap', d.heapUsedMB + ' / ' + d.heapTotalMB + ' MB');
          setText('live-rss', 'RSS total: ' + d.rssMB + ' MB');
          var heapPct = (parseFloat(d.heapUsedMB) / parseFloat(d.heapTotalMB)) * 100;
          chartHeap.push(heapPct);

          // System Memory
          setText('live-mem', d.sysUsedGB + ' / ' + d.sysTotalGB + ' GB');
          setText('live-mem-sub', 'Usage: ' + d.memPct + '%');
          chartRam.push(parseFloat(d.memPct));

          // CPU Load
          var overallCpuLoad = d.cpuLoadCurrent !== null && d.cpuLoadCurrent !== undefined ? d.cpuLoadCurrent : (parseFloat(d.loadAvg[0]) / cpuCount) * 100;
          setText('live-cpu-val', overallCpuLoad.toFixed(1) + '%');
          setText('live-load', 'loadavg: ' + d.loadAvg.join('  '));
          chartCpu.push(overallCpuLoad);

          // Cores Container
          var coresContainer = document.getElementById('cores-container');
          if (coresContainer && d.cpuCoresLoad && d.cpuCoresLoad.length > 0) {
            var coresHtml = d.cpuCoresLoad.map(function(load, idx) {
              return '<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; font-family: var(--font-mono); font-size: 11px;">' +
                '<span style="color: var(--dim-sm); font-weight: 500;">Core ' + idx + '</span>' +
                '<div style="flex: 1; background: rgba(0, 0, 0, 0.3); border-radius: 99px; height: 4px; overflow: hidden;">' +
                  '<div class="bar-fill bar-ok" style="width: ' + load.toFixed(0) + '%; height: 100%;"></div>' +
                '</div>' +
                '<span style="color: var(--cyan); font-weight: bold; width: 35px; text-align: right;">' + load.toFixed(0) + '%</span>' +
              '</div>';
            }).join('\\n');
            coresContainer.innerHTML = coresHtml;
          }

          // CPU Temp
          var tStr = d.cpuTemp !== null ? d.cpuTemp.toFixed(1) + ' \u00b0C' : tempUnavailableMsg || 'OS restricted';
          var tempEl = document.getElementById('live-temp');
          if (tempEl) { tempEl.textContent = tStr; tempEl.className = 'stat ' + tempCls(d.cpuTemp); }
          setText('live-speed', 'Speed: ' + (d.cpuSpeed ? d.cpuSpeed.toFixed(2) + ' GHz' : 'N/A')
            + (d.cpuSpeedMax ? ' / ' + d.cpuSpeedMax.toFixed(2) + ' GHz' : ''));
          chartTemp.push(d.cpuTemp || 0);

          // Disk
          if (d.diskUsedGB !== null && d.diskTotalGB !== null) {
            setText('live-disk', d.diskUsedGB.toFixed(1) + ' / ' + d.diskTotalGB.toFixed(1) + ' GB');
            setText('live-disk-sub', 'Usage: ' + d.diskPct.toFixed(1) + '%');
            setBar('live-disk-bar', d.diskPct, barClass(d.diskPct));
          }

          // Network Traffic Rx & Tx
          setText('live-net-rx', '↓ ' + fmtBytesPerSec(d.netRxSec));
          setText('live-net-rx-sub', d.netIface ? 'Rx Interface: ' + d.netIface : 'Interface: N/A');
          chartNetRx.push(d.netRxSec ? d.netRxSec / 1024 : 0);

          setText('live-net-tx', '↑ ' + fmtBytesPerSec(d.netTxSec));
          setText('live-net-tx-sub', d.netIface ? 'Tx Interface: ' + d.netIface : 'Interface: N/A');
          chartNetTx.push(d.netTxSec ? d.netTxSec / 1024 : 0);
        })
        .catch(function () { /* ignore network error; retry on next tick */ });
    }

    function setupIntervals() {
      // Clear existing tickers
      if (pollTimer) clearInterval(pollTimer);
      if (countdownTimer) clearInterval(countdownTimer);

      if (tickInterval === 0) {
        // Paused state
        if (cdEl) cdEl.textContent = 'Paused';
        return;
      }

      // Initial fetch to load stats
      triggerPoll();

      secs = tickInterval / 1000;
      if (cdEl) cdEl.textContent = String(secs);

      countdownTimer = setInterval(function() {
        secs--;
        if (cdEl) cdEl.textContent = String(secs);
        if (secs <= 0) {
          secs = tickInterval / 1000;
          if (cdEl) cdEl.textContent = String(secs);
        }
      }, 1000);

      pollTimer = setInterval(function() {
        triggerPoll();
      }, tickInterval);
    }

    // Refresh interval controller selector
    var speedSel = document.getElementById('refresh-speed-selector');
    if (speedSel) {
      speedSel.addEventListener('change', function() {
        var v = parseInt(speedSel.value);
        tickInterval = v;
        setupIntervals();
      });
    }

    // Start Telemetry
    setupIntervals();

    // ── Live log stream SSE ──────────────────────────────────────────────────
    var termOverviewEl = document.getElementById('overview-terminal');
    var connBadge = document.getElementById('log-conn-badge');
    var autoscrollBox = document.getElementById('autoscroll-toggle');
    var MAX_LINES = 500;

    function classifyLine(line) {
      if (/\\berror\\b|\\bfail(ed)?\\b|\\bexception\\b/i.test(line)) return 'term-msg-err';
      if (/\\bwarn(ing)?\\b/i.test(line)) return 'term-msg-warn';
      if (/\\bconnected\\b|\\bsuccess\\b|\\bok\\b|\\u2705/i.test(line)) return 'term-msg-ok';
      return 'term-msg-info';
    }

    function parseHttpLine(line) {
      var match = String(line || '').match(/(?:^|\\s)(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\\s+(\\S+)\\s+(\\d{3})\\s+([\\d.]+)\\s+ms\\s+-\\s+(\\S+)/i);
      if (!match) return null;
      return {
        method: match[1].toUpperCase(),
        route: match[2],
        status: parseInt(match[3], 10),
        duration: parseFloat(match[4]),
        size: match[5]
      };
    }

    function appendTextElement(parent, tag, className, text, title) {
      var el = document.createElement(tag);
      el.className = className;
      el.textContent = text;
      if (title) el.title = title;
      parent.appendChild(el);
      return el;
    }

    function renderHttpLog(row, parsed) {
      row.classList.add('term-row-http');
      appendTextElement(row, 'span', 'term-http-method term-method-' + parsed.method.toLowerCase(), parsed.method);
      appendTextElement(row, 'span', 'term-http-route', parsed.route, parsed.route);
      var statusGroup = Math.max(2, Math.min(5, Math.floor(parsed.status / 100)));
      appendTextElement(row, 'span', 'term-http-status term-status-' + statusGroup + 'xx', String(parsed.status));
      appendTextElement(
        row,
        'span',
        'term-http-duration' + (parsed.duration >= 1000 ? ' slow' : ''),
        parsed.duration.toFixed(parsed.duration < 10 ? 1 : 0) + ' ms'
      );
      appendTextElement(row, 'span', 'term-http-size', parsed.size === '-' ? '—' : parsed.size);
    }

    function appendLogLine(entry) {
      // Stream to Overview Panel Log Console
      if (termOverviewEl) {
        if (termOverviewEl.querySelector('.term-empty')) termOverviewEl.innerHTML = '';
        var rowOverview = document.createElement('div');
        rowOverview.className = 'term-row';
        var tsOverview = document.createElement('span');
        tsOverview.className = 'term-ts';
        var dOverview = new Date(entry.ts || Date.now());
        tsOverview.textContent = dOverview.toLocaleTimeString('en-IN', { hour12: false });
        rowOverview.appendChild(tsOverview);
        var httpLog = parseHttpLine(entry.line || '');
        if (httpLog) {
          renderHttpLog(rowOverview, httpLog);
        } else {
          var msgOverview = document.createElement('span');
          msgOverview.className = classifyLine(entry.line || '');
          msgOverview.textContent = entry.line || '';
          rowOverview.appendChild(msgOverview);
        }
        termOverviewEl.appendChild(rowOverview);

        while (termOverviewEl.children.length > MAX_LINES) {
          termOverviewEl.children[0].remove();
        }
        if (autoscrollBox && autoscrollBox.checked) termOverviewEl.scrollTop = termOverviewEl.scrollHeight;
      }
    }

    window.clearTerminal = function () {
      if (termOverviewEl) termOverviewEl.innerHTML = '<div class="term-empty">Cleared — waiting for new log lines...</div>';
    };

    function connectLogStream() {
      if (typeof EventSource === 'undefined') {
        if (connBadge) connBadge.innerHTML = '<span class="status-badge err">SSE Unsupported</span>';
        return;
      }
      var es = new EventSource('/__logs/stream');
      es.onopen = function () {
        var badgeHtml = '<span class="live-dot"></span>Online';
        if (connBadge) connBadge.innerHTML = badgeHtml;
      };
      es.onmessage = function (e) {
        try {
          var entry = JSON.parse(e.data);
          appendLogLine(entry);
        } catch (err) { /* ignore parse error */ }
      };
      es.onerror = function () {
        var badgeHtml = 'Reconnecting...';
        if (connBadge) connBadge.innerHTML = badgeHtml;
      };
    }
    connectLogStream();
  })();
</script>
</body>
</html>`;
}
