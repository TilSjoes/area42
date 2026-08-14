# Area42 Architecture

> @dontpanic/area42 — Futuristic HUD visualization engine

## Philosophy

Area42 is not a charting library. It is a **spatial intelligence interface** — a canvas where data becomes physical, relationships become visible, and intent drives layout.

Inspired by: Iron Man HUD, orbital mechanics, intent engineering.

## Core Architecture

```
+----------------------------------------------------------+
|                      Area42 HUD                           |
|                                                           |
|  +-------------+  +--------------+  +------------------+ |
|  |  Renderer   |  | Scene Graph  |  | Themes           | |
|  |  Canvas 2D  |  | Hierarchical |  | Neon / Glass     | |
|  |  60fps RAF  |  | Transform    |  | Custom           | |
|  |  HiDPI      |  | Animation    |  |                  | |
|  +------+------+  +------+-------+  +--------+---------+ |
|         |                |                    |           |
|  +------+----------------+--------------------+--------+  |
|  |                Component Layer                      |  |
|  |                                                     |  |
|  |  +--------+ +-------+ +--------+ +---------------+ |  |
|  |  | Panels | | Graph | | Charts | | Detail        | |  |
|  |  | Glass  | | Force | | TimeSer| | Inspect       | |  |
|  |  | Drag   | | Wells | | Sparkln| | Tables        | |  |
|  |  | Resize | | Drill | |        | | MiniGraphs    | |  |
|  |  | Snap   | | Select| |        | | Badges/Bars   | |  |
|  |  +--------+ +-------+ +--------+ +---------------+ |  |
|  |                                                     |  |
|  |  +----------+ +------------+ +--------------------+ |  |
|  |  | Particles| |Data Sources| | Interactions       | |  |
|  |  | Burst    | | WebSocket  | | Drag (mouse+touch) | |  |
|  |  | Edge flow| | REST poll  | | Multi-select       | |  |
|  |  | Glow     | | SSE        | | Drill-down         | |  |
|  |  +----------+ +------------+ | Click-to-inspect   | |  |
|  |                               +--------------------+ |  |
|  +------------------------------------------------------+ |
+-----------------------------------------------------------+
```

## Directory Structure

```
src/
├── core/
│   ├── renderer.ts      — Canvas 2D + RAF render loop (60fps, HiDPI)
│   ├── scene.ts         — Hierarchical scene graph with animation
│   └── hud.ts           — Main entry point, interactions, panel management
├── panels/
│   ├── panel.ts         — Glass panel (drag, resize, collapse, snap)
│   ├── detail.ts        — Click-to-inspect detail panel
│   ├── metric.ts        — Metric grid display (label/value with glow)
│   ├── table.ts         — Data table (columns, rows, badges, scroll)
│   └── minigraph.ts     — Process flow diagram (status nodes, arrows)
├── graph/
│   └── graph.ts         — Force-directed graph with gravity wells
├── charts/
│   └── timeseries.ts    — Sparkline/area chart with glowing line
├── effects/
│   └── particles.ts     — Particle system (burst, edge flow, glow)
├── data/
│   └── source.ts        — Data sources (WebSocket, REST, SSE)
├── themes/
│   └── neon.ts          — Neon + Glass themes
├── demo/
│   └── main.ts          — Interactive demo
└── index.ts             — Public API exports
```

## Key Concepts

### Gravity Wells
Parent nodes become local gravity wells when expanded. Children orbit within the well radius instead of drifting to the global center. Visualized as subtle radial gradients. Based on spring-charge physics with alpha cooling.

### Glass Panels
Floating semi-transparent panels with glass morphism, drag by title bar, resize by corner, magnetic snap to edges and other panels, collapsible, scrollable content.

### Node Persistence
Graph node positions save to localStorage automatically. User layouts persist across sessions. Dragged nodes pin in place — user placement beats physics.

### Data Sources
- **WebSocket** — NATS WebSocket bridge
- **SSE** — AgentSmith /api/events
- **REST** — Polling with configurable interval

### Multi-Select
Shift+click to select multiple nodes. Related edges glow, unrelated edges dim.

### Embedded Mode
`background: false` gives transparent canvas for embedding in existing HTML. `compact: true` on panels for smaller fonts/padding.

## API Quick Reference

```typescript
import { HUD, Graph, Panel, DetailPanel, Table, MiniGraph, TimeSeries, SSESource } from "@dontpanic/area42";

// Universe mode
const hud = new HUD("#container", { theme: "neon" });

// Embedded mode
const hud = new HUD("#panel", { theme: "neon", background: false });

// Panels
const panel = hud.panel({ title: "Status", position: {x:40,y:40}, glass: true });
panel.onContent((ctx, x, y, w, h) => { /* Canvas 2D rendering */ });

// Graph with gravity wells
const graph = new Graph({ size: { x: 800, y: 600 } });
hud.scene.root.add(graph);
graph.addNode({ id: "spine", label: "Spine", color: "#f97316", shape: "hexagon" });
graph.addEdge({ from: "spine", to: "moe", particles: true });
graph.pulse("spine");
graph.expand("spine", [/* children */]);  // creates gravity well

// Tables
const table = new Table([
  { key: "name", label: "Name", width: 0.4 },
  { key: "status", label: "Status", width: 0.3 },
]);
table.setData([{ name: "Mission 1", status: "OK", _badge: "OK", _badgeColor: "#51cf66" }]);

// Process flows
const flow = new MiniGraph(
  [{ id: "plan", label: "Plan", status: "completed" }],
  [{ from: "plan", to: "execute" }]
);

// Real-time data
const sse = new SSESource("http://server/api/events");
sse.on("route_event", (data) => graph.pulse(data.backend));
await sse.connect();
```

## Two Modes: Universe and Strict

| Mode | Use Case | Background | Panels |
|------|----------|-----------|--------|
| Universe | Brain tab, system overview | Dark grid, infinite canvas | Glass, floating free |
| Strict | Router, Governance tabs | Transparent, embedded in HTML | Compact, docked |

Same library, same components, different container configuration.

## Roadmap

### v0.1 (Current) — 51 kB, zero dependencies
- Canvas renderer, scene graph, panels, graph, particles
- Gravity wells, detail panels, tables, mini-graphs
- Data sources, multi-select, touch, persistence

### v0.2
- Gravity well tuning + auto-arrange children
- Content reflow on panel resize
- Context menus, keyboard shortcuts
- AgentSmith Brain tab migration

### v0.3
- Lagrange points (stable positions between wells)
- Intent-driven layout (AI classifies user focus)
- WebGL effects layer (bloom, depth-of-field)

### v1.0
- npm publish @dontpanic/area42
- Full AgentSmith replacement
- BoringBank AML/orchestration UI
- Plugin system for custom node types

## Design Principle: Intent Engineering Through Spatial Reasoning

Layout is meaning. Where a node sits, how bright it glows, how fast particles flow — these are the visual language of organizational intent.

Healthy systems look calm. Troubled systems demand attention through physics.

> "The answer is 42. But the question adapts to whoever is asking."

## Build

```bash
npm run dev      # Vite dev server on :4242
npm run build    # Library build (51 kB)
npm test         # Vitest
```

## License

Apache-2.0 — Copyright (c) 2026 DONTPANIC AS

See [LICENSE](LICENSE) for the full licence text and [NOTICE](NOTICE) for attribution requirements.
