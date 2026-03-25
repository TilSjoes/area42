# Area42

> Futuristic HUD visualization engine for real-time system monitoring

**@dontpanic/area42** — Canvas-based heads-up display with floating glass panels, animated graphs, and real-time data streams. Built for agent orchestration dashboards, SOC monitoring, and anyone who wants their data to look like an Iron Man interface.

## Features

- **Glass Panels** — Floating, draggable, collapsible panels with glass morphism
- **Canvas Renderer** — 60fps smooth rendering, no DOM overhead
- **Scene Graph** — Hierarchical node system with animations
- **Neon Theme** — Dark theme with glowing accents and ambient effects
- **Real-time** — Built for NATS/WebSocket data streams
- **Zero Dependencies** — Pure TypeScript, ~15KB gzipped

## Quick Start

```typescript
import { HUD } from "@dontpanic/area42";

const hud = new HUD("#container", { theme: "neon" });

const panel = hud.panel({
  title: "System Status",
  position: { x: 40, y: 40 },
  size: { x: 300, y: 200 },
  glass: true,
});

panel.onContent((ctx, x, y, w, h) => {
  ctx.fillStyle = "#51cf66";
  ctx.font = "bold 24px system-ui";
  ctx.fillText("ALL SYSTEMS GO", x, y + 30);
});
```

## Development

```bash
npm install
npm run dev     # Starts Vite dev server on :4242
npm run build   # Builds library to dist/
```

## License

MIT — DONTPANIC AS
