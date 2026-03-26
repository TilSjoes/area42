/**
 * Area42 Forest Demo
 *
 * Three showcase views demonstrating the Forest 2.5D perspective:
 *   1. IAM Forest — Users, Roles, Resources with cross-links
 *   2. Consent Forest — GDPR Subjects, Purposes, Data
 *   3. AML Forest — BoringBank Customers, Products, Transactions
 *
 * Arrow keys and swipe to navigate trees, click to focus, toggle nodes.
 */

import { HUD } from "../core/hud.js";
import { Forest } from "../graph/forest.js";
import type { ForestTree, ForestLink } from "../graph/forest.js";
import type { TreeNodeData } from "../graph/tree.js";
import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";
import { ToastManager } from "../panels/toast.js";

// ============================================================================
// HUD Setup
// ============================================================================

const hud = new HUD("#hud", { theme: "neon", background: true });
const W = hud.renderer.width;
const H = hud.renderer.height;
const toast = new ToastManager();

// ============================================================================
// View Data: IAM Forest
// ============================================================================

function createIAMForest(): { trees: ForestTree[]; links: ForestLink[] } {
  const users: TreeNodeData = {
    id: "users-root",
    label: "Users",
    color: "#00d4aa",
    children: [
      {
        id: "admin-group",
        label: "Admin Group",
        color: "#00d4aa",
        children: [
          { id: "user-ford", label: "Ford Prefect", color: "#51cf66" },
          { id: "user-arthur", label: "Arthur Dent", color: "#51cf66" },
          { id: "user-trillian", label: "Trillian", color: "#51cf66" },
        ],
      },
      {
        id: "dev-group",
        label: "Dev Group",
        color: "#00d4aa",
        children: [
          { id: "user-zaphod", label: "Zaphod", color: "#51cf66" },
          { id: "user-marvin", label: "Marvin", color: "#51cf66" },
        ],
      },
      {
        id: "audit-group",
        label: "Audit Group",
        color: "#00d4aa",
        children: [
          { id: "user-slartibartfast", label: "Slartibartfast", color: "#51cf66" },
        ],
      },
    ],
  };

  const roles: TreeNodeData = {
    id: "roles-root",
    label: "Roles",
    color: "#7b68ee",
    children: [
      {
        id: "role-devops",
        label: "DevOps",
        color: "#7b68ee",
        children: [
          { id: "perm-deploy", label: "deploy", color: "#9775fa" },
          { id: "perm-monitor", label: "monitor", color: "#9775fa" },
          { id: "perm-configure", label: "configure", color: "#9775fa" },
        ],
      },
      {
        id: "role-sysadmin",
        label: "System Admin",
        color: "#7b68ee",
        children: [
          { id: "perm-root", label: "root-access", color: "#9775fa" },
          { id: "perm-network", label: "network", color: "#9775fa" },
        ],
      },
      {
        id: "role-auditor",
        label: "Auditor",
        color: "#7b68ee",
        children: [
          { id: "perm-read-logs", label: "read-logs", color: "#9775fa" },
          { id: "perm-compliance", label: "compliance", color: "#9775fa" },
        ],
      },
    ],
  };

  const resources: TreeNodeData = {
    id: "resources-root",
    label: "Resources",
    color: "#f97316",
    children: [
      {
        id: "sys-arthur",
        label: "Arthur (VM)",
        color: "#f97316",
        children: [
          { id: "ep-missions", label: "/api/missions", color: "#fb923c" },
          { id: "ep-brain", label: "/api/brain", color: "#fb923c" },
          { id: "ep-dream", label: "/api/dream", color: "#fb923c" },
        ],
      },
      {
        id: "sys-morpheus",
        label: "Morpheus (GPU)",
        color: "#f97316",
        children: [
          { id: "ep-ollama", label: "/api/generate", color: "#fb923c" },
          { id: "ep-comfyui", label: ":8188/ws", color: "#fb923c" },
        ],
      },
      {
        id: "sys-trillian",
        label: "Trillian (Dev)",
        color: "#f97316",
        children: [
          { id: "ep-ssh", label: "SSH :22", color: "#fb923c" },
        ],
      },
    ],
  };

  const trees: ForestTree[] = [
    { id: "iam-users", label: "USERS", color: "#00d4aa", root: users },
    { id: "iam-roles", label: "ROLES", color: "#7b68ee", root: roles },
    { id: "iam-resources", label: "RESOURCES", color: "#f97316", root: resources },
  ];

  const links: ForestLink[] = [
    { fromTree: "iam-users", fromNode: "user-ford", toTree: "iam-roles", toNode: "role-devops", label: "assigned", color: "#4dabf7", style: "dashed" },
    { fromTree: "iam-users", fromNode: "user-arthur", toTree: "iam-roles", toNode: "role-sysadmin", label: "assigned", color: "#4dabf7", style: "dashed" },
    { fromTree: "iam-users", fromNode: "user-slartibartfast", toTree: "iam-roles", toNode: "role-auditor", label: "assigned", color: "#4dabf7", style: "dashed" },
    { fromTree: "iam-roles", fromNode: "perm-deploy", toTree: "iam-resources", toNode: "ep-missions", label: "grants", color: "#ffd43b", style: "dotted" },
    { fromTree: "iam-roles", fromNode: "perm-monitor", toTree: "iam-resources", toNode: "ep-brain", label: "grants", color: "#ffd43b", style: "dotted" },
    { fromTree: "iam-roles", fromNode: "perm-root", toTree: "iam-resources", toNode: "sys-arthur", label: "full access", color: "#ff6b6b", style: "solid" },
  ];

  return { trees, links };
}

