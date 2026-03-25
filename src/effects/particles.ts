/**
 * Area42 Particle System
 *
 * Lightweight particle emitter for glow effects, edge flow, and bursts.
 * All rendering is Canvas 2D with radial gradients for soft glow.
 */

import { Vec2 } from "../core/scene.js";
import { withAlpha } from "../core/color.js";

/** Options for burst emission */
export interface EmitOptions {
  count?: number;
  color?: string;
  speed?: number;
  size?: number;
  decay?: number;
  spread?: number;
}

/** A single particle with position, velocity, color, and lifetime */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
  /** For edge-traveling particles */
  edge?: { from: Vec2; to: Vec2 };
  /** Position along edge (0-1) */
  t?: number;
  /** Travel speed along edge */
  speed?: number;
}

/**
 * Manages a pool of particles with emission, update, and glow rendering.
 *
 * Particles are either free-flying (burst) or edge-bound (travel along a line).
 * Dead particles (life <= 0) are removed each frame.
 */
export class ParticleSystem {
  particles: Particle[] = [];
  private maxParticles = 2000;

  /**
   * Emit a burst of particles from a point.
   * @param x - Center X
   * @param y - Center Y
   * @param options - Burst configuration
   */
  emit(x: number, y: number, options: EmitOptions = {}): void {
    const count = options.count ?? 8;
    const color = options.color ?? "#00d4aa";
    const speed = options.speed ?? 60;
    const size = options.size ?? 2;
    const decay = options.decay ?? 0.02;
    const spread = options.spread ?? Math.PI * 2;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = (spread === Math.PI * 2)
        ? Math.random() * Math.PI * 2
        : -spread / 2 + Math.random() * spread;
      const v = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        color,
        size: size * (0.5 + Math.random() * 0.5),
        life: 1,
        decay: decay * (0.8 + Math.random() * 0.4),
      });
    }
  }

  /**
   * Emit a single particle that travels along an edge from `from` to `to`.
   * @param from - Start position
   * @param to - End position
   * @param color - Particle color
   * @param speed - Travel speed (0-1 per second, default 0.4)
   */
  emitAlongEdge(from: Vec2, to: Vec2, color: string, speed = 0.4): void {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push({
      x: from.x,
      y: from.y,
      vx: 0,
      vy: 0,
      color,
      size: 2.5,
      life: 1,
      decay: 0, // life managed by t
      edge: { from: { ...from }, to: { ...to } },
      t: 0,
      speed,
    });
  }

  /**
   * Update all particles: move free particles by velocity, advance edge particles
   * along their path, and remove dead ones.
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.edge && p.t !== undefined && p.speed !== undefined) {
        // Edge-traveling particle
        p.t += p.speed * dt;
        if (p.t >= 1) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x = p.edge.from.x + (p.edge.to.x - p.edge.from.x) * p.t;
        p.y = p.edge.from.y + (p.edge.to.y - p.edge.from.y) * p.t;
        // Slight glow pulse
        p.life = 1 - p.t * 0.3;
      } else {
        // Free-flying particle
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      }
    }
  }

  /**
   * Render all particles with soft glow (radial gradient).
   * @param ctx - Canvas 2D rendering context
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life);
      const r = p.size * (1 + (1 - alpha) * 0.5);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Soft glow via radial gradient
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      grad.addColorStop(0, p.color);
      grad.addColorStop(0.4, withAlpha(p.color, "88"));
      grad.addColorStop(1, withAlpha(p.color, "00"));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Solid core
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /** Remove all particles */
  clear(): void {
    this.particles.length = 0;
  }
}
