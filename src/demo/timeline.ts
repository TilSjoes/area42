/**
 * Area42 Timeline Demo
 *
 * An Area42-native timeline visualization — a modern activity stream
 * showing project activity over time with sparklines, workflow graphs,
 * and a chronological event table.
 *
 * Embedded mode with dark gradient.
 */
import { HUD } from "../core/hud.js";
import { MetricDisplay } from "../panels/metric.js";
import { TimeSeries } from "../charts/timeseries.js";
import { Table } from "../panels/table.js";
import { MiniGraph } from "../panels/minigraph.js";
import { withAlpha } from "../core/color.js";

// --- Embedded mode ---
const hud = new HUD("#hud", {
  theme: "neon",
  background: false,
});

const container = document.getElementById("hud")!;
container.style.background = "linear-gradient(160deg, #0a0e17 0%, #101829 40%, #0d1220 100%)";

const W = hud.renderer.width;
const H = hud.renderer.height;

// ============================================================================
// PROJECT DATA (simulated 90-day history)
// ============================================================================

interface Project {
  name: string;
  color: string;
  events: number;
  commits: number;
  velocity: number;
  activityData: number[];
  workflowStatuses: Record<string, "pending" | "running" | "completed" | "failed">;
}

interface ActivityEvent {
  time: string;
  date: string;
  project: string;
  type: string;
  description: string;
  color: string;
}

// Generate realistic 90-day activity data with bursts and quiet periods
function genActivity(baseLevel: number, burstChance: number): number[] {
  const data: number[] = [];
  let inBurst = false;
  let burstDays = 0;
  for (let i = 0; i < 90; i++) {
    if (!inBurst && Math.random() < burstChance) {
      inBurst = true;
      burstDays = 3 + Math.floor(Math.random() * 7);
    }
    if (inBurst) {
      data.push(baseLevel * (2 + Math.random() * 3));
      burstDays--;
      if (burstDays <= 0) inBurst = false;
    } else {
      // Quiet period: some days zero, some low
      data.push(Math.random() < 0.3 ? 0 : baseLevel * Math.random());
    }
  }
  return data;
}

const projects: Project[] = [
  {
    name: "BoringBank",
    color: "#4dabf7",
    events: 342,
    commits: 186,
    velocity: 4.2,
    activityData: genActivity(5, 0.12),
    workflowStatuses: { plan: "completed", code: "completed", review: "completed", deploy: "completed" },
  },
  {
    name: "AgentSmith",
    color: "#f97316",
    events: 521,
    commits: 298,
    velocity: 6.1,
    activityData: genActivity(7, 0.15),
    workflowStatuses: { plan: "completed", code: "running", review: "pending", deploy: "pending" },
  },
  {
    name: "Marvin",
    color: "#a78bfa",
    events: 284,
    commits: 157,
    velocity: 3.8,
    activityData: genActivity(4, 0.1),
    workflowStatuses: { plan: "completed", code: "completed", review: "running", deploy: "pending" },
  },
  {
    name: "Suits",
    color: "#51cf66",
    events: 198,
    commits: 112,
    velocity: 2.4,
    activityData: genActivity(3, 0.08),
    workflowStatuses: { plan: "completed", code: "completed", review: "completed", deploy: "running" },
  },
  {
    name: "Area42",
    color: "#22d3ee",
    events: 89,
    commits: 47,
    velocity: 5.3,
    activityData: genActivity(6, 0.2),
    workflowStatuses: { plan: "completed", code: "running", review: "pending", deploy: "pending" },
  },
  {
    name: "Vale",
    color: "#ffd43b",
    events: 156,
    commits: 84,
    velocity: 1.9,
    activityData: genActivity(2, 0.06),
    workflowStatuses: { plan: "completed", code: "completed", review: "completed", deploy: "completed" },
  },
];

// Pre-build TimeSeries and MiniGraphs for each project
const projectSeries: Map<string, TimeSeries> = new Map();
const projectWorkflows: Map<string, MiniGraph> = new Map();

for (const p of projects) {
  const ts = new TimeSeries({ color: p.color, maxPoints: 90, lineWidth: 1.5 });
  for (const val of p.activityData) {
    ts.push(val);
  }
  projectSeries.set(p.name, ts);

  const mg = new MiniGraph(
    [
      { id: "plan", label: "Plan", status: p.workflowStatuses.plan },
      { id: "code", label: "Code", status: p.workflowStatuses.code },
      { id: "review", label: "Review", status: p.workflowStatuses.review },
      { id: "deploy", label: "Deploy", status: p.workflowStatuses.deploy },
    ],
    [
      { from: "plan", to: "code" },
      { from: "code", to: "review" },
      { from: "review", to: "deploy" },
    ],
  );
  projectWorkflows.set(p.name, mg);
}