// ============================================================================
// View Data: Consent Forest (GDPR)
// ============================================================================

function createConsentForest(): { trees: ForestTree[]; links: ForestLink[] } {
  const subjects: TreeNodeData = {
    id: "subjects-root",
    label: "Data Subjects",
    color: "#22d3ee",
    children: [
      {
        id: "cat-employees",
        label: "Employees",
        color: "#22d3ee",
        children: [
          { id: "subj-ole", label: "Ole Nordmann", color: "#67e8f9" },
          { id: "subj-kari", label: "Kari Hansen", color: "#67e8f9" },
        ],
      },
      {
        id: "cat-customers",
        label: "Customers",
        color: "#22d3ee",
        children: [
          { id: "subj-nils", label: "Nils Berg", color: "#67e8f9" },
          { id: "subj-ingrid", label: "Ingrid Vik", color: "#67e8f9" },
          { id: "subj-per", label: "Per Olsen", color: "#67e8f9" },
        ],
      },
    ],
  };

  const purposes: TreeNodeData = {
    id: "purposes-root",
    label: "Purposes",
    color: "#a78bfa",
    children: [
      {
        id: "purp-service",
        label: "Service Delivery",
        color: "#a78bfa",
        children: [
          { id: "basis-contract", label: "Art.6(1)(b) Contract", color: "#c4b5fd" },
        ],
      },
      {
        id: "purp-marketing",
        label: "Marketing",
        color: "#a78bfa",
        children: [
          { id: "basis-consent", label: "Art.6(1)(a) Consent", color: "#c4b5fd" },
        ],
      },
      {
        id: "purp-compliance",
        label: "AML Compliance",
        color: "#a78bfa",
        children: [
          { id: "basis-legal", label: "Art.6(1)(c) Legal", color: "#c4b5fd" },
        ],
      },
      {
        id: "purp-analytics",
        label: "Analytics",
        color: "#a78bfa",
        children: [
          { id: "basis-interest", label: "Art.6(1)(f) Interest", color: "#c4b5fd" },
        ],
      },
    ],
  };

  const dataTypes: TreeNodeData = {
    id: "data-root",
    label: "Data Types",
    color: "#fb7185",
    children: [
      {
        id: "dtype-personal",
        label: "Personal Data",
        color: "#fb7185",
        children: [
          { id: "store-pg", label: "PostgreSQL", color: "#fda4af" },
          { id: "store-s3", label: "S3 Backup", color: "#fda4af" },
        ],
      },
      {
        id: "dtype-financial",
        label: "Financial Data",
        color: "#fb7185",
        children: [
          { id: "store-ledger", label: "Core Ledger", color: "#fda4af" },
        ],
      },
      {
        id: "dtype-behavioral",
        label: "Behavioral Data",
        color: "#fb7185",
        children: [
          { id: "store-analytics", label: "Analytics DB", color: "#fda4af" },
          { id: "store-logs", label: "Log Archive", color: "#fda4af" },
        ],
      },
    ],
  };

  const trees: ForestTree[] = [
    { id: "gdpr-subjects", label: "SUBJECTS", color: "#22d3ee", root: subjects },
    { id: "gdpr-purposes", label: "PURPOSES", color: "#a78bfa", root: purposes },
    { id: "gdpr-data", label: "DATA", color: "#fb7185", root: dataTypes },
  ];

  const links: ForestLink[] = [
    { fromTree: "gdpr-subjects", fromNode: "subj-nils", toTree: "gdpr-purposes", toNode: "purp-service", label: "consent", color: "#22d3ee", style: "dashed" },
    { fromTree: "gdpr-subjects", fromNode: "subj-ingrid", toTree: "gdpr-purposes", toNode: "purp-marketing", label: "opted-in", color: "#22d3ee", style: "dashed" },
    { fromTree: "gdpr-subjects", fromNode: "subj-ole", toTree: "gdpr-purposes", toNode: "purp-compliance", label: "mandatory", color: "#ffd43b", style: "solid" },
    { fromTree: "gdpr-purposes", fromNode: "purp-service", toTree: "gdpr-data", toNode: "dtype-personal", label: "processes", color: "#a78bfa", style: "dotted" },
    { fromTree: "gdpr-purposes", fromNode: "purp-analytics", toTree: "gdpr-data", toNode: "dtype-behavioral", label: "collects", color: "#a78bfa", style: "dotted" },
    { fromTree: "gdpr-purposes", fromNode: "purp-compliance", toTree: "gdpr-data", toNode: "dtype-financial", label: "requires", color: "#ff6b6b", style: "solid" },
  ];

  return { trees, links };
}

