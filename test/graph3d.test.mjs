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
