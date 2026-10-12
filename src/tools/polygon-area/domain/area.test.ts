import { describe, expect, it } from "vitest";
import {
  areaColor,
  nextColorIndex,
  nextDefaultName,
  normalizeAreaName,
  validateAreaName,
} from "./area";
import type { Area } from "./types";

const area = (id: string, name: string, colorIndex = 0): Area => ({
  id,
  name,
  colorIndex,
  points: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
});

describe("normalizeAreaName", () => {
  it("前後の空白を除く", () => {
    expect(normalizeAreaName("  判定エリアA　")).toBe("判定エリアA");
  });
});

describe("validateAreaName", () => {
  it("正規化した名前を返す", () => {
    expect(validateAreaName(" 入口 ", [])).toEqual({ ok: true, value: "入口" });
  });

  it("空白だけなら empty", () => {
    expect(validateAreaName("   ", [])).toEqual({
      ok: false,
      error: { kind: "empty" },
    });
  });

  it("50文字は通り、51文字は tooLong（コードポイント数で数える）", () => {
    expect(validateAreaName("あ".repeat(50), []).ok).toBe(true);
    expect(validateAreaName("あ".repeat(51), [])).toEqual({
      ok: false,
      error: { kind: "tooLong" },
    });
    // サロゲートペアの文字も1文字として数える
    expect(validateAreaName("𠮷".repeat(50), []).ok).toBe(true);
  });

  it("他のエリアと同じ名前は duplicate。自分自身とは比べない", () => {
    const areas = [area("a", "入口"), area("b", "出口")];
    expect(validateAreaName("入口", areas, "b")).toEqual({
      ok: false,
      error: { kind: "duplicate" },
    });
    expect(validateAreaName("入口", areas, "a")).toEqual({
      ok: true,
      value: "入口",
    });
  });

  it("大文字と小文字は区別する", () => {
    expect(validateAreaName("area", [area("a", "Area")]).ok).toBe(true);
  });
});

describe("nextDefaultName", () => {
  it("既存の名前と重ならない最小の番号を使う", () => {
    expect(nextDefaultName([])).toBe("エリア1");
    expect(nextDefaultName([area("a", "エリア1"), area("b", "エリア3")])).toBe(
      "エリア2",
    );
  });
});

describe("nextColorIndex", () => {
  it("使われている回数が最も少ない色のうち、番号が最小の色を返す", () => {
    expect(nextColorIndex([])).toBe(0);
    expect(nextColorIndex([{ colorIndex: 0 }, { colorIndex: 1 }])).toBe(2);
    expect(nextColorIndex([{ colorIndex: 1 }])).toBe(0);
  });

  it("10色を使い切ったら最初の色に戻る", () => {
    const all = Array.from({ length: 10 }, (_, colorIndex) => ({ colorIndex }));
    expect(nextColorIndex(all)).toBe(0);
  });
});

describe("areaColor", () => {
  it("パレットの色を返す", () => {
    expect(areaColor(0)).toBe("#e6194b");
    expect(areaColor(9)).toBe("#469990");
  });
});
