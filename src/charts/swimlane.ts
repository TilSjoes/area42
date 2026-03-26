/**
 * Area42 Swimlane Timeline
 *
 * A Gantt-style swimlane timeline rendered entirely in Canvas.
 * Supports grouped lanes, duration and point events, zoom/pan,
 * collapsible groups, hover highlighting, and a minimap.
 */

import { NeonTheme } from "../themes/neon.js";
import { withAlpha } from "../core/color.js";

export interface SwimlaneGroup {
  id: string;
  label: string;
  color?: string;
  collapsed?: boolean;
  lanes: SwimlaneLane[];
}

export interface SwimlaneLane {
  id: string;
  label: string;
  events: SwimlaneEvent[];
}

export interface SwimlaneEvent {
  id?: string;
  start: number;
  end?: number;
  label?: string;
  color?: string;
  shape?: "dot" | "rect" | "diamond";
  data?: any;
}

export interface SwimlaneOptions {
  laneHeight?: number;
  groupHeaderHeight?: number;
  labelWidth?: number;
  nowLineColor?: string;
  minimapHeight?: number;
  timeAxisHeight?: number;
}

interface HitTarget {
  group: SwimlaneGroup;
  lane: SwimlaneLane;
  event: SwimlaneEvent;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class Swimlane {
  groups: SwimlaneGroup[] = [];

  private viewStart = 0;
  private viewEnd = 0;
  private scrollY = 0;
  private laneHeight: number;
  private groupHeaderHeight: number;
  private labelWidth: number;
  private nowLineColor: string;
  private minimapHeight: number;
  private timeAxisHeight: number;

  private hoverLaneIndex = -1;
  private isPanning = false;
  private isMinimapDrag = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartViewStart = 0;
  private panStartViewEnd = 0;
  private scrollStartY = 0;
  private lastTouchDist = 0;

  private renderX = 0;
  private renderY = 0;
  private renderW = 0;
  private renderH = 0;

  private dataStart = 0;
  private dataEnd = 0;

  private attachedCanvas: HTMLCanvasElement | null = null;
  private boundHandlers: Map<string, EventListener> = new Map();

  constructor(options?: SwimlaneOptions) {
    this.laneHeight = options?.laneHeight ?? 24;
    this.groupHeaderHeight = options?.groupHeaderHeight ?? 28;
    this.labelWidth = options?.labelWidth ?? 120;
    this.nowLineColor = options?.nowLineColor ?? "#00d4aa";
    this.minimapHeight = options?.minimapHeight ?? 36;
    this.timeAxisHeight = options?.timeAxisHeight ?? 28;
  }

  setData(groups: SwimlaneGroup[]): void {
    this.groups = groups;
    this.computeDataRange();
  }

  private computeDataRange(): void {
    let min = Infinity;
    let max = -Infinity;
    for (const g of this.groups) {
      for (const l of g.lanes) {
        for (const e of l.events) {
          if (e.start < min) min = e.start;
          const eEnd = e.end ?? e.start;
          if (eEnd > max) max = eEnd;
        }
      }
    }
    if (min === Infinity) {
      const now = Date.now();
      min = now - 86400000;
      max = now;
    }
    const range = max - min || 86400000;
    this.dataStart = min - range * 0.02;
    this.dataEnd = max + range * 0.02;
  }

  setViewRange(start: number, end: number): void {
    this.viewStart = start;
    this.viewEnd = end;
  }

  zoom(delta: number, centerX: number, totalWidth: number): void {
    const timelineW = totalWidth - this.labelWidth;
    if (timelineW <= 0) return;
    const frac = Math.max(0, Math.min(1, (centerX - this.labelWidth) / timelineW));
    const range = this.viewEnd - this.viewStart;
    const centerTime = this.viewStart + frac * range;
    const factor = delta > 0 ? 0.85 : 1.18;
    const newRange = Math.max(60000, Math.min(this.dataEnd - this.dataStart, range * factor));
    this.viewStart = centerTime - frac * newRange;
    this.viewEnd = centerTime + (1 - frac) * newRange;
  }

  pan(deltaX: number, totalWidth: number): void {
    const timelineW = totalWidth - this.labelWidth;
    if (timelineW <= 0) return;
    const range = this.viewEnd - this.viewStart;
    const shift = (deltaX / timelineW) * range;
    this.viewStart -= shift;
    this.viewEnd -= shift;
  }

  scroll(deltaY: number): void {
    this.scrollY = Math.max(0, this.scrollY + deltaY);
  }

  fit(_totalWidth: number): void {
    this.viewStart = this.dataStart;
    this.viewEnd = this.dataEnd;
    this.scrollY = 0;
  }

  toggleGroup(groupId: string): void {
    const g = this.groups.find(gr => gr.id === groupId);
    if (g) g.collapsed = !g.collapsed;
  }

  findEventAt(x: number, y: number, totalWidth: number): HitTarget | null {
    const timelineX = this.renderX + this.labelWidth;
    const timelineW = totalWidth - this.labelWidth;
    if (timelineW <= 0) return null;
    const contentY = this.renderY + this.timeAxisHeight;
    const contentH = this.renderH - this.timeAxisHeight - this.minimapHeight;
    if (y < contentY || y > contentY + contentH) return null;

    let rowY = contentY - this.scrollY;
    for (const g of this.groups) {
      rowY += this.groupHeaderHeight;
      if (g.collapsed) continue;
      for (const l of g.lanes) {
        const laneTop = rowY;
        const laneBot = rowY + this.laneHeight;
        rowY += this.laneHeight;
        if (y < laneTop || y > laneBot) continue;
        if (x < timelineX) continue;
        for (const e of l.events) {
          const range = this.viewEnd - this.viewStart;
          const ex = timelineX + ((e.start - this.viewStart) / range) * timelineW;
          if (e.end && e.end > e.start) {
            const ex2 = timelineX + ((e.end - this.viewStart) / range) * timelineW;
            const ew = Math.max(4, ex2 - ex);
            if (x >= ex && x <= ex + ew) return { group: g, lane: l, event: e };
          } else {
            if (Math.abs(x - ex) < 8 && Math.abs(y - (laneTop + this.laneHeight / 2)) < 8) {
              return { group: g, lane: l, event: e };
            }
          }
        }
      }
    }
    return null;
  }

  attach(canvas: HTMLCanvasElement, onEventClick?: (hit: HitTarget) => void): void {
    this.detach();
    this.attachedCanvas = canvas;

    const getXY = (e: MouseEvent | Touch): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [
        (e.clientX - rect.left) * (canvas.width / rect.width),
        (e.clientY - rect.top) * (canvas.height / rect.height),
      ];
    };

    const onWheel = (ev: Event) => {
      const e = ev as WheelEvent;
      e.preventDefault();
      const [mx] = getXY(e);
      if (mx < this.renderX + this.labelWidth) {
        this.scroll(e.deltaY * 0.5);
      } else {
        this.zoom(e.deltaY > 0 ? 1 : -1, mx - this.renderX, this.renderW);
      }
    };

    const onMouseDown = (ev: Event) => {
      const e = ev as MouseEvent;
      const [mx, my] = getXY(e);
      const minimapY = this.renderY + this.renderH - this.minimapHeight;
      if (my >= minimapY && mx >= this.renderX + this.labelWidth) {
        this.isMinimapDrag = true;
        this.handleMinimapDrag(mx);
        return;
      }
      const groupHit = this.findGroupHeaderAt(mx, my);
      if (groupHit) { this.toggleGroup(groupHit.id); return; }
      this.isPanning = true;
      this.dragStartX = mx;
      this.dragStartY = my;
      this.panStartViewStart = this.viewStart;
      this.panStartViewEnd = this.viewEnd;
      this.scrollStartY = this.scrollY;
    };

    const onMouseMove = (ev: Event) => {
      const e = ev as MouseEvent;
      const [mx, my] = getXY(e);
      if (this.isMinimapDrag) { this.handleMinimapDrag(mx); return; }
      if (this.isPanning) {
        const dx = mx - this.dragStartX;
        const dy = my - this.dragStartY;
        const timelineW = this.renderW - this.labelWidth;
        if (timelineW > 0) {
          const range = this.panStartViewEnd - this.panStartViewStart;
          const timeShift = (dx / timelineW) * range;
          this.viewStart = this.panStartViewStart - timeShift;
          this.viewEnd = this.panStartViewEnd - timeShift;
        }
        this.scrollY = Math.max(0, this.scrollStartY - dy);
        return;
      }
      this.hoverLaneIndex = this.findLaneIndexAt(my);
    };

    const onMouseUp = () => { this.isPanning = false; this.isMinimapDrag = false; };

    const onClick = (ev: Event) => {
      const e = ev as MouseEvent;
      const [mx, my] = getXY(e);
      if (onEventClick) {
        const hit = this.findEventAt(mx, my, this.renderW);
        if (hit) onEventClick(hit);
      }
    };

    const onTouchStart = (ev: Event) => {
      const e = ev as TouchEvent;
      e.preventDefault();
      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      } else if (e.touches.length === 1) {
        const [mx, my] = getXY(e.touches[0]);
        this.isPanning = true;
        this.dragStartX = mx;
        this.dragStartY = my;
        this.panStartViewStart = this.viewStart;
        this.panStartViewEnd = this.viewEnd;
        this.scrollStartY = this.scrollY;
      }
    };

