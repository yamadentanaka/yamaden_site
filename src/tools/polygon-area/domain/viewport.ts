// 座標変換・拡大縮小・全体表示。数値は docs/functional-design.md の「座標変換と丸め」「拡大縮小」
import { imagePoint, screenPoint } from "./types";
import type {
  ImageInfo,
  ImagePoint,
  Point,
  ScreenPoint,
  Size,
  Viewport,
} from "./types";

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 32;
/** マウスホイール1段階（約100画面px）あたりの拡大率 */
export const WHEEL_ZOOM_STEP = 1.2;
const WHEEL_DELTA_PER_STEP_PX = 100;
/** deltaMode が行単位・ページ単位のときの、画面px への換算 */
const WHEEL_LINE_PX = 40;
const WHEEL_PAGE_PX = 800;
/** 全体表示で画像の周りに残す余白の割合 */
const FIT_MARGIN_RATIO = 0.95;

export const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export function screenToImage(p: ScreenPoint, viewport: Viewport): ImagePoint {
  return imagePoint(
    (p.x - viewport.offsetX) / viewport.scale,
    (p.y - viewport.offsetY) / viewport.scale,
  );
}

/** ピクセルの中心（頂点を描く位置）の画面座標 */
export function pixelCenterToScreen(
  point: Point,
  viewport: Viewport,
): ScreenPoint {
  return screenPoint(
    (point[0] + 0.5) * viewport.scale + viewport.offsetX,
    (point[1] + 0.5) * viewport.scale + viewport.offsetY,
  );
}

/** 画像座標をピクセル座標にする。画像の外なら null */
export function toPixel(p: ImagePoint, image: ImageInfo): Point | null {
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1)
    return null;
  return [x, y];
}

/** 画像座標をピクセル座標にし、画像の外なら画像の端に寄せる */
export function clampToImage(p: ImagePoint, image: ImageInfo): Point {
  const clamp = (v: number, max: number) =>
    Math.min(max, Math.max(0, Math.floor(v)));
  return [clamp(p.x, image.width - 1), clamp(p.y, image.height - 1)];
}

/** anchor の画像座標が変わらないように拡大縮小する */
export function zoomAt(
  viewport: Viewport,
  factor: number,
  anchor: ScreenPoint,
): Viewport {
  const scale = clampScale(viewport.scale * factor);
  const ratio = scale / viewport.scale;
  return {
    scale,
    offsetX: anchor.x - (anchor.x - viewport.offsetX) * ratio,
    offsetY: anchor.y - (anchor.y - viewport.offsetY) * ratio,
  };
}

/** ホイールイベント1回分の拡大率。動かした量に比例する */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const unit =
    deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_PAGE_PX : 1;
  return WHEEL_ZOOM_STEP ** (-(deltaY * unit) / WHEEL_DELTA_PER_STEP_PX);
}

/** 画像全体がキャンバスに収まり、中央に来る表示範囲 */
export function fitViewport(image: ImageInfo, viewportSize: Size): Viewport {
  const scale = clampScale(
    Math.min(
      viewportSize.width / image.width,
      viewportSize.height / image.height,
    ) * FIT_MARGIN_RATIO,
  );
  return {
    scale,
    offsetX: (viewportSize.width - image.width * scale) / 2,
    offsetY: (viewportSize.height - image.height * scale) / 2,
  };
}