// Activity events for the stream
const eventTypes = ["commit", "mission", "dream", "worker", "deploy", "review"];
const typeColors: Record<string, string> = {
  commit: "#51cf66",
  mission: "#4dabf7",
  dream: "#a78bfa",
  worker: "#f97316",
  deploy: "#22d3ee",
  review: "#ffd43b",
};

const commitMessages = [
  "Fix auth middleware for bank routes",
  "Add semantic search to memory system",
  "Refactor spine classifier training loop",
  "Update dashboard SSE event handling",
  "Implement cost savings aggregation",
  "Add OWASP compliance scanning",
  "Fix NATS JetStream reconnection",
  "Optimize MoE slot allocation",
  "Add voice pipeline error recovery",
  "Update Tailwind config for dark mode",
  "Implement graph zoom-to-fit",
  "Fix particle system memory leak",
  "Add Norwegian localization strings",
  "Refactor TimeSeries chart rendering",
  "Deploy governance agent updates",
];

const missionDescs = [
  "Phoenix Build 4 planning",
  "Security audit for Suits",
  "Investigate routing latency",
  "Implement Babelfish dreaming",
  "Optimize VRAM allocation",
];

const activityEvents: ActivityEvent[] = [];

function generateEvents(): void {
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    const ago = Math.random() * 86400000 * 3; // last 3 days
    const d = new Date(now - ago);
    const project = projects[Math.floor(Math.random() * projects.length)];
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    let desc = "";
    if (type === "commit") desc = commitMessages[Math.floor(Math.random() * commitMessages.length)];
    else if (type === "mission") desc = missionDescs[Math.floor(Math.random() * missionDescs.length)];
    else if (type === "dream") desc = "Babelfish nightly introspection cycle";
    else if (type === "worker") desc = ["Arthur", "Trillian", "Mac"][Math.floor(Math.random() * 3)] + " worker dispatched";
    else if (type === "deploy") desc = "Deployed to " + (Math.random() > 0.5 ? "production" : "staging");
    else desc = "Code review " + (Math.random() > 0.5 ? "approved" : "requested changes");

    activityEvents.push({
      time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      project: project.name,
      type,
      description: desc,
      color: project.color,
    });
  }
  activityEvents.sort((a, b) => {
    // newest first (approximate)
    return 0;
  });
}
generateEvents();

// ============================================================================
// STATS HEADER
// ============================================================================

const statsPanel = hud.panel({
  title: "Activity Overview",
  position: { x: 20, y: 15 },
  size: { x: W - 40, y: 90 },
  glass: false,
  titleColor: "#22d3ee",
});

const totalEvents = projects.reduce((s, p) => s + p.events, 0);
const totalCommits = projects.reduce((s, p) => s + p.commits, 0);

const headerMetrics = new MetricDisplay({ columns: 4, valueSize: 22, labelSize: 8 });
headerMetrics.set("Total Events", String(totalEvents), "#22d3ee");
headerMetrics.set("Date Range", "90 days", "#c8d6e5");
headerMetrics.set("Active Projects", String(projects.length), "#51cf66");
headerMetrics.set("Total Commits", String(totalCommits), "#a78bfa");

statsPanel.onContent((ctx, x, y, w, h) => {
  headerMetrics.render(ctx, x, y, w, h);
});

// ============================================================================
// PROJECT CARDS (2 columns)
// ============================================================================

const cardStartY = 115;
const cardGap = 12;
const cols = 2;
const cardW = Math.floor((W - 40 - cardGap) / cols);
const cardH = Math.floor((H * 0.48) / Math.ceil(projects.length / cols));

projects.forEach((p, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const px = 20 + col * (cardW + cardGap);
  const py = cardStartY + row * (cardH + cardGap);

  const panel = hud.panel({
    title: p.name,
    position: { x: px, y: py },
    size: { x: cardW, y: cardH },
    glass: false,
    titleColor: p.color,
  });

  const ts = projectSeries.get(p.name)!;
  const mg = projectWorkflows.get(p.name)!;

  panel.onContent((ctx, x, y, w, h) => {
    // Stats row at top
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "9px system-ui";
    ctx.fillText("EVENTS", x, y + 8);
    ctx.fillText("COMMITS", x + w * 0.33, y + 8);
    ctx.fillText("VELOCITY", x + w * 0.66, y + 8);

    ctx.fillStyle = p.color;
    ctx.font = "bold 14px system-ui";
    ctx.fillText(String(p.events), x, y + 24);
    ctx.fillText(String(p.commits), x + w * 0.33, y + 24);
    ctx.fillText(p.velocity.toFixed(1) + "/d", x + w * 0.66, y + 24);

    // Activity sparkline (90-day)
    const sparkY = y + 34;
    const sparkH = Math.max(20, h * 0.28);
    ts.render(ctx, x, sparkY, w, sparkH);

    // Label for sparkline
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "8px system-ui";
    ctx.fillText("90-DAY ACTIVITY", x, sparkY + sparkH + 10);

    // Mini workflow graph
    const mgY = sparkY + sparkH + 16;
    const mgH = Math.max(30, h - (mgY - y) - 4);
    if (mgH > 20) {
      mg.render(ctx, x, mgY, w, mgH);
    }
  });
});

