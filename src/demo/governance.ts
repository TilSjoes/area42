/**
 * Area42 Governance Demo
 *
 * Business-mode visualization: no universe, no space invaders.
 * Three governance tiers (Strategic, Tactical, Operational) as
 * structured panels with metrics, charts, and data tables.
 *
 * Proves Area42 works for PowerBI/PowerPoint-style dashboards too.
 */
import { HUD } from "../core/hud.js";
import { MetricDisplay } from "../panels/metric.js";
import { TimeSeries } from "../charts/timeseries.js";
import { Table } from "../panels/table.js";

// --- Embedded mode: no universe background ---
const hud = new HUD("#hud", {
  theme: "neon",
  background: false, // transparent — no grid, no space
});

// Override container to have a subtle dark gradient instead of black
const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(180deg, #0c1120 0%, #0a0e17 100%)";

// === STRATEGIC TIER (C-Level / Board) ===

const strategic = hud.panel({
  title: "Strategic — C-Level / Board",
  position: { x: 20, y: 20 },
  size: { x: hud.renderer.width - 40, y: 220 },
  glass: false,
  titleColor: "#00d4aa",
});

const trustMetrics = new MetricDisplay({ columns: 3 });
trustMetrics.set("Trust Index", "82.1", "#00d4aa");
trustMetrics.set("Compliance", "75%", "#ffd43b");
trustMetrics.set("Risk Posture", "77.8", "#51cf66");

const compressionMetrics = new MetricDisplay({ columns: 3 });
compressionMetrics.set("Vertical", "28.4x", "#4dabf7");
compressionMetrics.set("Horizontal", "2,880x", "#a78bfa");
compressionMetrics.set("Projects", "10", "#c8d6e5");

const trustTrend = new TimeSeries({ maxPoints: 30, color: "#00d4aa" });
// Simulate trust index trend
for (let i = 0; i < 30; i++) {
  trustTrend.push(75 + Math.random() * 10 + i * 0.2);
}

strategic.onContent((ctx, x, y, w, h) => {
  // Left: Trust Index metrics
  trustMetrics.render(ctx, x, y, w * 0.4, 60);

  // Middle: Compression metrics
  compressionMetrics.render(ctx, x + w * 0.42, y, w * 0.35, 60);

  // Right: Trust trend sparkline
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("TRUST INDEX TREND", x + w * 0.78, y + 8);
  ctx.letterSpacing = "0px";
  trustTrend.render(ctx, x + w * 0.78, y + 14, w * 0.2, 45);

  // Bottom: Coverage bar
  const barY = y + 80;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "9px system-ui";
  ctx.fillText("GOVERNANCE COVERAGE", x, barY);

  const barX = x;
  const barW = w;
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(barX, barY + 14, barW, 16);
  ctx.fillStyle = "#00d4aa";
  ctx.fillRect(barX, barY + 14, barW * 0.7, 16);
  // Rounded ends
  ctx.fillStyle = "#c8d6e5";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("7/10 projects governed (70%)", barX + barW, barY + 10);
  ctx.textAlign = "left";

  // Eliminates list
  const elimY = barY + 40;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "9px system-ui";
  ctx.fillText("ELIMINATES:", x, elimY);
  ctx.fillStyle = "#51cf66";
  ctx.font = "10px system-ui";
  const items = ["project management", "security review meetings", "compliance audit scheduling", "cross-team coordination"];
  ctx.fillText(items.join("  •  "), x + 75, elimY);
});

// === TACTICAL TIER (Tech Leads / Architects) ===

const tactical = hud.panel({
  title: "Tactical — Tech Leads / Architects",
  position: { x: 20, y: 260 },
  size: { x: hud.renderer.width - 40, y: 200 },
  glass: false,
  titleColor: "#ffd43b",
});

// Compliance data
const complianceData = [
  { project: "BoringBank", pct: 100, status: "compliant" },
  { project: "suits", pct: 100, status: "compliant" },
  { project: "agentsmith", pct: 100, status: "compliant" },
  { project: "marvin", pct: 100, status: "compliant" },
  { project: "meavivo", pct: 87.5, status: "partial" },
  { project: "voice-pipeline", pct: 62.5, status: "non-compliant" },
  { project: "patstone", pct: 50, status: "non-compliant" },
  { project: "snoopy", pct: 37.5, status: "non-compliant" },
  { project: "vale", pct: 37.5, status: "non-compliant" },
];

tactical.onContent((ctx, x, y, w, h) => {
  const col1W = w * 0.22;
  const col2W = w * 0.33;
  const col3W = w * 0.42;

  // Column 1: Intent Score
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("INTENT SCORE", x, y + 10);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#51cf66";
  ctx.font = "bold 42px system-ui";
  ctx.fillText("100", x, y + 55);
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "10px system-ui";
  ctx.fillText("35/35 sessions", x, y + 70);

  // Column 2: Risk Guidance stacked bar
  const rx = x + col1W + 20;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("RISK GUIDANCE", rx, y + 10);
  ctx.letterSpacing = "0px";

  const rBarY = y + 20;
  const rBarW = col2W - 30;
  // Auto (green)
  ctx.fillStyle = "#51cf66";
  ctx.fillRect(rx, rBarY, rBarW * 0.557, 28);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("55.7%", rx + rBarW * 0.557 / 2, rBarY + 18);
  // Review (yellow)
  ctx.fillStyle = "#ffd43b";
  ctx.fillRect(rx + rBarW * 0.557, rBarY, rBarW * 0.443, 28);
  ctx.fillStyle = "#000";
  ctx.fillText("44.3%", rx + rBarW * 0.557 + rBarW * 0.443 / 2, rBarY + 18);
  ctx.textAlign = "left";

  ctx.fillStyle = "#6b7b8d";
  ctx.font = "10px system-ui";
  ctx.fillText("83 auto / 66 review / 0 block", rx, y + 70);

  // Column 3: Compliance per project
  const cx = x + col1W + col2W + 40;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("COMPLIANCE", cx, y + 10);
  ctx.letterSpacing = "0px";

  // Big number
  ctx.fillStyle = "#ffd43b";
  ctx.font = "bold 36px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("75", cx + col3W - 10, y + 48);
  ctx.textAlign = "left";
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "10px system-ui";
  ctx.fillText("9 projects", cx, y + 24);

  // Project bars
  let py = y + 60;
  for (const p of complianceData.slice(0, 6)) {
    const color = p.pct >= 80 ? "#51cf66" : p.pct >= 50 ? "#ffd43b" : "#ff6b6b";
    // Left border
    ctx.fillStyle = color;
    ctx.fillRect(cx, py, 3, 14);
    // Project name
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "10px system-ui";
    ctx.fillText(p.project, cx + 8, py + 11);
    // Percentage
    ctx.fillStyle = color;
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(p.pct + "%", cx + col3W - 10, py + 11);
    ctx.textAlign = "left";
    py += 18;
  }
});

// === OPERATIONAL TIER (Developers / Agents) ===

const operational = hud.panel({
  title: "Operational — Developers / Agents",
  position: { x: 20, y: 480 },
  size: { x: hud.renderer.width - 40, y: hud.renderer.height - 500 },
  glass: false,
  titleColor: "#ff6b6b",
});

// Security findings table
const findingsTable = new Table([
  { key: "project", label: "Project", width: 0.2 },
  { key: "category", label: "Category", width: 0.2 },
  { key: "severity", label: "Severity", width: 0.12 },
  { key: "title", label: "Finding", width: 0.35 },
  { key: "owasp", label: "OWASP", width: 0.13 },
]);

findingsTable.setData([
  { project: "voice-pipeline", category: "auth", severity: "Warning", title: "API endpoints may lack authentication", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "suits", category: "secret", severity: "Critical", title: "API Key found in source", owasp: "A02:2021", _badge: "CRIT", _badgeColor: "#ff6b6b" },
  { project: "agentsmith", category: "secret", severity: "Critical", title: "GitHub User Token found", owasp: "A02:2021", _badge: "CRIT", _badgeColor: "#ff6b6b" },
  { project: "meavivo", category: "permission", severity: "Warning", title: ".env file permissions 664", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "suits", category: "auth", severity: "Warning", title: "Bank routes may lack auth", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "voice-pipeline", category: "secret", severity: "Critical", title: "Token found in config", owasp: "A02:2021", _badge: "CRIT", _badgeColor: "#ff6b6b" },
  { project: "marvin", category: "permission", severity: "Warning", title: ".env permissions too open", owasp: "A05:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "suits", category: "auth", severity: "Warning", title: "Prosjekt routes no auth", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "agentsmith", category: "permission", severity: "Warning", title: ".env permissions 664", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
  { project: "suits", category: "auth", severity: "Warning", title: "Faktura routes lack auth", owasp: "A01:2021", _badge: "WARN", _badgeColor: "#ffd43b" },
]);

// OWASP bar data
const owaspData = [
  { label: "A01:Broken Access", count: 70, pct: 35, color: "#ff6b6b" },
  { label: "A02:Crypto Failures", count: 77, pct: 39, color: "#ffd43b" },
  { label: "A05:Security Misconfig", count: 53, pct: 26, color: "#f97316" },
];

operational.onContent((ctx, x, y, w, h) => {
  const leftW = w * 0.35;
  const rightW = w * 0.62;

  // Left: Security summary + OWASP bars
  ctx.fillStyle = "#ff6b6b";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("SECURITY FINDINGS", x, y + 10);
  ctx.letterSpacing = "0px";

  // Summary counters
  const counters = [
    { label: "CRIT", value: "77", color: "#ff6b6b" },
    { label: "WARN", value: "122", color: "#ffd43b" },
    { label: "INFO", value: "0", color: "#6b7b8d" },
    { label: "TOTAL", value: "199", color: "#c8d6e5" },
  ];
  let cx = x;
  for (const c of counters) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(c.label, cx + 25, y + 28);
    ctx.fillStyle = c.color;
    ctx.font = "bold 18px system-ui";
    ctx.fillText(c.value, cx + 25, y + 50);
    cx += 60;
  }
  ctx.textAlign = "left";

  // OWASP bars
  let oy = y + 70;
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("OWASP TOP 10", x, oy);
  ctx.letterSpacing = "0px";
  oy += 14;

  for (const o of owaspData) {
    ctx.fillStyle = o.color;
    ctx.font = "9px system-ui";
    ctx.fillText(o.label, x, oy + 10);
    // Bar
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, oy + 16, leftW - 10, 10);
    ctx.fillStyle = o.color;
    ctx.fillRect(x, oy + 16, (leftW - 10) * o.pct / 100, 10);
    // Count
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(o.pct + "%  " + o.count, leftW - 10 + x, oy + 10);
    ctx.textAlign = "left";
    oy += 34;
  }

  // Right: Findings table
  const tx = x + leftW + 20;
  ctx.fillStyle = "#ff6b6b";
  ctx.font = "bold 8px system-ui";
  ctx.letterSpacing = "1px";
  ctx.fillText("FINDINGS", tx, y + 10);
  ctx.letterSpacing = "0px";

  findingsTable.render(ctx, tx, y + 18, rightW - 20, h - 30);
});

