/**
 * Area42 Toast Notifications
 *
 * Floating notification toasts that appear, auto-dismiss, and stack.
 * Slides in, stays for duration, then fades out. Multiple toasts
 * stack vertically from the chosen corner.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface ToastOptions {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;   // ms, default 3000
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

interface ActiveToast {
  message: string;
  type: "info" | "success" | "warning" | "error";
  position: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  createdAt: number;
  duration: number;
  opacity: number;
  slideOffset: number;
  phase: "enter" | "visible" | "exit";
}

const TYPE_COLORS: Record<string, string> = {
  info: NeonTheme.accent2,
  success: NeonTheme.success,
  warning: NeonTheme.warning,
  error: NeonTheme.danger,
};

const TYPE_ICONS: Record<string, string> = {
  info: "i",
  success: "OK",
  warning: "!!",
  error: "X",
};

/**
 * Manages floating toast notifications rendered on a Canvas.
 *
 * Usage:
 * ```ts
 * const toasts = new ToastManager();
 * toasts.show({ message: "Routed to MoE via Spine", type: "info" });
 * // In render loop:
 * toasts.render(ctx, canvasWidth, canvasHeight);
 * ```
 */
export class ToastManager {
  private toasts: ActiveToast[] = [];
  private maxToasts = 8;

  constructor() {}

  /** Show a toast notification */
  show(options: ToastOptions): void {
    const toast: ActiveToast = {
      message: options.message,
      type: options.type ?? "info",
      position: options.position ?? "top-right",
      createdAt: Date.now(),
      duration: options.duration ?? 3000,
      opacity: 0,
      slideOffset: 60,
      phase: "enter",
    };

    this.toasts.push(toast);

    // Trim oldest if too many
    while (this.toasts.length > this.maxToasts) {
      this.toasts.shift();
    }
  }

  /**
   * Update and render all active toasts.
   * Call this every frame in your render loop.
   */
  render(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    const now = Date.now();
    const toRemove: number[] = [];

    // Group toasts by position
    const groups: Record<string, ActiveToast[]> = {
      "top-right": [],
      "bottom-right": [],
      "top-left": [],
      "bottom-left": [],
    };

    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      const elapsed = now - t.createdAt;

      // Phase transitions
      if (t.phase === "enter") {
        t.opacity = Math.min(1, t.opacity + 0.08);
        t.slideOffset = Math.max(0, t.slideOffset - 4);
        if (t.opacity >= 1 && t.slideOffset <= 0) {
          t.phase = "visible";
        }
      } else if (t.phase === "visible") {
        if (elapsed > t.duration) {
          t.phase = "exit";
        }
      } else if (t.phase === "exit") {
        t.opacity = Math.max(0, t.opacity - 0.06);
        t.slideOffset = Math.min(60, t.slideOffset + 3);
        if (t.opacity <= 0) {
          toRemove.push(i);
          continue;
        }
      }

      groups[t.position].push(t);
    }

    // Remove finished toasts (reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.toasts.splice(toRemove[i], 1);
    }

    // Render each group
    const margin = 16;
    const toastW = 280;
    const toastH = 38;
    const gap = 6;

    for (const [pos, group] of Object.entries(groups)) {
      if (group.length === 0) continue;

      const isRight = pos.includes("right");
      const isBottom = pos.includes("bottom");

      group.forEach((t, idx) => {
        const color = TYPE_COLORS[t.type];
        const icon = TYPE_ICONS[t.type];

        // Calculate position
        let x: number;
        if (isRight) {
          x = canvasW - margin - toastW + t.slideOffset;
        } else {
          x = margin - t.slideOffset;
        }

        let y: number;
        if (isBottom) {
          y = canvasH - margin - toastH - idx * (toastH + gap);
        } else {
          y = margin + idx * (toastH + gap);
        }

        ctx.save();
        ctx.globalAlpha = t.opacity;

        // Background
        const r = 6;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + toastW - r, y);
        ctx.quadraticCurveTo(x + toastW, y, x + toastW, y + r);
        ctx.lineTo(x + toastW, y + toastH - r);
        ctx.quadraticCurveTo(x + toastW, y + toastH, x + toastW - r, y + toastH);
        ctx.lineTo(x + r, y + toastH);
        ctx.quadraticCurveTo(x, y + toastH, x, y + toastH - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();

        ctx.fillStyle = NeonTheme.glass(0.88);
        ctx.fill();

        // Border
        ctx.strokeStyle = withAlpha(color, "44");
        ctx.lineWidth = 1;
        ctx.stroke();

        // Left color accent bar
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 4, 3, toastH - 8);

        // Icon circle
        const iconX = x + 18;
        const iconY = y + toastH / 2;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(color, "22");
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = "bold 8px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, iconX, iconY);

        // Message text
        ctx.fillStyle = NeonTheme.text;
        ctx.font = "10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Truncate if needed
        let msg = t.message;
        const maxW = toastW - 48;
        if (ctx.measureText(msg).width > maxW) {
          while (msg.length > 3 && ctx.measureText(msg + "...").width > maxW) {
            msg = msg.slice(0, -1);
          }
          msg += "...";
        }
        ctx.fillText(msg, x + 34, y + toastH / 2);

        // Progress bar (time remaining)
        if (t.phase !== "exit") {
          const elapsed = now - t.createdAt;
          const progress = Math.max(0, 1 - elapsed / t.duration);
          ctx.fillStyle = withAlpha(color, "33");
          ctx.fillRect(x + 4, y + toastH - 3, (toastW - 8) * progress, 2);
        }

        ctx.restore();
      });
    }
  }

  /** Get count of active toasts */
  get count(): number {
    return this.toasts.length;
  }

  /** Clear all toasts */
  clear(): void {
    for (const t of this.toasts) {
      t.phase = "exit";
    }
  }
}
