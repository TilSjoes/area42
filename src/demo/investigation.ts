/**
 * Area42 Investigation Demo
 *
 * A BoringBank-style investigation interface — drill-down through
 * entities and relationships. Full universe mode with space background.
 *
 * Showcases: Graph (expand/collapse), DetailPanel, ContextMenu,
 * click/double-click/shift-click/right-click interactions, Table inside
 * detail panels, and Norwegian financial data.
 */
import { HUD } from "../core/hud.js";
import { Graph } from "../graph/graph.js";
import type { GraphNode as GN, GraphNodeOptions, GraphEdgeOptions } from "../graph/graph.js";
import { DetailPanel } from "../panels/detail.js";
import type { NodeDetail } from "../panels/detail.js";
import { Table } from "../panels/table.js";
import { MetricDisplay } from "../panels/metric.js";
import { MiniGraph } from "../panels/minigraph.js";
import { withAlpha } from "../core/color.js";
import { Breadcrumb } from "../panels/breadcrumb.js";
import { Tree } from "../graph/tree.js";
import type { TreeNodeData } from "../graph/tree.js";
import type { BreadcrumbItem } from "../panels/breadcrumb.js";

// --- Universe mode: full space background ---
const hud = new HUD("#hud", {
  theme: "neon",
  background: true,
});

const W = hud.renderer.width;
const H = hud.renderer.height;

// ============================================================================
// NORWEGIAN FINANCIAL DATA
// ============================================================================

interface Customer {
  id: string;
  name: string;
  orgNr: string;
  riskScore: number;
  amlStatus: string;
  sector: string;
  color: string;
}

interface Account {
  id: string;
  customerId: string;
  type: string;
  number: string;
  balance: number;
  currency: string;
  opened: string;
  status: string;
}

interface Transaction {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  currency: string;
  date: string;
  counterparty: string;
  status: string;
  amlFlags: string[];
}

const customers: Customer[] = [
  { id: "cust-1", name: "Olsen AS", orgNr: "987 654 321", riskScore: 23, amlStatus: "CLEARED", sector: "Teknologi", color: "#4dabf7" },
  { id: "cust-2", name: "Bergen Shipping", orgNr: "912 345 678", riskScore: 67, amlStatus: "REVIEW", sector: "Sjofart", color: "#ffd43b" },
  { id: "cust-3", name: "Nordic Trust", orgNr: "876 543 210", riskScore: 82, amlStatus: "FLAGGED", sector: "Finans", color: "#ff6b6b" },
  { id: "cust-4", name: "Fjord Energi", orgNr: "945 678 123", riskScore: 12, amlStatus: "CLEARED", sector: "Energi", color: "#51cf66" },
];

const accounts: Account[] = [
  // Olsen AS
  { id: "acc-1a", customerId: "cust-1", type: "Driftskonto", number: "1234.56.78901", balance: 2450000, currency: "NOK", opened: "2019-03-15", status: "Aktiv" },
  { id: "acc-1b", customerId: "cust-1", type: "Sparekonto", number: "1234.56.78902", balance: 8900000, currency: "NOK", opened: "2019-03-15", status: "Aktiv" },
  // Bergen Shipping
  { id: "acc-2a", customerId: "cust-2", type: "Driftskonto", number: "5678.12.34567", balance: 15600000, currency: "NOK", opened: "2017-08-22", status: "Aktiv" },
  { id: "acc-2b", customerId: "cust-2", type: "Valutakonto", number: "5678.12.34568", balance: 890000, currency: "USD", opened: "2018-01-10", status: "Aktiv" },
  { id: "acc-2c", customerId: "cust-2", type: "Driftskonto", number: "5678.12.34569", balance: 4200000, currency: "EUR", opened: "2020-06-01", status: "Aktiv" },
  // Nordic Trust
  { id: "acc-3a", customerId: "cust-3", type: "Driftskonto", number: "9012.34.56789", balance: 42800000, currency: "NOK", opened: "2015-11-30", status: "Under gransking" },
  { id: "acc-3b", customerId: "cust-3", type: "Investeringskonto", number: "9012.34.56790", balance: 125000000, currency: "NOK", opened: "2016-02-14", status: "Aktiv" },
  // Fjord Energi
  { id: "acc-4a", customerId: "cust-4", type: "Driftskonto", number: "3456.78.90123", balance: 7800000, currency: "NOK", opened: "2021-01-05", status: "Aktiv" },
  { id: "acc-4b", customerId: "cust-4", type: "Sparekonto", number: "3456.78.90124", balance: 3200000, currency: "NOK", opened: "2021-01-05", status: "Aktiv" },
];

