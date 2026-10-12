import { describe, expect, it } from "vitest";
import { checkCompatibility, parse, serialize } from "../domain/definitionFile";
import { initialEditorState } from "./editorState";
import type { LoadedImage } from "./editorState";
import { reduce } from "./reduce";

const image: LoadedImage = {
  name: "cam01.jpg",
  width: 1920,
  height: 1080,
  url: "blob:roundtrip",
};

describe("エリア定義JSONの往復", () => {
  it("同じ画像で、出力 → 解析 → 読み込み → 出力をすると、ファイルの内容が完全に一致する", () => {
    // Given: 画像を読み込み、エリアを2つ描いて名前を変えた状態
    let state = reduce(initialEditorState, {
      type: "imageLoaded",
      image,
      viewportSize: { width: 800, height: 600 },
    });
    const draw = (id: string, points: [number, number][]) => {
      state = reduce(state, { type: "startDrawing" });
      for (const point of points)
        state = reduce(state, { type: "addDrawingPoint", point });
      state = reduce(state, { type: "finishDrawing", areaId: id });
    };
    draw("a", [
      [120, 340],
      [860, 320],
      [900, 1000],
      [100, 1020],
    ]);
    draw("b", [
      [0, 0],
      [1919, 0],
      [1919, 1079],
    ]);
    state = reduce(state, {
      type: "renameArea",
      areaId: "a",
      name: "判定エリアA",
    });
    const first = serialize(image, state.areas);

    // When: JSON を検証して読み込み直し、もう一度出力する
    const parsed = parse(first);
    if (!parsed.ok) throw new Error("parse に失敗した");
    expect(checkCompatibility(parsed.value, image).ok).toBe(true);
    const reloaded = reduce(state, {
      type: "definitionLoaded",
      file: parsed.value,
      areaIds: ["x", "y"],
    });
    const second = serialize(image, reloaded.areas);

    // Then
    expect(second).toBe(first);
    expect(first).not.toContain("blob:");
  });
});
