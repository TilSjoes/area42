/**
 * Area42 Swimlane Timeline Demo
 *
 * Full-screen Gantt-style swimlane visualization showing 90 days of
 * simulated DONTPANIC infrastructure activity: git commits, missions,
 * worker tasks, and babelfish dreams.
 *
 * Standalone canvas mode with direct rendering loop.
 */

import { Swimlane } from "../charts/swimlane.js";
import type { SwimlaneGroup, SwimlaneEvent } from "../charts/swimlane.js";
import { NeonTheme } from "../themes/neon.js";

// ============================================================================
// SETUP
// ============================================================================

const container = document.getElementById("hud")!;
container.style.background = NeonTheme.bg;

const canvas = document.createElement("canvas");
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.display = "block";
container.appendChild(canvas);

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
}
resize();
window.addEventListener("resize", resize);

const ctx = canvas.getContext("2d")!;

// ============================================================================
// DATA GENERATION — 90 days of simulated activity
// ============================================================================

const NOW = Date.now();
const DAY = 86400000;
const HOUR = 3600000;
const ORIGIN = NOW - 90 * DAY;

// Deterministic-ish seeded random
let seed = 42;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Generate commit dots clustered on weekdays with burst patterns */
function genCommits(projectColor: string, density: number): SwimlaneEvent[] {
  const events: SwimlaneEvent[] = [];
  for (let day = 0; day < 90; day++) {
    const date = new Date(ORIGIN + day * DAY);
    const dow = date.getDay();
    // Skip most weekends
    if ((dow === 0 || dow === 6) && rand() > 0.15) continue;

    // Burst periods: ~20% of weekdays have 3-8 commits
    const isBurst = rand() < 0.18;
    const commitCount = isBurst ? randInt(3, 8) : (rand() < density ? randInt(1, 3) : 0);

    for (let c = 0; c < commitCount; c++) {
      const hour = randInt(8, 22);
      const minute = randInt(0, 59);
      events.push({
        start: ORIGIN + day * DAY + hour * HOUR + minute * 60000,
        shape: "dot",
        color: projectColor,
      });
    }
  }
  return events;
}

/** Generate mission rectangles spanning minutes to hours */
function genMissions(projectColor: string, count: number): SwimlaneEvent[] {
  const events: SwimlaneEvent[] = [];
  const missionNames = [
    "Phoenix Build", "Security Audit", "Perf Optimization", "Feature Sprint",
    "Bug Triage", "Refactor Core", "Deploy Pipeline", "Data Migration",
    "API Redesign", "Test Coverage", "Doc Update", "Infra Scaling",
  ];
  for (let i = 0; i < count; i++) {
    const day = randInt(0, 89);
    const hour = randInt(9, 18);
    const durationMin = randInt(15, 240);
    const start = ORIGIN + day * DAY + hour * HOUR;
    events.push({
      start,
      end: start + durationMin * 60000,
      label: missionNames[randInt(0, missionNames.length - 1)],
      shape: "rect",
      color: projectColor,
      data: { type: "mission", id: "M-" + randInt(1000, 9999) },
    });
  }
  return events;
}

/** Generate worker task blocks during mission execution */
function genWorkerTasks(color: string, count: number): SwimlaneEvent[] {
  const events: SwimlaneEvent[] = [];
  const taskTypes = [
    "code-review", "build", "test-run", "deploy", "lint", "format",
    "research", "plan", "investigate", "benchmark",
  ];
  for (let i = 0; i < count; i++) {
    const day = randInt(0, 89);
    const hour = randInt(8, 22);
    const durationMin = randInt(5, 90);
    const start = ORIGIN + day * DAY + hour * HOUR;
    events.push({
      start,
      end: start + durationMin * 60000,
      label: taskTypes[randInt(0, taskTypes.length - 1)],
      shape: "rect",
      color,
      data: { type: "worker-task" },
    });
  }
  return events;
}

/** Generate nightly dream diamonds at ~03:00 */
function genDreams(color: string): SwimlaneEvent[] {
  const events: SwimlaneEvent[] = [];
  for (let day = 0; day < 90; day++) {
    // Dreams happen most nights but not all
    if (rand() < 0.15) continue;
    const minuteJitter = randInt(-30, 30);
    events.push({
      start: ORIGIN + day * DAY + 3 * HOUR + minuteJitter * 60000,
      shape: "diamond",
      color,
      label: "dream",
      data: { type: "dream", day },
    });
  }
  return events;
}

// ============================================================================
// BUILD GROUPS
// ============================================================================