const transactions: Transaction[] = [
  // Olsen AS transactions
  { id: "tx-101", accountId: "acc-1a", type: "Betaling", amount: -145000, currency: "NOK", date: "2026-03-25", counterparty: "Leverandor AS", status: "cleared", amlFlags: [] },
  { id: "tx-102", accountId: "acc-1a", type: "Innskudd", amount: 890000, currency: "NOK", date: "2026-03-24", counterparty: "Kunde Beta AS", status: "cleared", amlFlags: [] },
  { id: "tx-103", accountId: "acc-1b", type: "Overforing", amount: -500000, currency: "NOK", date: "2026-03-23", counterparty: "Olsen AS Drift", status: "cleared", amlFlags: [] },
  // Bergen Shipping transactions (some suspicious)
  { id: "tx-201", accountId: "acc-2a", type: "Overforing", amount: -8500000, currency: "NOK", date: "2026-03-25", counterparty: "Cayman Holdings Ltd", status: "review", amlFlags: ["Hoy verdi", "Ukjent mottaker", "Skatteparadis"] },
  { id: "tx-202", accountId: "acc-2a", type: "Innskudd", amount: 12000000, currency: "NOK", date: "2026-03-24", counterparty: "Maritime Global Corp", status: "review", amlFlags: ["Struktur-mistanke"] },
  { id: "tx-203", accountId: "acc-2b", type: "Valutaveksling", amount: -250000, currency: "USD", date: "2026-03-23", counterparty: "Singapore Trade Bank", status: "cleared", amlFlags: [] },
  { id: "tx-204", accountId: "acc-2c", type: "Betaling", amount: -1800000, currency: "EUR", date: "2026-03-22", counterparty: "Rotterdam Docks BV", status: "cleared", amlFlags: [] },
  // Nordic Trust transactions (flagged)
  { id: "tx-301", accountId: "acc-3a", type: "Overforing", amount: -25000000, currency: "NOK", date: "2026-03-25", counterparty: "Liechtenstein Vermogen AG", status: "flagged", amlFlags: ["Hoy verdi", "Skatteparadis", "PEP-tilknytning"] },
  { id: "tx-302", accountId: "acc-3a", type: "Innskudd", amount: 30000000, currency: "NOK", date: "2026-03-24", counterparty: "Ukjent kilde", status: "flagged", amlFlags: ["Ukjent opprinnelse", "Strukturert innskudd"] },
  { id: "tx-303", accountId: "acc-3b", type: "Overforing", amount: -15000000, currency: "NOK", date: "2026-03-23", counterparty: "Dubai Investment Fund", status: "flagged", amlFlags: ["Hoy verdi", "Hoyrisikoland"] },
  { id: "tx-304", accountId: "acc-3b", type: "Uttak", amount: -9900000, currency: "NOK", date: "2026-03-22", counterparty: "Kontant", status: "flagged", amlFlags: ["Under grense", "Kontantuttak"] },
  // Fjord Energi transactions (clean)
  { id: "tx-401", accountId: "acc-4a", type: "Betaling", amount: -320000, currency: "NOK", date: "2026-03-25", counterparty: "Statnett SF", status: "cleared", amlFlags: [] },
  { id: "tx-402", accountId: "acc-4a", type: "Innskudd", amount: 1250000, currency: "NOK", date: "2026-03-24", counterparty: "Statkraft AS", status: "cleared", amlFlags: [] },
];

function formatNOK(amount: number): string {
  const abs = Math.abs(amount);
  const prefix = amount < 0 ? "-" : "";
  if (abs >= 1000000) return prefix + (abs / 1000000).toFixed(1) + "M";
  if (abs >= 1000) return prefix + (abs / 1000).toFixed(0) + "k";
  return prefix + String(abs);
}

// ============================================================================
// GRAPH SETUP
// ============================================================================

const graph = new Graph({ id: "investigation", size: { x: W, y: H } });

// Add customer nodes (large hexagons)
customers.forEach((c, i) => {
  const angle = (i / customers.length) * Math.PI * 2 - Math.PI / 2;
  const radius = 200;
  const n = graph.addNode({
    id: c.id,
    label: c.name,
    position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
    color: c.color,
    shape: "hexagon",
    size: 30,
    data: c,
  });
  n.pinned = false;
});

