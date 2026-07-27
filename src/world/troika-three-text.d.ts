/**
 * Minimal type stubs for troika-three-text.
 *
 * The package doesn't ship its own .d.ts, and there's no
 * @types/troika-three-text on the registry. We declare the small
 * subset we use (Text class) and treat the rest as `any` — fine for
 * a peer-dep boundary; anyone wanting fuller types can replace this
 * stub with a community fork or write more precise declarations.
 */
declare module "troika-three-text" {
  import { Mesh, Material } from "three";

  export class Text extends Mesh {
    text: string;
    color: number | string;
    fontSize: number;
    font?: string;
    /** Anchor strings: "left" | "center" | "right" / "top" | "middle" | "bottom". */
    anchorX: string;
    anchorY: string;
    /** Numeric weight (100..900) or a CSS keyword. troika coerces. */
    fontWeight: number | string;
    fontStyle?: "normal" | "italic";
    maxWidth?: number;
    lineHeight?: number | "normal";
    textAlign?: "left" | "center" | "right" | "justify";
    overflowWrap?: "normal" | "break-word";
    outlineWidth?: number | string;
    outlineColor?: number | string;
    outlineBlur?: number | string;
    strokeWidth?: number | string;
    strokeColor?: number | string;
    fillOpacity?: number;
    /** troika's internal material — we set `material.side` for two-sidedness. */
    material: Material & { side: number };

    /** Kicks off async SDF generation. The mesh is empty until ready. */
    sync(callback?: () => void): void;
    /** Free GPU resources. */
    dispose(): void;
  }
}