const groups: SwimlaneGroup[] = [
  {
    id: "git",
    label: "GIT",
    color: "#51cf66",
    lanes: [
      { id: "git-agentsmith", label: "agentsmith", events: genCommits("#f97316", 0.7) },
      { id: "git-marvin", label: "marvin", events: genCommits("#a78bfa", 0.6) },
      { id: "git-area42", label: "area42", events: genCommits("#22d3ee", 0.5) },
      { id: "git-suits", label: "suits", events: genCommits("#51cf66", 0.4) },
      { id: "git-boringbank", label: "BoringBank", events: genCommits("#4dabf7", 0.65) },
      { id: "git-voice", label: "voice-pipeline", events: genCommits("#ff6b6b", 0.3) },
      { id: "git-vale", label: "vale", events: genCommits("#ffd43b", 0.35) },
    ],
  },
  {
    id: "missions",
    label: "MISSIONS",
    color: "#4dabf7",
    lanes: [
      { id: "mission-agentsmith", label: "agentsmith", events: genMissions("#f97316", 25) },
      { id: "mission-marvin", label: "marvin", events: genMissions("#a78bfa", 18) },
      { id: "mission-boringbank", label: "BoringBank", events: genMissions("#4dabf7", 22) },
      { id: "mission-suits", label: "suits", events: genMissions("#51cf66", 12) },
    ],
  },
  {
    id: "workers",
    label: "WORKERS",
    color: "#f97316",
    lanes: [
      { id: "worker-arthur", label: "arthur", events: genWorkerTasks("#f97316", 45) },
      { id: "worker-trillian", label: "trillian", events: genWorkerTasks("#4dabf7", 35) },
      { id: "worker-ants", label: "ants", events: genWorkerTasks("#22d3ee", 20) },
    ],
  },
  {
    id: "infra",
    label: "INFRA",
    color: "#a78bfa",
    lanes: [
      { id: "infra-babelfish", label: "babelfish", events: genDreams("#a78bfa") },
    ],
  },
];

// ============================================================================
// SWIMLANE INSTANCE
// ============================================================================

const swimlane = new Swimlane({
  laneHeight: 24,
  labelWidth: 120,
  minimapHeight: 40,
  timeAxisHeight: 30,
});

swimlane.setData(groups);
// Start with last 14 days in view
swimlane.setViewRange(NOW - 14 * DAY, NOW + 1 * DAY);

// Attach interaction handlers
swimlane.attach(canvas, (hit) => {
  console.log("Event clicked:", hit.group.label, "/", hit.lane.label, hit.event);
});

// ============================================================================
// TITLE OVERLAY
// ============================================================================

function renderTitle(ctx: CanvasRenderingContext2D, w: number): void {
  // Subtle title in top-left corner of the label area
  ctx.save();
  ctx.fillStyle = NeonTheme.textDim;
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("TEMPUSFUGIT", 8, 8);
  ctx.fillStyle = "#3d4f63";
  ctx.font = "8px system-ui";
  ctx.fillText("90-day swimlane", 8, 22);
  ctx.restore();
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    swimlane.fit(canvas.width);
  }
  if (e.key === "t" || e.key === "T") {
    // Jump to today
    swimlane.setViewRange(NOW - 2 * DAY, NOW + 0.5 * DAY);
  }
  if (e.key === "w" || e.key === "W") {
    // Last week
    swimlane.setViewRange(NOW - 7 * DAY, NOW + 0.5 * DAY);
  }
});

// ============================================================================
// RENDER LOOP
// ============================================================================

function frame(): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = window.innerWidth;
  const h = window.innerHeight;

  swimlane.render(ctx, 0, 0, w, h);
  renderTitle(ctx, w);

  // Help text bottom-right
  ctx.save();
  ctx.fillStyle = "#3d4f63";
  ctx.font = "9px system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("Scroll: zoom | Drag: pan | F: fit all | T: today | W: week", w - 12, h - 44);
  ctx.restore();

  requestAnimationFrame(frame);
}

frame();

// ============================================================================
// CONSOLE
// ============================================================================

let totalEvents = 0;
for (const g of groups) for (const l of g.lanes) totalEvents += l.events.length;

console.log(
  "%c Area42 %c Swimlane Timeline ",
  "background:#0a0e17;color:#22d3ee;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px",
  "background:#131a2b;color:#c8d6e5;padding:4px 8px;border-radius:0 4px 4px 0",
);
console.log("  " + groups.length + " groups, " + totalEvents + " events across 90 days");
console.log("  Scroll to zoom, drag to pan, click events for details");
console.log("  Keys: F=fit all, T=today, W=last week");