// Register dynamic expand callback for drill-down
graph.onExpand((nodeId: string, node: GN) => {
  // Update breadcrumb trail on expand
  if (typeof updateBreadcrumb === 'function') updateBreadcrumb(nodeId);

  // Customer -> show accounts
  if (nodeId.startsWith("cust-")) {
    const custAccounts = accounts.filter(a => a.customerId === nodeId);
    return custAccounts.map((a, i) => ({
      id: a.id,
      label: a.type + "\n" + formatNOK(a.balance),
      color: node.color,
      shape: "circle" as const,
      size: 18,
      data: a,
    }));
  }

  // Account -> show recent transactions
  if (nodeId.startsWith("acc-")) {
    const accTxs = transactions.filter(t => t.accountId === nodeId).slice(0, 5);
    return accTxs.map((t, i) => {
      const txColor = t.status === "cleared" ? "#51cf66" : t.status === "review" ? "#ffd43b" : "#ff6b6b";
      return {
        id: t.id,
        label: formatNOK(t.amount) + " " + t.currency,
        color: txColor,
        shape: "diamond" as const,
        size: 12,
        data: t,
      };
    });
  }

  return null;
});

hud.scene.root.add(graph);

// Center the graph
graph.offsetX = W / 2;
graph.offsetY = H / 2;

// ============================================================================
// DETAIL PANEL MANAGEMENT
// ============================================================================

const MAX_DETAIL_PANELS = 4;
const detailPanels: Map<string, DetailPanel> = new Map();
const detailOrder: string[] = [];
let cascadeIdx = 0;

function showDetail(nodeId: string, detail: NodeDetail): void {
  const existing = detailPanels.get(nodeId);
  if (existing) {
    if (existing.visible) {
      hud.unregisterPanel(existing.id);
      detailPanels.delete(nodeId);
      const idx = detailOrder.indexOf(nodeId);
      if (idx >= 0) detailOrder.splice(idx, 1);
      return;
    }
  }

  while (detailPanels.size >= MAX_DETAIL_PANELS && detailOrder.length > 0) {
    const oldId = detailOrder.shift()!;
    const old = detailPanels.get(oldId);
    if (old) {
      hud.unregisterPanel(old.id);
      detailPanels.delete(oldId);
    }
  }

  const gn = graph.getNode(nodeId);
  let posX = W - 360;
  let posY = 40;
  if (gn) {
    posX = Math.min(W - 340, Math.max(10, W / 2 + gn.x + 50));
    posY = Math.min(H - 200, Math.max(10, H / 2 + gn.y - 60));
  }
  const offset = cascadeIdx * 25;
  cascadeIdx = (cascadeIdx + 1) % 6;

  const panel = new DetailPanel(nodeId, { x: posX + offset, y: posY + offset });
  panel.show(detail);

  panel.onClose(() => {
    hud.unregisterPanel(panel.id);
    detailPanels.delete(nodeId);
    const idx = detailOrder.indexOf(nodeId);
    if (idx >= 0) detailOrder.splice(idx, 1);
  });

  hud.registerPanel(panel);
  detailPanels.set(nodeId, panel);
  detailOrder.push(nodeId);
}

// ============================================================================
// NODE CLICK HANDLERS (via __area42 global)
// ============================================================================

