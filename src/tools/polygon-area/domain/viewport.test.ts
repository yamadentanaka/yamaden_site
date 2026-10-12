import { describe, expect, it } from "vitest";
import { imagePoint, screenPoint } from "./types";
import type { ImageInfo, Viewport } from "./types";
import {
  MAX_SCALE,
  MIN_SCALE,
  clampToImage,
  fitViewport,
  pixelCenterToScreen,
  screenToImage,
  toPixel,
  wheelZoomFactor,
  zoomAt,
} from "./viewport";

const image: ImageInfo = { name: "cam01.jpg", width: 1920, height: 1080 };
const viewport: Viewport = { scale: 2, offsetX: 10, offsetY: 20 };

describe("screenToImage", () => {
  it("画面座標から表示位置を引き、拡大率で割った画像座標を返す", () => {
    expect(screenToImage(screenPoint(30, 60), viewport)).toEqual(
      imagePoint(10, 20),
    );
  });
});

describe("pixelCenterToScreen", () => {
  it("ピクセルの中心を画面座標にする", () => {
    expect(pixelCenterToScreen([10, 20], viewport)).toEqual(
      screenPoint(31, 61),
    );
  });
});

describe("toPixel", () => {
  it("小数を切り捨ててピクセル座標にする", () => {
    expect(toPixel(imagePoint(12.9, 3.1), image)).toEqual([12, 3]);
  });

  it("画像の右端・下端のピクセルは画像の中として扱う", () => {
    expect(toPixel(imagePoint(1919.99, 1079.99), image)).toEqual([1919, 1079]);
  });

  it.each([
    [-0.01, 0],
    [0, -0.5],
    [1920, 0],
    [0, 1080],
  ])("画像の外（%f, %f）なら null を返す", (x, y) => {
    expect(toPixel(imagePoint(x, y), image)).toBeNull();
  });
});

describe("clampToImage", () => {
  it("画像の外の点を画像の端に寄せる", () => {
    expect(clampToImage(imagePoint(-5, 2000), image)).toEqual([0, 1079]);
    expect(clampToImage(imagePoint(5000, -1), image)).toEqual([1919, 0]);
  });

  it("画像の中の点は切り捨てるだけ", () => {
    expect(clampToImage(imagePoint(100.7, 200.2), image)).toEqual([100, 200]);
  });
});

describe("zoomAt", () => {
  it("anchor の位置の画像座標が変わらない", () => {
    // Given
    const anchor = screenPoint(400, 300);
    const before = screenToImage(anchor, viewport);
    // When
    const zoomed = zoomAt(viewport, 1.5, anchor);
    // Then
    const after = screenToImage(anchor, zoomed);
    expect(zoomed.scale).toBeCloseTo(3);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("拡大率を 0.05〜32 に収める", () => {
    expect(zoomAt(viewport, 1000, screenPoint(0, 0)).scale).toBe(MAX_SCALE);
    expect(zoomAt(viewport, 0.0001, screenPoint(0, 0)).scale).toBe(MIN_SCALE);
  });
});

describe("wheelZoomFactor", () => {
  it("下へ100画面px で 1/1.2 倍、上へ100画面px で 1.2 倍になる", () => {
    expect(wheelZoomFactor(100, 0)).toBeCloseTo(1 / 1.2);
    expect(wheelZoomFactor(-100, 0)).toBeCloseTo(1.2);
  });

  it("動かした量に比例する（トラックパッドの小さな値では少しだけ変わる）", () => {
    expect(wheelZoomFactor(-10, 0)).toBeCloseTo(1.2 ** 0.1);
  });

  it("行単位は ×40、ページ単位は ×800 で画面px に換算する", () => {
    expect(wheelZoomFactor(-2.5, 1)).toBeCloseTo(1.2);
    expect(wheelZoomFactor(-0.125, 2)).toBeCloseTo(1.2);
  });
});

describe("fitViewport", () => {
  it("画像全体が収まる拡大率の 0.95 倍にし、中央に置く", () => {
    // When
    const fitted = fitViewport(image, { width: 960, height: 1080 });
    // Then: 幅で決まる（960/1920 = 0.5）
    expect(fitted.scale).toBeCloseTo(0.475);
    expect(fitted.offsetX).toBeCloseTo((960 - 1920 * 0.475) / 2);
    expect(fitted.offsetY).toBeCloseTo((1080 - 1080 * 0.475) / 2);
  });

  it("キャンバスが小さすぎても拡大率は 0.05 未満にならない", () => {
    expect(fitViewport(image, { width: 0, height: 0 }).scale).toBe(MIN_SCALE);
  });

  it("小さい画像でも拡大率は 32 を超えない", () => {
    expect(
      fitViewport(
        { name: "a.png", width: 1, height: 1 },
        { width: 1000, height: 1000 },
      ).scale,
    ).toBe(MAX_SCALE);
  });
});