// ============================================================================
// View Data: AML Forest (BoringBank)
// ============================================================================

function createAMLForest(): { trees: ForestTree[]; links: ForestLink[] } {
  const customers: TreeNodeData = {
    id: "cust-root",
    label: "Customers",
    color: "#00d4aa",
    children: [
      {
        id: "seg-retail",
        label: "Retail",
        color: "#00d4aa",
        children: [
          { id: "cust-nordmann", label: "Ole Nordmann", color: "#51cf66" },
          { id: "cust-hansen", label: "Kari Hansen", color: "#51cf66" },
          { id: "cust-berg", label: "Nils Berg", color: "#ffd43b" },
        ],
      },
      {
        id: "seg-corporate",
        label: "Corporate",
        color: "#00d4aa",
        children: [
          { id: "cust-acme", label: "ACME Holding AS", color: "#ff6b6b" },
          { id: "cust-fjord", label: "Fjord Tech AS", color: "#51cf66" },
        ],
      },
    ],
  };

  const products: TreeNodeData = {
    id: "prod-root",
    label: "Products",
    color: "#4dabf7",
    children: [
      {
        id: "ptype-savings",
        label: "Savings",
        color: "#4dabf7",
        children: [
          { id: "acct-savings-1", label: "1234.56.78901", color: "#74c0fc" },
          { id: "acct-savings-2", label: "1234.56.78902", color: "#74c0fc" },
        ],
      },
      {
        id: "ptype-checking",
        label: "Checking",
        color: "#4dabf7",
        children: [
          { id: "acct-check-1", label: "9876.54.32101", color: "#74c0fc" },
          { id: "acct-check-2", label: "9876.54.32102", color: "#ffd43b" },
        ],
      },
      {
        id: "ptype-business",
        label: "Business",
        color: "#4dabf7",
        children: [
          { id: "acct-biz-1", label: "5555.00.10001", color: "#ff6b6b" },
        ],
      },
    ],
  };

  const transactions: TreeNodeData = {
    id: "txn-root",
    label: "Transactions",
    color: "#f97316",
    children: [
      {
        id: "txn-normal",
        label: "Normal",
        color: "#51cf66",
        children: [
          { id: "txn-001", label: "NOK 1,200", color: "#51cf66" },
          { id: "txn-002", label: "NOK 8,500", color: "#51cf66" },
          { id: "txn-003", label: "NOK 450", color: "#51cf66" },
        ],
      },
      {
        id: "txn-suspicious",
        label: "Suspicious",
        color: "#ffd43b",
        children: [
          { id: "txn-flag-1", label: "NOK 149,999", color: "#ffd43b" },
          { id: "txn-flag-2", label: "EUR 49,800", color: "#ffd43b" },
        ],
      },
      {
        id: "txn-blocked",
        label: "Blocked",
        color: "#ff6b6b",
        children: [
          { id: "txn-block-1", label: "USD 250,000", color: "#ff6b6b" },
        ],
      },
    ],
  };

  const trees: ForestTree[] = [
    { id: "aml-customers", label: "CUSTOMERS", color: "#00d4aa", root: customers },
    { id: "aml-products", label: "PRODUCTS", color: "#4dabf7", root: products },
    { id: "aml-transactions", label: "TRANSACTIONS", color: "#f97316", root: transactions },
  ];

  const links: ForestLink[] = [
    { fromTree: "aml-customers", fromNode: "cust-nordmann", toTree: "aml-products", toNode: "acct-savings-1", label: "owns", color: "#4dabf7", style: "dashed" },
    { fromTree: "aml-customers", fromNode: "cust-hansen", toTree: "aml-products", toNode: "acct-check-1", label: "owns", color: "#4dabf7", style: "dashed" },
    { fromTree: "aml-customers", fromNode: "cust-acme", toTree: "aml-products", toNode: "acct-biz-1", label: "owns", color: "#ff6b6b", style: "solid" },
    { fromTree: "aml-products", fromNode: "acct-check-2", toTree: "aml-transactions", toNode: "txn-flag-1", label: "flagged", color: "#ffd43b", style: "dashed" },
    { fromTree: "aml-products", fromNode: "acct-biz-1", toTree: "aml-transactions", toNode: "txn-block-1", label: "BLOCKED", color: "#ff6b6b", style: "solid" },
    { fromTree: "aml-products", fromNode: "acct-savings-1", toTree: "aml-transactions", toNode: "txn-001", label: "normal", color: "#51cf66", style: "dotted" },
  ];

  return { trees, links };
}