const expandedNodes = new Set<string>();
(window as any).__area42 = {
  expandedNodes,
  onNodeClick: (node: GN) => {
    const data = node.data;
    if (!data) return;

    // Customer click
    if (node.id.startsWith("cust-")) {
      const c = data as Customer;
      const custAccounts = accounts.filter(a => a.customerId === c.id);
      const totalBalance = custAccounts.reduce((s, a) => s + a.balance, 0);
      const amlColor = c.amlStatus === "CLEARED" ? "#51cf66" : c.amlStatus === "REVIEW" ? "#ffd43b" : "#ff6b6b";

      showDetail(node.id, {
        nodeId: node.id,
        title: c.name,
        subtitle: "Org.nr: " + c.orgNr + " | " + c.sector,
        color: c.color,
        sections: [
          {
            title: "Profil",
            fields: [
              { label: "Risikoscore", value: c.riskScore, color: c.riskScore > 60 ? "#ff6b6b" : c.riskScore > 30 ? "#ffd43b" : "#51cf66", type: "bar" },
              { label: "AML-status", value: c.amlStatus, color: amlColor, type: "badge" },
              { label: "Sektor", value: c.sector },
              { label: "Kontoer", value: custAccounts.length },
              { label: "Total saldo", value: formatNOK(totalBalance) + " NOK", color: "#4dabf7" },
            ],
          },
          {
            title: "Kontoer",
            fields: custAccounts.map(a => ({
              label: a.type,
              value: formatNOK(a.balance) + " " + a.currency,
              type: "list" as const,
              color: "#c8d6e5",
            })),
          },
        ],
        actions: [
          { label: "Utvid kontoer", color: "#4dabf7", callback: () => { graph.expandAsync(node.id); expandedNodes.add(node.id); } },
          { label: "Flagg for gransking", color: "#ff6b6b", callback: () => { console.log("Flagged: " + c.name); } },
        ],
      });
      return;
    }

    // Account click
    if (node.id.startsWith("acc-")) {
      const a = data as Account;
      const accTxs = transactions.filter(t => t.accountId === a.id);
      const txTable = new Table([
        { key: "date", label: "Dato", width: 0.2 },
        { key: "type", label: "Type", width: 0.2 },
        { key: "amount", label: "Belop", width: 0.25, align: "right" as const, format: (v: any) => formatNOK(v) },
        { key: "counterparty", label: "Motpart", width: 0.35 },
      ]);
      txTable.setData(accTxs.map(t => ({
        ...t,
        _badge: t.status === "cleared" ? "OK" : t.status === "review" ? "SJEKK" : "FLAGG",
        _badgeColor: t.status === "cleared" ? "#51cf66" : t.status === "review" ? "#ffd43b" : "#ff6b6b",
      })));

      const cust = customers.find(c => c.id === a.customerId);

      showDetail(node.id, {
        nodeId: node.id,
        title: a.type,
        subtitle: a.number + " | " + (cust ? cust.name : ""),
        color: cust?.color || "#4dabf7",
        sections: [
          {
            title: "Kontodetaljer",
            fields: [
              { label: "Saldo", value: formatNOK(a.balance) + " " + a.currency, color: "#4dabf7" },
              { label: "Type", value: a.type },
              { label: "Apnet", value: a.opened },
              { label: "Status", value: a.status, color: a.status === "Aktiv" ? "#51cf66" : "#ffd43b" },
              { label: "Transaksjoner", value: accTxs.length },
            ],
          },
        ],
        actions: [
          { label: "Vis transaksjoner", color: "#4dabf7", callback: () => { graph.expandAsync(node.id); expandedNodes.add(node.id); } },
          { label: "Eksporter", color: "#22d3ee", callback: () => { console.log("Export: " + a.number); } },
        ],
        _tableRenderer: (ctx, x, y, w, h) => {
          txTable.render(ctx, x, y, w, h);
        },
      });
      return;
    }

    // Transaction click
    if (node.id.startsWith("tx-")) {
      const t = data as Transaction;
      const txColor = t.status === "cleared" ? "#51cf66" : t.status === "review" ? "#ffd43b" : "#ff6b6b";
      const acc = accounts.find(a => a.id === t.accountId);
      const cust = acc ? customers.find(c => c.id === acc.customerId) : null;

      showDetail(node.id, {
        nodeId: node.id,
        title: t.type + " " + formatNOK(t.amount) + " " + t.currency,
        subtitle: "TX: " + t.id + " | " + t.date,
        color: txColor,
        sections: [
          {
            title: "Transaksjonsdetaljer",
            fields: [
              { label: "Belop", value: formatNOK(t.amount) + " " + t.currency, color: t.amount < 0 ? "#ff6b6b" : "#51cf66" },
              { label: "Dato", value: t.date },
              { label: "Type", value: t.type },
              { label: "Motpart", value: t.counterparty },
              { label: "Status", value: t.status.toUpperCase(), color: txColor, type: "badge" },
              { label: "Konto", value: acc ? acc.number : "Ukjent" },
              { label: "Kunde", value: cust ? cust.name : "Ukjent" },
            ],
          },
          ...(t.amlFlags.length > 0 ? [{
            title: "AML-flagg",
            fields: t.amlFlags.map(f => ({
              label: f,
              value: "!",
              color: "#ff6b6b",
              type: "list" as const,
            })),
          }] : []),
        ],
        actions: [
          { label: "Undersok", color: "#ffd43b", callback: () => { console.log("Investigating: " + t.id); } },
          { label: "Rapporter", color: "#ff6b6b", callback: () => { console.log("Reported: " + t.id); } },
        ],
      });
      return;
    }
  },

  onEdgeClick: (edge: any, point: { x: number; y: number }) => {
    // Show edge detail
    const fromNode = graph.getNode(edge.from);
    const toNode = graph.getNode(edge.to);
    if (!fromNode || !toNode) return;

    const fromData = fromNode.data;
    const toData = toNode.data;

    let title = fromNode.label + " -> " + toNode.label;
    let fields: Array<{ label: string; value: string | number; color?: string }> = [];

    if (fromNode.id.startsWith("cust-") && toNode.id.startsWith("acc-")) {
      const acc = toData as Account;
      fields = [
        { label: "Relasjon", value: "Kontoeier" },
        { label: "Saldo", value: formatNOK(acc.balance) + " " + acc.currency },
        { label: "Kontotype", value: acc.type },
      ];
    } else if (fromNode.id.startsWith("acc-") && toNode.id.startsWith("tx-")) {
      const tx = toData as Transaction;
      fields = [
        { label: "Transaksjon", value: tx.type },
        { label: "Belop", value: formatNOK(tx.amount) + " " + tx.currency },
        { label: "Motpart", value: tx.counterparty },
      ];
    }

    // Edge details get shown as a small panel near the click
    // (using the detail panel system)
    showDetail("edge-" + edge.from + "-" + edge.to, {
      nodeId: "edge-" + edge.from + "-" + edge.to,
      title: title,
      subtitle: "Kantrelasjon",
      color: "#6b7b8d",
      sections: [{
        title: "Detaljer",
        fields: fields.map(f => ({ ...f, type: undefined })),
      }],
    });
  },
};

