# Area42 v2 — Container Tree Architecture RFC

> Design specification for the next major version of the Area42 visualization library.
> Based on learnings from AgentSmith v1, v2, BoringBank, and Area42OS.

## Problem Statement

Area42 v1 is a powerful visualization library (graphs, glass panels, particles, metrics) but has a flat scene graph that pretends to be hierarchical. When you put a Graph inside a Panel:
- The graph doesn't clip to the panel bounds
- Events don't transform through the hierarchy
- Resizing/collapsing the panel doesn't affect the graph
- You can't nest panels inside panels
- Every element reinvents coordinate mapping

The result: visual elements float independently, overlapping panels they should be contained by. This limits the library from being a true UI framework for dashboards, HUDs, and spatial interfaces.

## Vision

**Everything is a Container. Containers hold Containers. The screen is the root Container.**

Like HTML's box model, but for Canvas 2D rendering with the Area42 aesthetic (neon, glass, particles). Any element can contain any other element. Transforms, clipping, and events cascade through the tree automatically.

```
Screen (root container)
├── Panel "Router Metrics" (container)
│   ├── MetricDisplay "Tokens In"
│   ├── MetricDisplay "Requests"
│   └── MetricDisplay "Cost"
├── Panel "Request Flow" (container, clipped)
│   └── Graph (container)
│       ├── Node "Spine"
│       ├── Node "MoE"
│       ├── Edge "Spine → MoE"
│       └── ParticleSystem
├── Panel "Backends" (container)
│   ├── BackendCard "Qwen3.5 MoE"
│   │   └── TimeSeries (latency sparkline)
│   └── BackendCard "Claude CLI"
│       └── TimeSeries (latency sparkline)
└── Panel "Live Stream" (container)
    └── Table
```

## Core Concepts

### 1. Container

Every visual element inherits from `Container`. A Container defines:

```typescript
class Container {
  // Identity
  id: string;
  
  // Spatial
  position: Vec2;        // Relative to parent
  size: Vec2;            // Own dimensions
  
  // Visual
  visible: boolean;
  opacity: number;       // Multiplied down the tree
  
  // Hierarchy
  parent: Container | null;
  children: Container[];
  
  // Behavior
  overflow: "visible" | "hidden" | "scroll";  // Like CSS
  interactive: boolean;  // Participates in hit testing
  
  // Lifecycle
  add(child: Container): void;
  remove(child: Container): void;
  
  // Coordinate mapping
  localToWorld(point: Vec2): Vec2;   // Walk up parent chain
  worldToLocal(point: Vec2): Vec2;   // Walk down from root
  localToParent(point: Vec2): Vec2;
  parentToLocal(point: Vec2): Vec2;
  
  // Bounds
  getLocalBounds(): Rect;            // { x: 0, y: 0, w: size.x, h: size.y }
  getWorldBounds(): Rect;            // Transformed through parent chain
  getClipRect(): Rect | null;        // If overflow: "hidden"
  
  // Rendering (override in subclasses)
  render(ctx: CanvasRenderingContext2D): void;
  
  // Events
  onPointerDown?(e: PointerEvent): boolean;   // Return true to consume
  onPointerMove?(e: PointerEvent): void;
  onPointerUp?(e: PointerEvent): void;
  onResize?(newSize: Vec2): void;             // Called when parent resizes
  onVisibilityChange?(visible: boolean): void;
}
```

### 2. Rendering Pipeline

```
Each frame (60fps):
  1. Update phase: walk tree, update animations, physics
  2. Render phase: walk tree depth-first
     For each Container:
       ctx.save()
       ctx.translate(position.x, position.y)
       ctx.globalAlpha *= opacity
       
       if overflow === "hidden":
         ctx.beginPath()
         ctx.rect(0, 0, size.x, size.y)
         ctx.clip()
       
       container.render(ctx)        // Draw self
       
       for child in children:       // Draw children (clipped if parent clips)
         renderContainer(child)
       
       ctx.restore()                // Undo transform + clip
```