    const onTouchMove = (ev: Event) => {
      const e = ev as TouchEvent;
      e.preventDefault();
      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const center = (t0.clientX + t1.clientX) / 2;
        const rect = canvas.getBoundingClientRect();
        const centerX = (center - rect.left) * (canvas.width / rect.width);
        if (this.lastTouchDist > 0) {
          const scale = dist / this.lastTouchDist;
          if (scale > 1.02) this.zoom(-1, centerX - this.renderX, this.renderW);
          else if (scale < 0.98) this.zoom(1, centerX - this.renderX, this.renderW);
        }
        this.lastTouchDist = dist;
        this.isPanning = false;
      } else if (e.touches.length === 1 && this.isPanning) {
        const [mx, my] = getXY(e.touches[0]);
        const dx = mx - this.dragStartX;
        const dy = my - this.dragStartY;
        const timelineW = this.renderW - this.labelWidth;
        if (timelineW > 0) {
          const range = this.panStartViewEnd - this.panStartViewStart;
          const timeShift = (dx / timelineW) * range;
          this.viewStart = this.panStartViewStart - timeShift;
          this.viewEnd = this.panStartViewEnd - timeShift;
        }
        this.scrollY = Math.max(0, this.scrollStartY - dy);
      }
    };

    const onTouchEnd = () => { this.isPanning = false; this.lastTouchDist = 0; };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    this.boundHandlers.set("wheel", onWheel);
    this.boundHandlers.set("mousedown", onMouseDown);
    this.boundHandlers.set("mousemove", onMouseMove);
    this.boundHandlers.set("mouseup", onMouseUp);
    this.boundHandlers.set("click", onClick);
    this.boundHandlers.set("touchstart", onTouchStart);
    this.boundHandlers.set("touchmove", onTouchMove);
    this.boundHandlers.set("touchend", onTouchEnd);
  }

  detach(): void {
    if (this.attachedCanvas) {
      for (const [type, handler] of this.boundHandlers) {
        this.attachedCanvas.removeEventListener(type, handler);
      }
      this.boundHandlers.clear();
      this.attachedCanvas = null;
    }
  }

  private handleMinimapDrag(mx: number): void {
    const minimapX = this.renderX + this.labelWidth;
    const minimapW = this.renderW - this.labelWidth;
    if (minimapW <= 0) return;
    const dataRange = this.dataEnd - this.dataStart;
    const viewRange = this.viewEnd - this.viewStart;
    const frac = Math.max(0, Math.min(1, (mx - minimapX) / minimapW));
    const center = this.dataStart + frac * dataRange;
    this.viewStart = center - viewRange / 2;
    this.viewEnd = center + viewRange / 2;
  }

  private findGroupHeaderAt(mx: number, my: number): SwimlaneGroup | null {
    let rowY = this.renderY + this.timeAxisHeight - this.scrollY;
    for (const g of this.groups) {
      if (my >= rowY && my < rowY + this.groupHeaderHeight && mx < this.renderX + this.labelWidth + 200) {
        return g;
      }
      rowY += this.groupHeaderHeight;
      if (!g.collapsed) rowY += g.lanes.length * this.laneHeight;
    }
    return null;
  }

  private findLaneIndexAt(my: number): number {
    let rowY = this.renderY + this.timeAxisHeight - this.scrollY;
    let idx = 0;
    for (const g of this.groups) {
      rowY += this.groupHeaderHeight;
      if (g.collapsed) { idx++; continue; }
      for (let i = 0; i < g.lanes.length; i++) {
        if (my >= rowY && my < rowY + this.laneHeight) return idx;
        rowY += this.laneHeight;
        idx++;
      }
    }
    return -1;
  }

  private getTimeIntervals(rangeMs: number): { step: number; format: (d: Date) => string; subStep?: number } {
    const MINUTE = 60000, HOUR = 3600000, DAY = 86400000, WEEK = 7 * DAY, MONTH = 30 * DAY;
    if (rangeMs < HOUR * 2) {
      return { step: MINUTE * 5, subStep: MINUTE, format: (d) => d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0") };
    }
    if (rangeMs < HOUR * 12) {
      return { step: HOUR, subStep: MINUTE * 15, format: (d) => d.getHours().toString().padStart(2, "0") + ":00" };
    }
    if (rangeMs < DAY * 3) {
      return {
        step: HOUR * 6, subStep: HOUR,
        format: (d) => {
          const h = d.getHours();
          return h === 0 ? d.getDate() + " " + MONTHS[d.getMonth()] : h.toString().padStart(2, "0") + ":00";
        },
      };
    }
    if (rangeMs < WEEK * 4) {
      return { step: DAY, subStep: HOUR * 6, format: (d) => d.getDate() + " " + MONTHS[d.getMonth()] };
    }
    if (rangeMs < MONTH * 6) {
      return { step: WEEK, subStep: DAY, format: (d) => d.getDate() + " " + MONTHS[d.getMonth()] };
    }
    return { step: MONTH, subStep: WEEK, format: (d) => MONTHS[d.getMonth()] + " " + d.getFullYear() };
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    this.renderX = x;
    this.renderY = y;
    this.renderW = w;
    this.renderH = h;

    if (this.viewStart === 0 && this.viewEnd === 0) {
      this.viewStart = this.dataStart;
      this.viewEnd = this.dataEnd;
    }

    const timelineX = x + this.labelWidth;
    const timelineW = w - this.labelWidth;
    const contentY = y + this.timeAxisHeight;
    const contentH = h - this.timeAxisHeight - this.minimapHeight;
    const range = this.viewEnd - this.viewStart;
    if (timelineW <= 0 || contentH <= 0) return;

    ctx.save();
    ctx.fillStyle = NeonTheme.bg;
    ctx.fillRect(x, y, w, h);

    // Time axis
    this.renderTimeAxis(ctx, timelineX, y, timelineW, this.timeAxisHeight, range);

    // Content area (clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, contentY, w, contentH);
    ctx.clip();

    this.renderGridLines(ctx, timelineX, contentY, timelineW, contentH, range);

    let rowY = contentY - this.scrollY;
    let globalLaneIdx = 0;
    for (const group of this.groups) {
      if (rowY + this.groupHeaderHeight > contentY - 50 && rowY < contentY + contentH + 50) {
        this.renderGroupHeader(ctx, group, x, rowY, w);
      }
      rowY += this.groupHeaderHeight;
      if (group.collapsed) { globalLaneIdx++; continue; }
      for (const lane of group.lanes) {
        if (rowY + this.laneHeight > contentY && rowY < contentY + contentH) {
          if (globalLaneIdx === this.hoverLaneIndex) {
            ctx.fillStyle = withAlpha(NeonTheme.accent, "0a");
            ctx.fillRect(x, rowY, w, this.laneHeight);
          }
          if (globalLaneIdx % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.012)";
            ctx.fillRect(timelineX, rowY, timelineW, this.laneHeight);
          }
          ctx.strokeStyle = withAlpha(NeonTheme.border, "40");
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, rowY + this.laneHeight);
          ctx.lineTo(x + w, rowY + this.laneHeight);
          ctx.stroke();
          for (const event of lane.events) {
            this.renderEvent(ctx, event, group, timelineX, rowY, timelineW, range);
          }
        }
        rowY += this.laneHeight;
        globalLaneIdx++;
      }
    }

    this.renderNowLine(ctx, timelineX, contentY, timelineW, contentH, range);
    ctx.restore(); // un-clip content

    // Label column background (covers content bleed)
    ctx.fillStyle = NeonTheme.bg;
    ctx.fillRect(x, contentY, this.labelWidth - 1, contentH);

    // Labels on top of background
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, contentY, this.labelWidth, contentH);
    ctx.clip();
    rowY = contentY - this.scrollY;
    globalLaneIdx = 0;
    for (const group of this.groups) {
      if (rowY + this.groupHeaderHeight > contentY - 50 && rowY < contentY + contentH + 50) {
        this.renderGroupHeader(ctx, group, x, rowY, w);
      }
      rowY += this.groupHeaderHeight;
      if (group.collapsed) { globalLaneIdx++; continue; }
      for (const lane of group.lanes) {
        if (rowY + this.laneHeight > contentY && rowY < contentY + contentH) {
          this.renderLaneLabel(ctx, lane, x, rowY);
        }
        rowY += this.laneHeight;
        globalLaneIdx++;
      }
    }
    ctx.restore();

    // Label/timeline separator
    ctx.strokeStyle = withAlpha(NeonTheme.border, "80");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + this.labelWidth, y);
    ctx.lineTo(x + this.labelWidth, y + h - this.minimapHeight);
    ctx.stroke();

    // Minimap
    this.renderMinimap(ctx, timelineX, y + h - this.minimapHeight, timelineW, this.minimapHeight);

    // Minimap label area
    ctx.fillStyle = NeonTheme.bg;
    ctx.fillRect(x, y + h - this.minimapHeight, this.labelWidth, this.minimapHeight);
    ctx.fillStyle = NeonTheme.textDim;
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OVERVIEW", x + this.labelWidth / 2, y + h - this.minimapHeight / 2);
    ctx.textAlign = "left";

    // Outer border
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.restore();
  }

  private renderTimeAxis(ctx: CanvasRenderingContext2D, tx: number, ty: number, tw: number, th: number, range: number): void {
    ctx.fillStyle = withAlpha(NeonTheme.bg, "ee");
    ctx.fillRect(tx - this.labelWidth, ty, tw + this.labelWidth, th);
    const intervals = this.getTimeIntervals(range);
    if (intervals.subStep) {
      ctx.strokeStyle = withAlpha(NeonTheme.border, "18");
      ctx.lineWidth = 0.5;
      const subFirst = Math.ceil(this.viewStart / intervals.subStep) * intervals.subStep;
      for (let t = subFirst; t <= this.viewEnd; t += intervals.subStep) {
        const px = tx + ((t - this.viewStart) / range) * tw;
        ctx.beginPath(); ctx.moveTo(px, ty + th - 4); ctx.lineTo(px, ty + th); ctx.stroke();
      }
    }
    const firstTick = Math.ceil(this.viewStart / intervals.step) * intervals.step;
    ctx.fillStyle = NeonTheme.textDim;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.strokeStyle = withAlpha(NeonTheme.border, "40");
    ctx.lineWidth = 0.5;
    for (let t = firstTick; t <= this.viewEnd; t += intervals.step) {
      const px = tx + ((t - this.viewStart) / range) * tw;
      ctx.fillText(intervals.format(new Date(t)), px, ty + th - 2);
      ctx.beginPath(); ctx.moveTo(px, ty + th - 1); ctx.lineTo(px, ty + th); ctx.stroke();
    }
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx - this.labelWidth, ty + th); ctx.lineTo(tx + tw, ty + th); ctx.stroke();
  }

  private renderGridLines(ctx: CanvasRenderingContext2D, tx: number, cy: number, tw: number, ch: number, range: number): void {
    const intervals = this.getTimeIntervals(range);
    const firstTick = Math.ceil(this.viewStart / intervals.step) * intervals.step;
    ctx.strokeStyle = withAlpha(NeonTheme.border, "15");
    ctx.lineWidth = 0.5;
    for (let t = firstTick; t <= this.viewEnd; t += intervals.step) {
      const px = tx + ((t - this.viewStart) / range) * tw;
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, cy + ch); ctx.stroke();
    }
  }

  private renderGroupHeader(ctx: CanvasRenderingContext2D, group: SwimlaneGroup, x: number, rowY: number, w: number): void {
    const color = group.color ?? NeonTheme.accent;
    ctx.fillStyle = withAlpha(color, "0c");
    ctx.fillRect(x, rowY, w, this.groupHeaderHeight);
    ctx.strokeStyle = withAlpha(color, "30");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rowY + this.groupHeaderHeight);
    ctx.lineTo(x + w, rowY + this.groupHeaderHeight);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = color;
    const triX = x + 10;
    const triY = rowY + this.groupHeaderHeight / 2;
    ctx.beginPath();
    if (group.collapsed) {
      ctx.moveTo(triX, triY - 4);
      ctx.lineTo(triX + 6, triY);
      ctx.lineTo(triX, triY + 4);
    } else {
      ctx.moveTo(triX - 2, triY - 3);
      ctx.lineTo(triX + 4, triY - 3);
      ctx.lineTo(triX + 1, triY + 3);
    }
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(group.label, x + 22, triY);

    let count = 0;
    for (const l of group.lanes) count += l.events.length;
    ctx.fillStyle = NeonTheme.textDim;
    ctx.font = "9px system-ui";
    const labelW = ctx.measureText(group.label).width;
    ctx.fillText("(" + count + ")", x + 26 + labelW, triY);

    if (group.collapsed) {
      ctx.fillStyle = withAlpha(color, "60");
      ctx.fillText(group.lanes.length + " lanes", x + 30 + labelW + ctx.measureText("(" + count + ")").width, triY);
    }
    ctx.restore();
  }

  private renderLaneLabel(ctx: CanvasRenderingContext2D, lane: SwimlaneLane, x: number, rowY: number): void {
    ctx.fillStyle = NeonTheme.text;
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const label = lane.label.length > 14 ? lane.label.slice(0, 13) + "\u2026" : lane.label;
    ctx.fillText(label, x + 14, rowY + this.laneHeight / 2);
  }

  private renderEvent(ctx: CanvasRenderingContext2D, event: SwimlaneEvent, group: SwimlaneGroup, tx: number, rowY: number, tw: number, range: number): void {
    const color = event.color ?? group.color ?? NeonTheme.accent;
    const shape = event.shape ?? "dot";
    const cy = rowY + this.laneHeight / 2;
    const startFrac = (event.start - this.viewStart) / range;
    const ex = tx + startFrac * tw;

    if (event.end) {
      const endFrac = (event.end - this.viewStart) / range;
      if (endFrac < -0.01 || startFrac > 1.01) return;
    } else {
      if (startFrac < -0.01 || startFrac > 1.01) return;
    }

    ctx.save();

    if (shape === "rect" && event.end && event.end > event.start) {
      const endFrac = (event.end - this.viewStart) / range;
      const ex2 = tx + endFrac * tw;
      const ew = Math.max(4, ex2 - ex);
      const eh = this.laneHeight - 6;
      const ey = rowY + 3;
      const r = 3;
      ctx.fillStyle = withAlpha(color, "40");
      ctx.strokeStyle = withAlpha(color, "90");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex + r, ey);
      ctx.lineTo(ex + ew - r, ey);
      ctx.quadraticCurveTo(ex + ew, ey, ex + ew, ey + r);
      ctx.lineTo(ex + ew, ey + eh - r);
      ctx.quadraticCurveTo(ex + ew, ey + eh, ex + ew - r, ey + eh);
      ctx.lineTo(ex + r, ey + eh);
      ctx.quadraticCurveTo(ex, ey + eh, ex, ey + eh - r);
      ctx.lineTo(ex, ey + r);
      ctx.quadraticCurveTo(ex, ey, ex + r, ey);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (event.label && ew > 40) {
        ctx.fillStyle = NeonTheme.text;
        ctx.font = "9px system-ui";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.beginPath();
        ctx.rect(ex + 2, ey, ew - 4, eh);
        ctx.clip();
        ctx.fillText(event.label, ex + 4, cy);
        ctx.restore();
      }
    } else if (shape === "diamond") {
      const size = 5;
      ctx.fillStyle = withAlpha(color, "80");
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ex, cy - size);
      ctx.lineTo(ex + size, cy);
      ctx.lineTo(ex, cy + size);
      ctx.lineTo(ex - size, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Dot (default for commits)
      const radius = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private renderNowLine(ctx: CanvasRenderingContext2D, tx: number, cy: number, tw: number, ch: number, range: number): void {
    const now = Date.now();
    if (now < this.viewStart || now > this.viewEnd) return;
    const frac = (now - this.viewStart) / range;
    const px = tx + frac * tw;
    ctx.save();
    ctx.strokeStyle = this.nowLineColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(px, cy + ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = this.nowLineColor;
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("NOW", px, cy - 1);
    ctx.beginPath();
    ctx.arc(px, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = this.nowLineColor;
    ctx.shadowColor = this.nowLineColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, mx: number, my: number, mw: number, mh: number): void {
    const dataRange = this.dataEnd - this.dataStart;
    if (dataRange <= 0) return;
    ctx.save();
    ctx.fillStyle = withAlpha(NeonTheme.surface, "cc");
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = NeonTheme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + mw, my);
    ctx.stroke();

    // Event density heatmap
    const buckets = Math.min(200, Math.floor(mw));
    const bucketCounts = new Float32Array(buckets);
    let maxCount = 0;
    for (const group of this.groups) {
      for (const lane of group.lanes) {
        for (const event of lane.events) {
          const sf = (event.start - this.dataStart) / dataRange;
          const ef = event.end ? (event.end - this.dataStart) / dataRange : sf;
          const b1 = Math.max(0, Math.min(buckets - 1, Math.floor(sf * buckets)));
          const b2 = Math.max(0, Math.min(buckets - 1, Math.floor(ef * buckets)));
          for (let b = b1; b <= b2; b++) bucketCounts[b]++;
        }
      }
    }
    for (let b = 0; b < buckets; b++) {
      if (bucketCounts[b] > maxCount) maxCount = bucketCounts[b];
    }

    if (maxCount > 0) {
      const barW = mw / buckets;
      for (let b = 0; b < buckets; b++) {
        if (bucketCounts[b] === 0) continue;
        const intensity = bucketCounts[b] / maxCount;
        const barH = intensity * (mh - 8);
        ctx.fillStyle = withAlpha(NeonTheme.accent, Math.round(intensity * 100 + 30).toString(16).padStart(2, "0"));
        ctx.fillRect(mx + b * barW, my + mh - 4 - barH, barW + 0.5, barH);
      }
    }

    // Viewport indicator
    const vpLeft = ((this.viewStart - this.dataStart) / dataRange) * mw;
    const vpRight = ((this.viewEnd - this.dataStart) / dataRange) * mw;
    const vpW = Math.max(4, vpRight - vpLeft);
    ctx.fillStyle = withAlpha(NeonTheme.accent, "18");
    ctx.fillRect(mx + vpLeft, my + 1, vpW, mh - 2);
    ctx.strokeStyle = withAlpha(NeonTheme.accent, "80");
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx + vpLeft + 0.5, my + 1.5, vpW - 1, mh - 3);

    // Now marker
    const now = Date.now();
    const nowFrac = (now - this.dataStart) / dataRange;
    if (nowFrac >= 0 && nowFrac <= 1) {
      const nowPx = mx + nowFrac * mw;
      ctx.strokeStyle = this.nowLineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nowPx, my + 2);
      ctx.lineTo(nowPx, my + mh - 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // ============================================================
  // REPLAY MODE
  // ============================================================

  private replayIndex = -1;
  private replayIsPlaying = false;
  private replaySpeed = 1;
  private replayAnimFrame: number | null = null;
  private replayLastTime = 0;
  private replayMsPerEvent = 500;
  private replayAccum = 0;
  private replaySortedEvents: { time: number; event: SwimlaneEvent; group: SwimlaneGroup; lane: SwimlaneLane }[] = [];
  private replayControlsHeight = 36;

  /** Callback fired when replay cursor passes an event */
  onReplayEvent: ((event: SwimlaneEvent, group: SwimlaneGroup, lane: SwimlaneLane) => void) | null = null;

  /** Get sorted flat list of all events */
  private buildReplayEvents(): void {
    this.replaySortedEvents = [];
    for (const g of this.groups) {
      for (const l of g.lanes) {
        for (const e of l.events) {
          this.replaySortedEvents.push({ time: e.start, event: e, group: g, lane: l });
        }
      }
    }
    this.replaySortedEvents.sort((a, b) => a.time - b.time);
  }

  /** Start replay from the beginning */
  startReplay(): void {
    this.buildReplayEvents();
    if (this.replaySortedEvents.length === 0) return;
    this.replayIndex = -1;
    this.replayIsPlaying = true;
    this.replayAccum = 0;
    this.replayLastTime = performance.now();
    // Zoom to full range
    this.viewStart = this.dataStart;
    this.viewEnd = this.dataEnd;
    this.replayTick();
  }

  /** Stop replay */
  stopReplay(): void {
    this.replayIsPlaying = false;
    if (this.replayAnimFrame !== null) {
      cancelAnimationFrame(this.replayAnimFrame);
      this.replayAnimFrame = null;
    }
  }

  /** Step forward one event */
  stepForward(): void {
    if (this.replaySortedEvents.length === 0) this.buildReplayEvents();
    if (this.replayIndex < this.replaySortedEvents.length - 1) {
      this.replayIndex++;
      this.emitReplayEvent();
    }
  }

  /** Step backward one event */
  stepBackward(): void {
    if (this.replayIndex > 0) {
      this.replayIndex--;
    }
  }

  /** Set playback speed multiplier */
  setPlaybackSpeed(speed: number): void {
    this.replaySpeed = speed;
  }

  /** Get current replay state */
  getReplayState(): { isPlaying: boolean; index: number; total: number; speed: number } {
    return {
      isPlaying: this.replayIsPlaying,
      index: this.replayIndex,
      total: this.replaySortedEvents.length,
      speed: this.replaySpeed,
    };
  }

  /** Internal animation tick for replay */
  private replayTick(): void {
    if (!this.replayIsPlaying) return;

    const now = performance.now();
    const dt = now - this.replayLastTime;
    this.replayLastTime = now;
    this.replayAccum += dt * this.replaySpeed;

    while (this.replayAccum >= this.replayMsPerEvent && this.replayIndex < this.replaySortedEvents.length - 1) {
      this.replayAccum -= this.replayMsPerEvent;
      this.replayIndex++;
      this.emitReplayEvent();
    }

    if (this.replayIndex >= this.replaySortedEvents.length - 1) {
      this.replayIsPlaying = false;
      return;
    }

    this.replayAnimFrame = requestAnimationFrame(() => this.replayTick());
  }

  /** Emit the current replay event callback */
  private emitReplayEvent(): void {
    if (this.replayIndex >= 0 && this.replayIndex < this.replaySortedEvents.length) {
      const entry = this.replaySortedEvents[this.replayIndex];
      if (this.onReplayEvent) {
        this.onReplayEvent(entry.event, entry.group, entry.lane);
      }
    }
  }

  /** Get the current replay cursor time (for rendering) */
  getReplayCursorTime(): number | null {
    if (this.replayIndex < 0 || this.replayIndex >= this.replaySortedEvents.length) return null;
    return this.replaySortedEvents[this.replayIndex].time;
  }

  /** Render replay cursor and controls overlay */
  renderReplayOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const cursorTime = this.getReplayCursorTime();
    if (cursorTime === null && !this.replayIsPlaying && this.replayIndex < 0) return;

    const timelineX = x + this.labelWidth;
    const timelineW = w - this.labelWidth;
    const contentY = y + this.timeAxisHeight;
    const contentH = h - this.timeAxisHeight - this.minimapHeight;
    const range = this.viewEnd - this.viewStart;

    // Draw replay cursor line
    if (cursorTime !== null && range > 0) {
      const frac = (cursorTime - this.viewStart) / range;
      const px = timelineX + frac * timelineW;

      if (frac >= 0 && frac <= 1) {
        ctx.save();
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#ff6b6b";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(px, contentY);
        ctx.lineTo(px, contentY + contentH);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cursor head triangle
        ctx.fillStyle = "#ff6b6b";
        ctx.beginPath();
        ctx.moveTo(px - 5, contentY);
        ctx.lineTo(px + 5, contentY);
        ctx.lineTo(px, contentY + 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Highlight events up to cursor
      if (this.replayIndex >= 0) {
        ctx.save();
        for (let i = Math.max(0, this.replayIndex - 2); i <= this.replayIndex; i++) {
          if (i >= this.replaySortedEvents.length) break;
          const entry = this.replaySortedEvents[i];
          const eFrac = (entry.time - this.viewStart) / range;
          if (eFrac < 0 || eFrac > 1) continue;
          const ex = timelineX + eFrac * timelineW;
          const intensity = i === this.replayIndex ? 1.0 : 0.5;

          ctx.beginPath();
          ctx.arc(ex, contentY + contentH / 2, 6 * intensity + 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 107, 107, " + (0.3 * intensity) + ")";
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Playback controls bar
    const ctrlY = y + h - this.minimapHeight - this.replayControlsHeight;
    const ctrlH = this.replayControlsHeight;

    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 23, 0.9)";
    ctx.fillRect(x, ctrlY, w, ctrlH);
    ctx.strokeStyle = "rgba(255, 107, 107, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, ctrlY);
    ctx.lineTo(x + w, ctrlY);
    ctx.stroke();

    // Control buttons
    const btnSize = 20;
    const btnGap = 8;
    const centerX = x + w / 2;
    const btnY = ctrlY + (ctrlH - btnSize) / 2;

    const buttons = [
      { label: "|<<", x: centerX - btnSize * 2.5 - btnGap * 2, action: "first" },
      { label: "<<",  x: centerX - btnSize * 1.5 - btnGap, action: "prev" },
      { label: this.replayIsPlaying ? "||" : ">", x: centerX - btnSize / 2, action: "toggle" },
      { label: ">>",  x: centerX + btnSize * 0.5 + btnGap, action: "next" },
      { label: ">>|", x: centerX + btnSize * 1.5 + btnGap * 2, action: "last" },
    ];

    for (const btn of buttons) {
      // Button background
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fillRect(btn.x, btnY, btnSize, btnSize);
      ctx.strokeStyle = "rgba(255, 107, 107, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(btn.x, btnY, btnSize, btnSize);

      // Button text
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.label, btn.x + btnSize / 2, btnY + btnSize / 2);
    }

    // Speed selector
    const speeds = [0.5, 1, 2, 5, 10];
    const speedX = centerX + btnSize * 3 + btnGap * 3;
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "8px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("SPEED:", speedX, ctrlY + ctrlH / 2);

    let sx = speedX + 42;
    for (const spd of speeds) {
      const isActive = Math.abs(this.replaySpeed - spd) < 0.01;
      ctx.fillStyle = isActive ? "#ff6b6b" : "rgba(255,255,255,0.3)";
      ctx.font = isActive ? "bold 9px system-ui" : "9px system-ui";
      ctx.fillText(spd + "x", sx, ctrlY + ctrlH / 2);
      sx += 30;
    }

    // Progress indicator
    const progressX = x + 10;
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "9px system-ui";
    ctx.textAlign = "left";
    const total = this.replaySortedEvents.length;
    const current = Math.max(0, this.replayIndex + 1);
    ctx.fillText("Event " + current + "/" + total, progressX, ctrlY + ctrlH / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  /** Handle click on replay controls. Returns true if consumed. */
  handleReplayClick(mx: number, my: number, totalW: number, totalH: number, renderX: number, renderY: number): boolean {
    const ctrlY = renderY + totalH - this.minimapHeight - this.replayControlsHeight;
    const ctrlH = this.replayControlsHeight;

    if (my < ctrlY || my > ctrlY + ctrlH) return false;

    const btnSize = 20;
    const btnGap = 8;
    const centerX = renderX + totalW / 2;
    const btnY = ctrlY + (ctrlH - btnSize) / 2;

    const buttons = [
      { x: centerX - btnSize * 2.5 - btnGap * 2, action: "first" },
      { x: centerX - btnSize * 1.5 - btnGap, action: "prev" },
      { x: centerX - btnSize / 2, action: "toggle" },
      { x: centerX + btnSize * 0.5 + btnGap, action: "next" },
      { x: centerX + btnSize * 1.5 + btnGap * 2, action: "last" },
    ];

    for (const btn of buttons) {
      if (mx >= btn.x && mx <= btn.x + btnSize && my >= btnY && my <= btnY + btnSize) {
        switch (btn.action) {
          case "first":
            this.replayIndex = 0;
            this.emitReplayEvent();
            break;
          case "prev":
            this.stepBackward();
            break;
          case "toggle":
            if (this.replayIsPlaying) {
              this.stopReplay();
            } else {
              if (this.replayIndex >= this.replaySortedEvents.length - 1) {
                this.replayIndex = -1;
              }
              this.replayIsPlaying = true;
              this.replayAccum = 0;
              this.replayLastTime = performance.now();
              this.replayTick();
            }
            break;
          case "next":
            this.stepForward();
            break;
          case "last":
            this.replayIndex = this.replaySortedEvents.length - 1;
            this.emitReplayEvent();
            break;
        }
        return true;
      }
    }

    // Speed buttons
    const speeds = [0.5, 1, 2, 5, 10];
    const speedX = centerX + btnSize * 3 + btnGap * 3 + 42;
    let sx = speedX;
    for (const spd of speeds) {
      if (mx >= sx - 5 && mx <= sx + 25 && my >= ctrlY && my <= ctrlY + ctrlH) {
        this.setPlaybackSpeed(spd);
        return true;
      }
      sx += 30;
    }

    return false;
  }

}
