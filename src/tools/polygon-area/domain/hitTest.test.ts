import { describe, expect, it } from "vitest";
import {
  hitArea,
  hitEdge,
  hitVertex,
  isDrag,
  isInsidePolygon,
} from "./hitTest";
import { imagePoint, screenPoint } from "./types";
import type { Area, Viewport } from "./types";

// 拡大率1・表示位置0なら、頂点 [x, y] は画面の (x + 0.5, y + 0.5) に描かれる
const identity: Viewport = { scale: 1, offsetX: 0, offsetY: 0 };

const square = (id: string, x0: number, y0: number, size: number): Area => ({
  id,
  name: id,
  colorIndex: 0,
  points: [
    [x0, y0],
    [x0 + size, y0],
    [x0 + size, y0 + size],
    [x0, y0 + size],
  ],
});

describe("hitVertex", () => {
  const points = [
    [10, 10],
    [30, 10],
  ] as const;

  it("8画面px 以内の頂点のうち最も近いものを返す", () => {
    expect(hitVertex(points, screenPoint(16, 10.5), identity)).toBe(0);
    expect(hitVertex(points, screenPoint(25, 10.5), identity)).toBe(1);
  });

  it("8画面px ちょうどは当たり、それより遠ければ null", () => {
    expect(hitVertex(points, screenPoint(18.5, 10.5), identity)).toBe(0);
    expect(hitVertex(points, screenPoint(19, 10.5), identity)).toBeNull();
  });

  it("拡大率に関係なく画面px で判定する", () => {
    // Given: 4倍に拡大すると、頂点 [10, 10] は画面の (42, 42)
    const zoomed: Viewport = { scale: 4, offsetX: 0, offsetY: 0 };
    // Then
    expect(hitVertex(points, screenPoint(49, 42), zoomed)).toBe(0);
    expect(hitVertex(points, screenPoint(51, 42), zoomed)).toBeNull();
  });

  it("頂点がなければ null", () => {
    expect(hitVertex([], screenPoint(0, 0), identity)).toBeNull();
  });
});

describe("hitEdge", () => {
  const area = square("a", 0, 0, 100);

  it("6画面px 以内の辺の番号を返す", () => {
    expect(hitEdge(area, screenPoint(50, 4), identity)).toBe(0);
    expect(hitEdge(area, screenPoint(104, 50), identity)).toBe(1);
    expect(hitEdge(area, screenPoint(50, 97), identity)).toBe(2);
  });

  it("最後の頂点と最初の頂点を結ぶ辺も判定する", () => {
    expect(hitEdge(area, screenPoint(2, 50), identity)).toBe(3);
  });

  it("どの辺からも6画面px より遠ければ null", () => {
    expect(hitEdge(area, screenPoint(50, 50), identity)).toBeNull();
  });

  it("長さ0の辺は端点との距離で判定する", () => {
    // Given: 全ての頂点が同じ位置（全ての辺の長さが0）
    const degenerate: Area = {
      ...area,
      points: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    };
    // Then: 端点 (0.5, 0.5) から 2.5画面px なので当たる。遠ければ当たらない
    expect(hitEdge(degenerate, screenPoint(3, 0.5), identity)).toBe(0);
    expect(hitEdge(degenerate, screenPoint(10, 0.5), identity)).toBeNull();
  });
});

describe("isInsidePolygon / hitArea", () => {
  it("内側の点は true、外側の点は false", () => {
    const { points } = square("a", 0, 0, 100);
    expect(isInsidePolygon(points, imagePoint(50, 50))).toBe(true);
    expect(isInsidePolygon(points, imagePoint(150, 50))).toBe(false);
  });

  it("自己交差するポリゴンは偶奇規則で判定する", () => {
    // 蝶ネクタイ形: 中央の交点の左右は内側
    const bowtie = [
      [0, 0],
      [100, 100],
      [100, 0],
      [0, 100],
    ] as const;
    expect(isInsidePolygon(bowtie, imagePoint(10, 50))).toBe(true);
    expect(isInsidePolygon(bowtie, imagePoint(50, 10))).toBe(false);
  });

  it("重なっている場合は後から作ったエリアを返す", () => {
    const areas = [square("first", 0, 0, 100), square("second", 50, 50, 100)];
    expect(hitArea(areas, imagePoint(75, 75))).toBe("second");
    expect(hitArea(areas, imagePoint(25, 25))).toBe("first");
    expect(hitArea(areas, imagePoint(300, 300))).toBeNull();
  });
});

describe("isDrag", () => {
  it("4画面px 未満はクリック、4画面px 以上はドラッグ", () => {
    expect(isDrag(3, 2)).toBe(false);
    expect(isDrag(4, 0)).toBe(true);
  });
});
