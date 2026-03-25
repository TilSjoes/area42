/**
 * Area42 Demo — AgentSmith-style HUD
 */
import { HUD } from "../core/hud.js";

const hud = new HUD("#hud", { theme: "neon" });

// Router panel
const router = hud.panel({
  title: "Router",
  position: { x: 40, y: 40 },
  size: { x: 350, y: 200 },
  color: "rgba(123, 104, 238, 0.15)",
});
router.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "11px system-ui";
  ctx.fillText("Requests: 82", x, y + 14);
  ctx.fillText("Tokens: 447.1K / 23.5K", x, y + 32);
  ctx.fillStyle = "#51cf66";
  ctx.fillText("Cost: $0.94", x, y + 50);

  // Tier bars
  const tiers = [
    { label: "Simple", pct: 10, color: "#51cf66" },
    { label: "Medium", pct: 55, color: "#ffd43b" },
    { label: "Complex", pct: 34, color: "#ff6b6b" },
  ];
  let barY = y + 70;
  for (const t of tiers) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "9px system-ui";
    ctx.fillText(t.label, x, barY + 10);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x + 55, barY + 2, w - 100, 12);
    ctx.fillStyle = t.color;
    ctx.fillRect(x + 55, barY + 2, (w - 100) * t.pct / 100, 12);
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(t.pct + "%", x + w - 5, barY + 12);
    ctx.textAlign = "left";
    barY += 20;
  }
});

// Spine panel
const spine = hud.panel({
  title: "Spine Classifier",
  position: { x: 420, y: 40 },
  size: { x: 280, y: 150 },
  titleColor: "#f97316",
});
spine.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#c8d6e5";
  ctx.font = "11px system-ui";
  ctx.fillText("Model: Qwen3.5-0.8B (fine-tuned)", x, y + 14);
  ctx.fillText("Classify: 286ms avg", x, y + 32);
  ctx.fillText("Training pairs: 1,528", x, y + 50);
  ctx.fillStyle = "#f97316";
  ctx.font = "bold 24px system-ui";
  ctx.fillText("INDEPENDENT", x, y + 90);
});

// NATS panel
const nats = hud.panel({
  title: "NATS JetStream",
  position: { x: 40, y: 280 },
  size: { x: 300, y: 160 },
  titleColor: "#22d3ee",
});
nats.onContent((ctx, x, y, w, h) => {
  const streams = [
    { name: "ROUTING", msgs: 82, color: "#51cf66" },
    { name: "MISSIONS", msgs: 200, color: "#ffd43b" },
    { name: "FEEDBACK", msgs: 15, color: "#ff6b6b" },
    { name: "DREAMS", msgs: 6, color: "#a78bfa" },
  ];
  let sy = y;
  for (const s of streams) {
    ctx.fillStyle = s.color;
    ctx.font = "bold 10px system-ui";
    ctx.fillText(s.name, x, sy + 12);
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(s.msgs + " msgs", x + w, sy + 12);
    ctx.textAlign = "left";
    // Bar
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, sy + 18, w, 6);
    ctx.fillStyle = s.color + "44";
    ctx.fillRect(x, sy + 18, w * Math.min(s.msgs / 200, 1), 6);
    sy += 32;
  }
});

// Cost panel
const cost = hud.panel({
  title: "Cost Tracker",
  position: { x: 730, y: 40 },
  size: { x: 240, y: 180 },
  titleColor: "#51cf66",
});
cost.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#51cf66";
  ctx.font = "bold 36px system-ui";
  ctx.fillText("$0.94", x, y + 40);
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "11px system-ui";
  ctx.fillText("Total cost (82 requests)", x, y + 60);
  ctx.fillStyle = "#51cf66";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("44% saved", x, y + 95);
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "11px system-ui";
  ctx.fillText("$0.75 vs all-Claude routing", x, y + 115);
  ctx.fillText("8 / 82 local requests", x, y + 135);
});

console.log("Area42 HUD initialized — drag panels by their title bars, double-click to collapse");