// ============================================================================
// View Management
// ============================================================================

type ViewName = "iam" | "consent" | "aml";

let currentView: ViewName = "iam";
let forest: Forest;

function buildForest(view: ViewName): Forest {
  const f = new Forest({
    direction: "perspective",
    canvasWidth: W,
    canvasHeight: H,
    perspective: {
      vanishingPointY: 0.22,
      depthScale: 0.68,
      depthFade: 0.2,
      horizontalSpread: 35,
    },
  });

  let data: { trees: ForestTree[]; links: ForestLink[] };
  if (view === "iam") data = createIAMForest();
  else if (view === "consent") data = createConsentForest();
  else data = createAMLForest();

  for (const tree of data.trees) f.addTree(tree);
  for (const link of data.links) f.addLink(link);

  return f;
}

forest = buildForest(currentView);

function switchView(view: ViewName): void {
  if (view === currentView) return;
  currentView = view;
  forest = buildForest(view);

  // Update button states
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.view === view);
  });

  const labels: Record<ViewName, string> = {
    iam: "IAM Forest",
    consent: "Consent Forest (GDPR)",
    aml: "BoringBank AML",
  };
  toast.show({ message: labels[view], type: "info", duration: 2000 });
}

// ============================================================================
// HUD Title & Navigation Info
// ============================================================================

