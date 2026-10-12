// 当たり判定と内外判定。距離は画面px で測る（docs/functional-design.md の「当たり判定」）
import type { Area, ImagePoint, Point, ScreenPoint, Viewport } from "./types";
import { pixelCenterToScreen } from "./viewport";

export const VERTEX_HIT_RADIUS_PX = 8;
export const EDGE_HIT_DISTANCE_PX = 6;
/** 押してから離すまでにこれ以上動いたらドラッグとみなす */
export const DRAG_THRESHOLD_PX = 4;

export const isDrag = (dx: number, dy: number): boolean =>
  Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

/** 最も近い頂点の番号。どれも 8画面px より遠ければ null */
export function hitVertex(
  points: readonly Point[],
  p: ScreenPoint,
  viewport: Viewport,
): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const s = pixelCenterToScreen(point, viewport);
    const distance = Math.hypot(s.x - p.x, s.y - p.y);
    if (distance <= VERTEX_HIT_RADIUS_PX && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function distanceToSegment(
  p: ScreenPoint,
  a: ScreenPoint,
  b: ScreenPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared),
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 最も近い辺の番号（i 番目の辺は i 番目の頂点から次の頂点まで）。どれも 6画面px より遠ければ null */
export function hitEdge(
  area: Area,
  p: ScreenPoint,
  viewport: Viewport,
): number | null {
  const screen = area.points.map((point) =>
    pixelCenterToScreen(point, viewport),
  );
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  screen.forEach((a, index) => {
    const b = screen[(index + 1) % screen.length];
    if (b === undefined) return;
    const distance = distanceToSegment(p, a, b);
    if (distance <= EDGE_HIT_DISTANCE_PX && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** 偶奇規則のレイキャスティング。頂点はピクセルの中心にあるものとして判定する */
export function isInsidePolygon(
  points: readonly Point[],
  p: ImagePoint,
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a === undefined || b === undefined) continue;
    const [ax, ay] = [a[0] + 0.5, a[1] + 0.5];
    const [bx, by] = [b[0] + 0.5, b[1] + 0.5];
    if (
      ay > p.y !== by > p.y &&
      p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** 点を内側に含むエリアの id。重なっている場合は後から作ったエリア */
export function hitArea(areas: readonly Area[], p: ImagePoint): string | null {
  for (let i = areas.length - 1; i >= 0; i--) {
    const area = areas[i];
    if (area !== undefined && isInsidePolygon(area.points, p)) return area.id;
  }
  return null;
}