// ============================================================================
// INFO PANEL (top-left corner)
// ============================================================================

const infoPanel = hud.panel({
  title: "Undersokelse",
  position: { x: 20, y: 20 },
  size: { x: 280, y: 160 },
  glass: true,
  titleColor: "#4dabf7",
  closable: false,
});

const infoMetrics = new MetricDisplay({ columns: 2, valueSize: 18, labelSize: 8 });
infoMetrics.set("Kunder", String(customers.length), "#4dabf7");
infoMetrics.set("Kontoer", String(accounts.length), "#22d3ee");
infoMetrics.set("Transaksjoner", String(transactions.length), "#ffd43b");
infoMetrics.set("Flagget", String(transactions.filter(t => t.status === "flagged").length), "#ff6b6b");

infoPanel.onContent((ctx, x, y, w, h) => {
  infoMetrics.render(ctx, x, y, w, 60);

  // Instructions
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "9px system-ui";
  const lines = [
    "Klikk node = detaljer",
    "Dobbelklikk = utvid/skjul",
    "Shift+klikk = velg flere",
    "Hoyre-klikk = kontekstmeny",
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + 70 + i * 14);
  });
});

// ============================================================================
// LEGEND PANEL (bottom-left)
// ============================================================================

const legendPanel = hud.panel({
  title: "Forklaring",
  position: { x: 20, y: H - 140 },
  size: { x: 200, y: 120 },
  glass: true,
  titleColor: "#6b7b8d",
  compact: true,
});