// === Governance indicator: scanning status ===
const scanStatus = hud.panel({
  title: "Last Scan",
  position: { x: hud.renderer.width - 180, y: hud.renderer.height - 50 },
  size: { x: 160, y: 30 },
  glass: true,
  compact: true,
  titleColor: "#51cf66",
});
scanStatus.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#51cf66";
  ctx.font = "10px system-ui";
  ctx.fillText("● 04:00 AM • 9 projects", x, y + 4);
});

// --- Status Bar ---
hud.statusBar.set('brand', 'Area42 v0.1.0', { position: 'left', color: '#00d4aa' });
hud.statusBar.set('stats', 'Panels: 4 | FPS: 60', { position: 'right' });

let govFrameCount = 0;
let govLastFpsTime = performance.now();
hud.renderer.onRender((rc) => {
  govFrameCount++;
  const now = performance.now();
  if (now - govLastFpsTime >= 1000) {
    const fps = Math.round(govFrameCount * 1000 / (now - govLastFpsTime));
    hud.statusBar.set('stats', 'Panels: 4 | FPS: ' + fps, { position: 'right' });
    govFrameCount = 0;
    govLastFpsTime = now;
  }
});

// Trust trend live update
setInterval(() => {
  trustTrend.push(75 + Math.random() * 10 + 6);
}, 2000);

console.log(
  "%c Area42 %c Governance Dashboard Demo ",
  "background:#0a0e17;color:#00d4aa;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px",
  "background:#131a2b;color:#c8d6e5;padding:4px 8px;border-radius:0 4px 4px 0",
);
console.log("  Three-tier governance: Strategic (C-Level), Tactical (Architects), Operational (Developers)");
console.log("  Drag panels by title bars. Resize from corners. Press ? for help.");