// ============================================================================
// ACTIVITY STREAM (full width bottom)
// ============================================================================

const streamStartY = cardStartY + Math.ceil(projects.length / cols) * (cardH + cardGap) + 8;
const streamH = H - streamStartY - 20;

const streamPanel = hud.panel({
  title: "Activity Stream",
  position: { x: 20, y: streamStartY },
  size: { x: W - 40, y: streamH },
  glass: false,
  titleColor: "#ffd43b",
});

const streamTable = new Table([
  { key: "time", label: "Time", width: 0.08 },
  { key: "date", label: "Date", width: 0.08 },
  { key: "project", label: "Project", width: 0.12 },
  { key: "type", label: "Type", width: 0.1 },
  { key: "description", label: "Description", width: 0.62 },
]);

streamTable.setData(activityEvents.map(e => ({
  ...e,
  _badge: e.type.toUpperCase(),
  _badgeColor: typeColors[e.type] || "#c8d6e5",
  _color: e.color,
})));

streamPanel.onContent((ctx, x, y, w, h) => {
  streamTable.render(ctx, x, y, w, h);
});

// ============================================================================
// LIVE SIMULATION - add new events periodically
// ============================================================================

function addLiveEvent(): void {
  const project = projects[Math.floor(Math.random() * projects.length)];
  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const now = new Date();

  let desc = "";
  if (type === "commit") desc = commitMessages[Math.floor(Math.random() * commitMessages.length)];
  else if (type === "mission") desc = missionDescs[Math.floor(Math.random() * missionDescs.length)];
  else if (type === "dream") desc = "Babelfish dream cycle completed";
  else if (type === "worker") desc = ["Arthur", "Trillian", "Mac"][Math.floor(Math.random() * 3)] + " worker task complete";
  else if (type === "deploy") desc = "Deployed to " + (Math.random() > 0.5 ? "production" : "staging");
  else desc = "Code review " + (Math.random() > 0.5 ? "approved" : "needs revision");

  const event: ActivityEvent = {
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    project: project.name,
    type,
    description: desc,
    color: project.color,
  };

  activityEvents.unshift(event);
  if (activityEvents.length > 100) activityEvents.length = 100;

  streamTable.setData(activityEvents.map(e => ({
    ...e,
    _badge: e.type.toUpperCase(),
    _badgeColor: typeColors[e.type] || "#c8d6e5",
    _color: e.color,
  })));

  // Update project activity sparkline
  const ts = projectSeries.get(project.name);
  if (ts) {
    ts.push(2 + Math.random() * 8);
  }

  // Randomly advance a workflow stage
  if (Math.random() > 0.7) {
    const stages = ["plan", "code", "review", "deploy"] as const;
    const mg = projectWorkflows.get(project.name);
    if (mg) {
      for (const stage of stages) {
        const node = mg.nodes.find(n => n.id === stage);
        if (node && node.status === "running") {
          node.status = "completed";
          const nextIdx = stages.indexOf(stage) + 1;
          if (nextIdx < stages.length) {
            const nextNode = mg.nodes.find(n => n.id === stages[nextIdx]);
            if (nextNode && nextNode.status === "pending") {
              nextNode.status = "running";
            }
          }
          break;
        }
      }
    }
  }

  // Update header metrics
  project.events++;
  if (type === "commit") project.commits++;
  const newTotal = projects.reduce((s, p) => s + p.events, 0);
  const newCommits = projects.reduce((s, p) => s + p.commits, 0);
  headerMetrics.set("Total Events", String(newTotal), "#22d3ee");
  headerMetrics.set("Total Commits", String(newCommits), "#a78bfa");
}

function scheduleLiveEvent(): void {
  const delay = 3000 + Math.random() * 7000;
  setTimeout(() => {
    addLiveEvent();
    scheduleLiveEvent();
  }, delay);
}
scheduleLiveEvent();

// ============================================================================
// CONSOLE LOG
// ============================================================================

console.log(
  "%c Area42 %c Timeline Demo ",
  "background:#0a0e17;color:#22d3ee;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px",
  "background:#131a2b;color:#c8d6e5;padding:4px 8px;border-radius:0 4px 4px 0",
);
console.log("  Project activity timeline with 90-day sparklines and workflow graphs");
console.log("  " + projects.length + " projects tracked, " + totalEvents + " total events");
console.log("  Live events appear every 3-10 seconds. Drag panels by title bars. Press ? for help.");
