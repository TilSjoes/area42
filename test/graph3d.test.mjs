// Graph3D scale behaviour, headless: no browser, no WebGL, no test framework (zero extra dependencies). Run `npm test`
// (after `npm run build`; it imports the built dist). A tiny canvas stub stands in for the DOM so label sprites can be built.
import * as THREE from "three";

const ctx = new Proxy({}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 40 }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { Graph3D } = await import("../dist/world/graph3d.js");

let passed = 0, failed = 0;
const check = (name, cond, detail = "") => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${detail}`); } };

const nodes = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: `n${i}`, label: `node ${i}`, position: [(i % 50) * 12, Math.floor(i / 50) * 12, 0], size: 14, shape: "sphere", color: 0x39c5ff, ...extra,
}));
const meshesOf = (g) => g.group.children.filter((o) => o.isMesh);
const spriteCount = (g) => { let c = 0; g.group.traverse((o) => { if (o.isSprite) c++; }); return c; };

// ── shared geometry ───────────────────────────────────────────────────────────────────────────────────────────────
{
  const g = new Graph3D();
  g.update({ nodes: nodes(500), edges: [] });
  const geoms = new Set(meshesOf(g).map((m) => m.geometry));
  check("canary: 500 nodes were added", meshesOf(g).length === 500);
  check("500 same-shape same-size nodes share ONE geometry (it was one per node)", geoms.size === 1, `distinct geometries: ${geoms.size}`);
  const g2 = new Graph3D();
  g2.update({ nodes: [...nodes(100), ...nodes(100, { size: 5, shape: "box" }).map((n) => ({ ...n, id: "b" + n.id }))], edges: [] });
  check("a different shape or size gets its own geometry (2 kinds -> 2)", new Set(meshesOf(g2).map((m) => m.geometry)).size === 2);
}

// ── lazy labels ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const g = new Graph3D();
  g.update({ nodes: nodes(300), edges: [] });
  check("no label sprite exists until a node is hovered or selected (300 nodes -> 0 sprites; was 300 canvas textures)", spriteCount(g) === 0, `sprites: ${spriteCount(g)}`);
  g.setSelected("n7");
  check("selecting a node creates exactly its label, visible", spriteCount(g) === 1 && g.nodes.get("n7").labelSprite?.visible === true);
  g.setSelected(null);
  check("deselecting hides the label (kept for reuse, not rebuilt)", g.nodes.get("n7").labelSprite?.visible === false && spriteCount(g) === 1);
  g.setSelected("n7");
  check("re-selecting reuses the same label sprite", spriteCount(g) === 1);
  g.setMultiSelected(["n1", "n2", "n3"]);
  check("multi-select labels exactly those nodes", g.nodes.get("n2").labelSprite?.visible === true && g.nodes.get("n9").labelSprite == null);
  const noLabel = new Graph3D();
  noLabel.update({ nodes: nodes(3).map(({ label, ...n }) => n), edges: [] });
  noLabel.setSelected("n1");
  check("a node with no label never gets a sprite", spriteCount(noLabel) === 0);
}

// ── behaviour that must not change ────────────────────────────────────────────────────────────────────────────────
{
  const g = new Graph3D();
  g.update({ nodes: nodes(200), edges: [{ from: "n0", to: "n1" }, { from: "n1", to: "n2" }] });
  const cam = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  cam.position.set(0, 0, 600); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const p = g.nodes.get("n0").mesh.position.clone().project(cam);
  const hit = g.pick(p.x, p.y, cam);
  check("picking still returns the node under the pointer with shared geometry", hit?.id === "n0", `picked ${hit?.id}`);
  g.setNodeScale("n5", 0);
  check("setNodeScale still scales one node without touching its neighbours", g.nodes.get("n5").mesh.scale.x === 0 && g.nodes.get("n6").mesh.scale.x === 1);
  g.setNodeColor("n8", 0xff0000);
  check("setNodeColor still recolours one node only", g.nodes.get("n8").mesh.material.color.getHex() === 0xff0000 && g.nodes.get("n9").mesh.material.color.getHex() === 0x39c5ff);
  const shared = g.nodes.get("n0").mesh.geometry;
  let disposed = 0; shared.addEventListener("dispose", () => disposed++);
  g.update({ nodes: nodes(100), edges: [] }); // 100 nodes removed
  check("removing nodes never disposes the geometry the remaining nodes still use", disposed === 0 && g.nodes.size === 100 && g.nodes.get("n0").mesh.geometry === shared);
  g.setSelected("n3"); g.update({ nodes: nodes(2), edges: [] });
  check("removing a node that had a label does not throw and drops the node", g.nodes.size === 2);
  const pos = g.getNodePosition("n1");
  check("positions, radius and bounds still answer", pos?.x === 12 && g.getNodeRadius("n1") > 0 && !g.computeBounds().isEmpty());
}

// ── batched edges (opt-in: new Graph3D({ batchEdges: true })) ─────────────────────────────────────────────────────
{
  const lineObjects = (g) => { const out = { line: 0, segments: 0 }; g.group.traverse((o) => { if (o.isLineSegments) out.segments++; else if (o.isLine) out.line++; }); return out; };
  const ring = (n, count) => Array.from({ length: count }, (_, i) => ({ from: `n${i % n}`, to: `n${(i * 7 + 1) % n}`, color: i % 2 ? 0xff0000 : 0x00ff00 }));
  const dflt = new Graph3D();
  dflt.update({ nodes: nodes(50), edges: ring(50, 6) });
  check("default Graph3D is UNCHANGED: one THREE.Line per edge", lineObjects(dflt).line === 6 && lineObjects(dflt).segments === 0);

  const g = new Graph3D({ batchEdges: true });
  g.update({ nodes: nodes(200), edges: ring(200, 3000) });
  const lo = lineObjects(g);
  check("3,000 edges are ONE LineSegments draw call and no individual lines (was 3,000)", lo.segments === 1 && lo.line === 0, JSON.stringify(lo));
  const segs = (() => { let s; g.group.traverse((o) => { if (o.isLineSegments) s = o; }); return s; })();
  const P = segs.geometry.getAttribute("position").array, C = segs.geometry.getAttribute("color").array;
  const e0 = g.edges[5], a = g.nodes.get(e0.options.from).mesh.position, b = g.nodes.get(e0.options.to).mesh.position;
  check("each edge's vertices are its two node positions", [a.x, a.y, a.z, b.x, b.y, b.z].every((v, k) => P[5 * 6 + k] === v));
  check("the draw range covers exactly the live edges", segs.geometry.drawRange.count === 3000 * 2, `count ${segs.geometry.drawRange.count}`);
  check("edge colours are per edge (red and green in one batch), 4 components so the alpha tier rides in the vertex", segs.geometry.getAttribute("color").itemSize === 4 && (C[0] !== C[8] || C[1] !== C[9]));

  const bright = (i) => C[i * 8 + 3]; // the highlight tier lives in the vertex ALPHA (the rgb stays the edge colour)
  const even = g.edges.findIndex((e) => e.options.color === 0x00ff00 && e.options.from === "n0");
  const before = bright(even);
  g.setMultiSelected(["n0", "n1"]);
  const between = g.edges.findIndex((e) => (e.options.from === "n0" && e.options.to === "n1") || (e.options.from === "n1" && e.options.to === "n0"));
  const inSel = (id) => id === "n0" || id === "n1";
  // exactly ONE endpoint in the selection (the ring repeats n0->n1 every 200 edges, so "touches n0" alone would find another between-edge)
  // "Brightness" is the vertex alpha, the same for any colour.
  const incident = g.edges.findIndex((e) => inSel(e.options.from) !== inSel(e.options.to));
  const other = g.edges.findIndex((e) => !inSel(e.options.from) && !inSel(e.options.to));
  check("canary: the fixture has a between, an incident and an unrelated edge", between >= 0 && incident >= 0 && other >= 0, JSON.stringify({ between, incident, other }));
  check("three-tier highlight is PER EDGE: between > incident > unrelated", bright(between) > bright(incident) && bright(incident) > bright(other), JSON.stringify([bright(between), bright(incident), bright(other)]));
  g.clearMultiSelected();
  check("clearing the selection restores the resting brightness", Math.abs(bright(even) - before) < 1e-6);
  const rgbBefore = [C[even * 8], C[even * 8 + 1], C[even * 8 + 2]];
  g.setMultiSelected(["n0", "n1"]);
  check("highlighting never darkens the edge colour (no dark stripes over nodes): rgb is untouched", [C[even * 8], C[even * 8 + 1], C[even * 8 + 2]].every((v, k) => v === rgbBefore[k]));
  g.clearMultiSelected();

  const hiddenCount = () => { let h = 0; for (let i = 0; i < 3000; i++) if (P[i * 6] === P[i * 6 + 3] && P[i * 6 + 1] === P[i * 6 + 4] && P[i * 6 + 2] === P[i * 6 + 5]) h++; return h; };
  const before0 = hiddenCount();
  g.setIsolated(["n0", "n1", "n2"]);
  const nowHidden = hiddenCount();
  check("isolating a subgraph collapses every edge that leaves it (degenerate, draws nothing)", nowHidden > before0 && nowHidden >= 2900, `hidden ${nowHidden}`);
  g.clearIsolated();
  check("clearing the isolation restores every edge", hiddenCount() === before0);

  g.update({ nodes: nodes(200), edges: ring(200, 100) });
  check("re-updating with fewer edges reuses the same single object and shrinks the draw range", lineObjects(g).segments === 1 && segs.geometry.drawRange.count === 200, `count ${segs.geometry.drawRange.count}`);
  g.update({ nodes: nodes(200), edges: ring(200, 5000) });
  let segs2; g.group.traverse((o) => { if (o.isLineSegments) segs2 = o; });
  check("growing past the buffer capacity keeps ONE object with every edge", lineObjects(g).segments === 1 && segs2.geometry.drawRange.count === 10000 && g.edges.length === 5000);
  g.clear();
  check("clear() empties the batch", g.edges.length === 0 && segs2.geometry.drawRange.count === 0);
}

// ── scale: boot work for a 6,000-node brain ───────────────────────────────────────────────────────────────────────
{
  const g = new Graph3D();
  const t0 = performance.now();
  g.update({ nodes: nodes(6000), edges: [] });
  const ms = performance.now() - t0;
  check("building 6,000 nodes is fast (< 1.5 s) and makes no canvases", ms < 1500 && spriteCount(g) === 0, `took ${ms.toFixed(0)} ms`);
  console.log(`    (6,000 nodes: ${ms.toFixed(0)} ms, ${new Set(meshesOf(g).map((m) => m.geometry)).size} geometry)`);
}

console.log(`\n  graph3d: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