This means:
- **Clipping is automatic.** Set `overflow: "hidden"` and children clip to your bounds.
- **Transforms compose.** A child at (10, 20) inside a parent at (100, 50) renders at (110, 70) in world space.
- **Opacity multiplies.** A 50% opacity child inside a 50% opacity parent renders at 25%.

### 3. Event Dispatch

Events walk the tree **front-to-back** (reverse child order, deepest first):

```
1. Convert screen coordinates to world coordinates
2. Walk tree recursively:
   For each Container (back to front):
     Transform point to local coordinates
     If overflow === "hidden" and point outside bounds: skip subtree
     Check children first (front child = last in array)
     If child consumed event: stop
     If self.interactive and point inside bounds:
       Call self.onPointerDown(localEvent)
       If returns true: event consumed, stop
3. Unconsumed events bubble to HUD (background clicks, etc.)
```

This means:
- **Clicks automatically transform** through the container hierarchy
- **Clipped areas don't receive events** (can't click what you can't see)
- **Children get events before parents** (click a graph node before the panel it's in)

### 4. Layout Hints (Optional)

Containers can opt into simple layout:

```typescript
class Container {
  layout: "none" | "vertical" | "horizontal" | "grid";
  gap: number;
  padding: Insets;  // { top, right, bottom, left }
}
```

When `layout !== "none"`, children are automatically positioned:
- `vertical`: stack children top-to-bottom with `gap` spacing
- `horizontal`: lay children left-to-right
- `grid`: flow into a grid based on container width

This replaces manual `position: { x, y }` for most cases while still allowing explicit positioning when needed.

## Element Hierarchy

```
Container (base)
├── Panel (glass morphism, title bar, drag/resize/collapse)
│   └── Inherits Container — can hold any children
├── Graph (force-directed physics, zoom/pan)
│   └── Inherits Container — nodes/edges are children
│   └── GraphNode (individual node, can contain sub-elements)
│   └── GraphEdge (connection with particles)
├── Table (rows, columns, scrollable)
│   └── Inherits Container — rows are children
├── MetricDisplay (label + value + sparkline)
├── TimeSeries (line/area chart)
├── Gauge (circular progress)
├── Heatmap (grid of colored cells)
├── StatusBar (bottom bar with segments)
├── DetailPanel (inspector panel, expandable sections)
│   └── Inherits Panel — can contain any children
├── MiniGraph (simple flow diagram)
├── Text (styled text block — integrates Pretext for layout)
├── Button (clickable, styled)
└── Separator (visual divider)
```

## Data Binding

Currently, data flows via direct method calls (`table.setData(rows)`, `graph.addNode()`). This works but doesn't scale for drill-down or domain-specific views.

### DataSource Protocol

```typescript
interface DataSource<T> {
  // Current data
  data: T;
  
  // Subscribe to changes
  onChange(callback: (data: T) => void): void;
  
  // Drill-down (optional)
  canDrillDown?(item: any): boolean;
  drillDown?(item: any): DataSource<any>;
  
  // Metadata
  label?: string;
  domain?: string;  // "routing", "missions", "banking", etc.
}
```

Elements bind to DataSources:
```typescript
const routerStats = new SSEDataSource<RouterStats>("/api/marvin/stats");
const metricsPanel = new MetricDisplay({ source: routerStats, field: "total_requests" });
const latencyChart = new TimeSeries({ source: routerStats, field: "latencies" });
```

When the source updates, all bound elements update automatically. Drill-down creates child DataSources that feed into child Containers.

### Domain Contexts

A domain context groups related DataSources and visual elements:

```typescript
const routerDomain = new DomainContext("router", {
  sources: {
    stats: new SSEDataSource("/api/marvin/stats"),
    health: new PollingDataSource("/api/marvin/health", 5000),
    events: new SSEDataSource("/api/events"),
  },
  theme: { accent: "#4dabf7" },  // Domain-specific color
});

// All elements in this domain share the context
const routerPanel = routerDomain.createPanel("Request Flow", { ... });
const routerGraph = routerDomain.createGraph("Flow", { ... });
```

## Style System

Styles cascade like CSS, inherited from parent unless overridden:

```typescript
interface Style {
  // Colors (Area42 neon palette)
  bg?: string;
  fg?: string;
  accent?: string;
  border?: string;
  
  // Typography
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase";
  
  // Effects
  glowColor?: string;
  glowIntensity?: number;
  glassBg?: string;
  glassOpacity?: number;
  
  // Spacing
  padding?: Insets;
  gap?: number;
  borderRadius?: number;
}
```

Every Container has a `style` property. Children inherit parent's style unless they override specific fields. This means:
- Set `accent: "#f97316"` on a domain panel and all children glow orange
- Set `fontSize: 12` at the HUD level and every element uses it unless overridden
- The neon theme is the root style; domains customize it

## Migration Path

### Phase 1: Container base (non-breaking)
- Add `Container` class alongside existing `SceneNode`
- Panel, Graph, Table inherit from `Container`
- `overflow: "hidden"` on Panel enables clipping
- Existing `onContent()` still works (backward compatible)
- **Effort: 1-2 sessions**

### Phase 2: Event cascade
- Unified hit testing through container tree
- Remove per-element event hacking
- Click-on-graph-node-inside-panel works correctly
- **Effort: 1 session**

### Phase 3: Layout and style
- Add layout hints (vertical, horizontal, grid)
- Add style inheritance
- Migrate AgentSmith v2 tabs to use layout instead of manual positioning
- **Effort: 2-3 sessions**

### Phase 4: Data binding
- DataSource protocol
- Drill-down support
- Domain contexts
- **Effort: 2-3 sessions**

### Phase 5: New elements
- Text element with Pretext integration
- Button element
- Breadcrumb navigation for drill-down
- **Effort: 1-2 sessions**

## Learnings Incorporated

### From AgentSmith v1 (Python + D3.js)
- D3.js force graph works but is separate from the panel system
- Panels are HTML divs, not Canvas — mixing paradigms is messy
- SSE data binding pattern works well, keep it

### From AgentSmith v2 (Area42 Canvas)
- Glass panels look great but can't contain graphs properly
- `onContent()` callback is limiting — need real containment
- Per-tab HUD initialization is clean, keep this pattern
- Router flow needs graph inside panel (the trigger for this RFC)

### From BoringBank
- Process visualization inside panels (state machines, flow diagrams)
- Dark theme with glass panels works for financial data
- Drill-down from summary to detail is essential
- Domain-specific coloring helps users navigate

### From Area42OS (Rust compositor)
- The graph IS the workspace, not just a widget
- Physics simulation gives life to static data
- Particles along edges show data flow beautifully
- Rooms/portals concept = domain contexts in the library

## API Examples

### Basic: Panel with Graph inside
```typescript
const hud = new HUD("#app", { theme: "neon" });

const panel = new Panel({
  title: "Request Flow",
  position: { x: 20, y: 100 },
  size: { x: 700, y: 400 },
  overflow: "hidden",  // Clips children!
});

const graph = new Graph({
  size: { x: 700, y: 370 },  // Fills panel content area
});
graph.addNode({ id: "spine", label: "Spine", color: "#f97316" });
graph.addNode({ id: "moe", label: "MoE", color: "#22d3ee" });
graph.addEdge({ from: "spine", to: "moe", particles: true });

panel.add(graph);  // Graph clips to panel bounds automatically
hud.root.add(panel);
```

### Advanced: Nested panels with drill-down
```typescript
const systemPanel = new Panel({
  title: "System Overview",
  size: { x: 1200, y: 800 },
  layout: "horizontal",
  gap: 10,
  padding: { top: 40, right: 10, bottom: 10, left: 10 },
});

const servicesPanel = new Panel({
  title: "Services",
  size: { x: 590, y: 750 },
  layout: "vertical",
  overflow: "scroll",  // Scrollable!
});

const metricsPanel = new Panel({
  title: "Metrics",
  size: { x: 590, y: 750 },
  layout: "vertical",
});

systemPanel.add(servicesPanel);
systemPanel.add(metricsPanel);

// Click on a service → drill down into detail
servicesPanel.onDrillDown((service) => {
  const detail = new DetailPanel({
    title: service.name,
    source: service.getDetailSource(),
  });
  metricsPanel.clear();
  metricsPanel.add(detail);
});
```

### Data binding: Live dashboard
```typescript
const stats = new SSEDataSource("/api/stats");

const dashboard = new Panel({ title: "Dashboard", layout: "grid" });

// These update automatically when SSE delivers new data
dashboard.add(new MetricDisplay({ label: "Requests", source: stats, field: "count" }));
dashboard.add(new MetricDisplay({ label: "Latency", source: stats, field: "avg_ms", format: "ms" }));
dashboard.add(new TimeSeries({ source: stats, field: "latencies", window: 60 }));
dashboard.add(new Gauge({ source: stats, field: "cpu_usage", max: 100 }));
```

## File Structure (proposed)

```
area42/
  src/
    core/
      container.ts        -- Container base class (NEW)
      renderer.ts         -- Canvas 2D + RAF loop (exists, minor updates)
      scene.ts           -- Scene uses Container tree (rewrite)
      hud.ts             -- HUD entry point (refactor events)
      style.ts           -- Style system with inheritance (NEW)
      layout.ts          -- Layout engine (vertical/horizontal/grid) (NEW)
      events.ts          -- Event dispatch through container tree (NEW)
    
    elements/
      panel.ts           -- Glass panel (extends Container)
      graph.ts           -- Force-directed graph (extends Container)
      table.ts           -- Data table (extends Container)
      metric.ts          -- Metric display
      timeseries.ts      -- Line/area chart
      gauge.ts           -- Circular progress
      heatmap.ts         -- Color grid
      text.ts            -- Styled text with Pretext (NEW)
      button.ts          -- Clickable button (NEW)
      separator.ts       -- Visual divider (NEW)
      minigraph.ts       -- Simple flow diagram
    
    data/
      source.ts          -- DataSource protocol (NEW)
      sse.ts             -- SSE data source
      polling.ts         -- Polling data source
      websocket.ts       -- WebSocket data source
      domain.ts          -- Domain context (NEW)
    
    effects/
      particles.ts       -- Particle system
      glow.ts            -- Glow effects (NEW, extracted)
    
    themes/
      neon.ts            -- Default neon theme
      glass.ts           -- Glass theme
    
    index.ts             -- Public API exports
```

## Dependencies

- **Current**: zero dependencies (keep this as much as possible)
- **Add**: `@chenglou/pretext` for text layout (few KB, zero deps itself)
- **Optional**: `three` for 3D/WebGL effects (already used in Arthur head demo)

## Success Criteria

1. **Router graph clips to panel** — the original trigger for this work
2. **Any element inside any panel** — graphs, tables, metrics, other panels
3. **Events work through hierarchy** — click a graph node inside a panel
4. **Style consistency** — change accent color on a domain, everything updates
5. **Data binding** — SSE/polling source → auto-updating elements
6. **Drill-down** — click a node → child view appears in a panel
7. **Backward compatible** — existing AgentSmith v2 tabs work with minor changes
8. **Still zero deps** for core (Pretext optional for text layout)

## Session Plan

A new Claude Code session can implement this in phases:

**Session 1**: Container base + Panel clipping + event cascade
- This alone fixes the Router graph-in-panel issue
- Non-breaking: existing code still works

**Session 2**: Layout engine + style inheritance
- Migrate AgentSmith v2 Router tab as proof of concept
- Simplify all manual positioning

**Session 3**: Data binding + domain contexts
- Wire SSE sources to elements
- Implement drill-down pattern

**Session 4**: New elements (Text, Button) + Pretext integration
- Rich text in panels
- Interactive controls

**Session 5**: Polish + migrate all AgentSmith v2 tabs
- Full migration from v1 patterns
- Documentation and examples