legendPanel.onContent((ctx, x, y, w, h) => {
  const items = [
    { shape: "hexagon", label: "Kunde", color: "#4dabf7" },
    { shape: "circle", label: "Konto", color: "#22d3ee" },
    { shape: "diamond", label: "Transaksjon (OK)", color: "#51cf66" },
    { shape: "diamond", label: "Transaksjon (Sjekk)", color: "#ffd43b" },
    { shape: "diamond", label: "Transaksjon (Flagget)", color: "#ff6b6b" },
  ];

  items.forEach((item, i) => {
    const iy = y + i * 17;

    ctx.fillStyle = item.color;
    if (item.shape === "hexagon") {
      // Draw tiny hexagon
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2 - Math.PI / 2;
        const hx = x + 6 + Math.cos(angle) * 5;
        const hy = iy + 5 + Math.sin(angle) * 5;
        if (j === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
    } else if (item.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(x + 6, iy);
      ctx.lineTo(x + 11, iy + 5);
      ctx.lineTo(x + 6, iy + 10);
      ctx.lineTo(x + 1, iy + 5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x + 6, iy + 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#c8d6e5";
    ctx.font = "10px system-ui";
    ctx.fillText(item.label, x + 18, iy + 9);
  });
});

// ============================================================================
// STATUS BAR
// ============================================================================

hud.statusBar.set('brand', 'Area42 v0.1.0', { position: 'left', color: '#00d4aa' });
hud.statusBar.set('stats', 'Nodes: ' + customers.length + ' | Edges: 0 | FPS: 60', { position: 'right' });

let invFrameCount = 0;
let invLastFpsTime = performance.now();
hud.renderer.onRender((rc) => {
  invFrameCount++;
  const now = performance.now();
  if (now - invLastFpsTime >= 1000) {
    const fps = Math.round(invFrameCount * 1000 / (now - invLastFpsTime));
    const nodeCount = graph.getNodes().length;
    const edgeCount = graph.getEdges().length;
    hud.statusBar.set('stats', 'Nodes: ' + nodeCount + ' | Edges: ' + edgeCount + ' | FPS: ' + fps, { position: 'right' });
    invFrameCount = 0;
    invLastFpsTime = now;
  }
});

// ============================================================================
// BREADCRUMB TRAIL
// ============================================================================

const breadcrumb = new Breadcrumb();

// Breadcrumb panel at top of screen
const breadcrumbPanel = hud.panel({
  title: '',
  position: { x: 20, y: hud.renderer.height - 70 },
  size: { x: 500, y: 30 },
  glass: true,
  compact: true,
  closable: false,
});

breadcrumbPanel.onContent((ctx, x, y, w, h) => {
  breadcrumb.render(ctx, x, y, w);
});

// Update breadcrumbs when nodes are expanded
function updateBreadcrumb(nodeId: string): void {
  const node = graph.getNode(nodeId);
  if (!node) return;

  const trail: BreadcrumbItem[] = [];

  // Root level
  trail.push({
    label: 'Kunder',
    id: 'root',
    color: '#4dabf7',
    onClick: () => {
      // Collapse everything
      for (const c of customers) {
        if (expandedNodes.has(c.id)) {
          graph.collapse(c.id);
          expandedNodes.delete(c.id);
        }
      }
      breadcrumb.set([{ label: 'Kunder', id: 'root', color: '#4dabf7' }]);
    },
  });

  // Customer level
  if (nodeId.startsWith('cust-')) {
    const c = customers.find(cu => cu.id === nodeId);
    if (c) {
      trail.push({
        label: c.name,
        id: c.id,
        color: c.color,
        onClick: () => {
          // Collapse accounts under this customer
          const custAccs = accounts.filter(a => a.customerId === c.id);
          for (const a of custAccs) {
            if (expandedNodes.has(a.id)) {
              graph.collapse(a.id);
              expandedNodes.delete(a.id);
            }
          }
          breadcrumb.set(trail.slice(0, 2));
        },
      });
    }
  }

  // Account level
  if (nodeId.startsWith('acc-')) {
    const a = accounts.find(ac => ac.id === nodeId);
    if (a) {
      const c = customers.find(cu => cu.id === a.customerId);
      if (c) {
        trail.push({
          label: c.name,
          id: c.id,
          color: c.color,
          onClick: () => {
            if (expandedNodes.has(a.id)) {
              graph.collapse(a.id);
              expandedNodes.delete(a.id);
            }
            breadcrumb.set(trail.slice(0, 2));
          },
        });
      }
      trail.push({
        label: 'Konto ' + a.number.split('.')[0],
        id: a.id,
        color: c?.color ?? '#4dabf7',
      });
    }
  }

  // Transaction level
  if (nodeId.startsWith('tx-')) {
    const t = transactions.find(tx => tx.id === nodeId);
    if (t) {
      const a = accounts.find(ac => ac.id === t.accountId);
      const c = a ? customers.find(cu => cu.id === a.customerId) : null;
      if (c) {
        trail.push({ label: c.name, id: c.id, color: c.color });
      }
      if (a) {
        trail.push({ label: 'Konto ' + a.number.split('.')[0], id: a.id, color: c?.color ?? '#4dabf7' });
      }
      trail.push({ label: 'Transaksjon ' + t.id.replace('tx-', '#'), id: t.id, color: t.status === 'cleared' ? '#51cf66' : t.status === 'review' ? '#ffd43b' : '#ff6b6b' });
    }
  }

  breadcrumb.set(trail);
}


// Also update breadcrumb on node click
const origOnNodeClick = (window as any).__area42?.onNodeClick;
const area42Ref = (window as any).__area42;
if (area42Ref) {
  const origClick = area42Ref.onNodeClick;
  area42Ref.onNodeClick = (node: any) => {
    updateBreadcrumb(node.id);
    if (origClick) origClick(node);
  };
}


// ============================================================================
// ORGANIZATION TREE (bottom-right panel)
// ============================================================================

const orgTree = new Tree({ direction: "top-down", nodeSpacing: 15, levelSpacing: 60, nodeWidth: 110, nodeHeight: 30 });
orgTree.setData({
  id: "holding",
  label: "DONTPANIC Holding",
  color: "#00d4aa",
  children: [
    {
      id: "bank",
      label: "BoringBank",
      color: "#4dabf7",
      children: [
        { id: "bank-ops", label: "Operations", color: "#22d3ee" },
        { id: "bank-compliance", label: "Compliance", color: "#ffd43b" },
        { id: "bank-risk", label: "Risk & AML", color: "#ff6b6b" },
      ],
    },
    {
      id: "tech",
      label: "Tech Division",
      color: "#a78bfa",
      children: [
        { id: "tech-ai", label: "AI / Marvin", color: "#f97316" },
        { id: "tech-infra", label: "Infrastructure", color: "#51cf66" },
        { id: "tech-agents", label: "AgentSmith", color: "#22d3ee" },
      ],
    },
    {
      id: "services",
      label: "Services",
      color: "#51cf66",
      children: [
        { id: "svc-suits", label: "Suits (Admin)", color: "#ffd43b" },
        { id: "svc-vale", label: "Vale (Comms)", color: "#a78bfa" },
      ],
    },
  ],
});

const orgPanel = hud.panel({
  title: "Organization",
  position: { x: W - 440, y: H - 320 },
  size: { x: 420, y: 300 },
  glass: true,
  titleColor: "#00d4aa",
});

orgPanel.onContent((ctx, x, y, w, h) => {
  // Center the tree in the panel
  orgTree.setOffset(x + w / 2 - 55, y + 4);
  orgTree.render(ctx);
});

// ============================================================================
// SIMULATE LIVE ACTIVITY
// ============================================================================

function simulateActivity(): void {
  // Randomly pulse a customer node
  const cust = customers[Math.floor(Math.random() * customers.length)];
  graph.pulse(cust.id, cust.color);

  // If accounts are expanded, occasionally pulse an account
  for (const c of customers) {
    const node = graph.getNode(c.id);
    if (node && node.childIds.length > 0) {
      if (Math.random() > 0.5) {
        const childId = node.childIds[Math.floor(Math.random() * node.childIds.length)];
        graph.pulse(childId, c.color);
      }
    }
  }

  // Send particles between connected nodes
  if (Math.random() > 0.3) {
    const edges = graph.getEdges();
    if (edges.length > 0) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const fromNode = graph.getNode(edge.from);
      if (fromNode) {
        graph.particle(edge.from, edge.to, { color: fromNode.color, speed: 0.4, size: 2 });
      }
    }
  }
}

setInterval(simulateActivity, 2000);

// ============================================================================
// CONSOLE LOG
// ============================================================================

console.log(
  "%c Area42 %c Investigation Demo ",
  "background:#0a0e17;color:#ff6b6b;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px",
  "background:#131a2b;color:#c8d6e5;padding:4px 8px;border-radius:0 4px 4px 0",
);
console.log("  BoringBank-style financial investigation interface");
console.log("  " + customers.length + " customers, " + accounts.length + " accounts, " + transactions.length + " transactions");
console.log("  Norwegian financial data with AML flags and risk scoring");
console.log("");
console.log("  Click a customer node for profile details");
console.log("  Double-click to expand accounts, then transactions");
console.log("  Shift+click two nodes to multi-select");
console.log("  Right-click for context menu (Investigate, Flag, History)");
console.log("  Organization tree panel in bottom-right corner");
console.log("  Scroll to zoom, Ctrl+drag to pan. Press ? for help.");