function renderHUDOverlay(ctx: CanvasRenderingContext2D): void {
  // Title
  ctx.save();
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const titles: Record<ViewName, string> = {
    iam: "IAM FOREST",
    consent: "CONSENT FOREST",
    aml: "AML FOREST",
  };
  const colors: Record<ViewName, string> = {
    iam: "#00d4aa",
    consent: "#22d3ee",
    aml: "#f97316",
  };
  const subtitles: Record<ViewName, string> = {
    iam: "Users / Roles / Resources — Identity & Access Management",
    consent: "Subjects / Purposes / Data — GDPR Consent Mapping",
    aml: "Customers / Products / Transactions — Anti-Money Laundering",
  };

  const color = colors[currentView];

  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(titles[currentView], 24, 20);

  ctx.shadowBlur = 0;
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = NeonTheme.textDim;
  ctx.fillText(subtitles[currentView], 24, 44);

  // Navigation hint (bottom)
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = withAlpha(NeonTheme.text, "55");
  ctx.font = "10px system-ui, -apple-system, sans-serif";

  const focused = forest.focusedTree;
  const label = focused ? focused.label : "";
  ctx.fillText(
    `${label}  |  \u2190 \u2192 navigate trees  |  click node to expand/collapse  |  click back tree to focus`,
    W / 2, H - 14
  );

  // Tree position indicator (dots)
  const dotY = H - 36;
  const dotSpacing = 14;
  const totalDots = forest.trees.length;
  const startX = W / 2 - ((totalDots - 1) * dotSpacing) / 2;
  for (let i = 0; i < totalDots; i++) {
    const isFocused = i === forest.focusIndex;
    ctx.beginPath();
    ctx.arc(startX + i * dotSpacing, dotY, isFocused ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isFocused ? color : withAlpha(color, "44");
    ctx.fill();
    if (isFocused) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(startX + i * dotSpacing, dotY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

// ============================================================================
// Render Loop
// ============================================================================

hud.renderer.onRender((rc) => {
  forest.update(rc.deltaTime);
  forest.render(rc.ctx);
  renderHUDOverlay(rc.ctx);
  toast.render(rc.ctx, rc.width, rc.height);
});

hud.renderer.start();

// ============================================================================
// Input Handling
// ============================================================================

// Keyboard
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    forest.nextTree();
  } else if (e.key === "ArrowLeft") {
    forest.prevTree();
  } else if (e.key === "1") {
    switchView("iam");
  } else if (e.key === "2") {
    switchView("consent");
  } else if (e.key === "3") {
    switchView("aml");
  }
});

// Mouse click
const canvas = document.querySelector("canvas");
if (canvas) {
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = forest.findAt(x, y);
    if (hit) {
      // If clicking a node in a non-focused tree, focus that tree first
      const focusedTreeId = forest.focusedTree?.id;
      if (hit.tree.id !== focusedTreeId) {
        forest.focusTree(hit.tree.id);
        toast.show({ message: `Focused: ${hit.tree.label}`, type: "info", duration: 1500 });
      } else {
        // Toggle collapse on front tree
        forest.toggleNode(hit.node.id);
      }
    }
  });

  // Touch: swipe
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      forest.handleTouchStart(e.touches[0].clientX);
    }
  });

  canvas.addEventListener("touchend", (e) => {
    if (e.changedTouches.length === 1) {
      forest.handleTouchEnd(e.changedTouches[0].clientX);
    }
  });
}

// ============================================================================
// View toggle buttons (injected into DOM)
// ============================================================================

const btnContainer = document.createElement("div");
btnContainer.style.cssText = "position:fixed;top:16px;right:16px;display:flex;gap:6px;z-index:100;";

const views: { key: ViewName; label: string; color: string }[] = [
  { key: "iam", label: "IAM", color: "#00d4aa" },
  { key: "consent", label: "GDPR", color: "#22d3ee" },
  { key: "aml", label: "AML", color: "#f97316" },
];

for (const v of views) {
  const btn = document.createElement("button");
  btn.className = "view-btn" + (v.key === currentView ? " active" : "");
  btn.dataset.view = v.key;
  btn.textContent = v.label;
  btn.style.cssText = `
    background: rgba(19,26,43,0.85);
    border: 1px solid rgba(30,45,74,0.6);
    color: ${v.color};
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    cursor: pointer;
    text-transform: uppercase;
    font-family: system-ui, -apple-system, sans-serif;
    transition: all 0.2s ease;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.borderColor = v.color;
    btn.style.boxShadow = `0 0 12px ${v.color}33`;
  });
  btn.addEventListener("mouseleave", () => {
    if (!btn.classList.contains("active")) {
      btn.style.borderColor = "rgba(30,45,74,0.6)";
      btn.style.boxShadow = "none";
    }
  });
  btn.addEventListener("click", () => switchView(v.key));
  btnContainer.appendChild(btn);
}

document.body.appendChild(btnContainer);

// Style active button
const style = document.createElement("style");
style.textContent = `
  .view-btn.active {
    border-color: currentColor !important;
    box-shadow: 0 0 12px currentColor !important;
    background: rgba(19,26,43,0.95) !important;
  }
`;
document.head.appendChild(style);

toast.show({ message: "Forest View \u2014 Arrow keys to navigate, 1/2/3 to switch views", type: "info", duration: 3500 });
