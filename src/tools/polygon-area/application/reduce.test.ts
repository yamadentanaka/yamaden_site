import { describe, expect, it } from "vitest";
import { screenPoint } from "../domain/types";
import type { Area, Point } from "../domain/types";
import { initialEditorState, selectedAreaId } from "./editorState";
import type { EditorAction, EditorState, LoadedImage } from "./editorState";
import { reduce } from "./reduce";

const image: LoadedImage = {
  name: "cam01.jpg",
  width: 1000,
  height: 500,
  url: "blob:test",
};
const viewportSize = { width: 1000, height: 500 };

const run = (state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce(reduce, state);

const triangle: Point[] = [
  [10, 10],
  [100, 10],
  [10, 100],
];

const area = (
  id: string,
  name: string,
  points: readonly Point[] = triangle,
  colorIndex = 0,
): Area => ({
  id,
  name,
  points,
  colorIndex,
});

/** 画像を読み込んだ select の状態 */
const loaded = (areas: Area[] = []): EditorState => ({
  ...reduce(initialEditorState, { type: "imageLoaded", image, viewportSize }),
  areas,
});

const error = { level: "error" as const, text: "x" };

describe("imageLoaded", () => {
  it("select に移り、エリアを消して全体表示にする", () => {
    // Given: エリアと選択がある
    const before = {
      ...loaded([area("a", "A")]),
      selection: { kind: "area", areaId: "a" } as const,
    };
    // When
    const after = reduce(before, {
      type: "imageLoaded",
      image: { ...image, url: "blob:new" },
      viewportSize,
    });
    // Then
    expect(after.image?.url).toBe("blob:new");
    expect(after.areas).toEqual([]);
    expect(after.mode).toEqual({ kind: "select" });
    expect(after.selection).toEqual({ kind: "none" });
    expect(after.viewport.scale).toBeCloseTo(0.95);
  });

  it("描画中でも描画を中止して読み込む", () => {
    const drawing = run(
      loaded(),
      { type: "startDrawing" },
      { type: "addDrawingPoint", point: [1, 1] },
    );
    expect(
      reduce(drawing, { type: "imageLoaded", image, viewportSize }).mode,
    ).toEqual({ kind: "select" });
  });
});

describe("definitionLoaded", () => {
  const file = {
    version: 1,
    image: { name: "cam01.jpg", width: 1000, height: 500 },
    areas: [
      { name: "A", points: triangle },
      { name: "B", points: triangle },
    ],
  } as const;

  it("エリアを置き換え、渡された id と、順に割り当て直した表示色を使う", () => {
    // Given: 既存のエリアがあり、表示範囲を動かしてある
    const before = {
      ...loaded([area("old", "old", triangle, 5)]),
      viewport: { scale: 3, offsetX: 1, offsetY: 2 },
    };
    // When
    const after = reduce(before, {
      type: "definitionLoaded",
      file,
      areaIds: ["id1", "id2"],
    });
    // Then
    expect(after.areas).toEqual([
      area("id1", "A", triangle, 0),
      area("id2", "B", triangle, 1),
    ]);
    expect(after.selection).toEqual({ kind: "none" });
    expect(after.viewport).toEqual(before.viewport);
  });

  it("描画中なら描画を中止する", () => {
    const drawing = run(loaded(), { type: "startDrawing" });
    expect(
      reduce(drawing, { type: "definitionLoaded", file, areaIds: ["1", "2"] })
        .mode,
    ).toEqual({ kind: "select" });
  });

  it("画像がないか、id の数が合わなければ何もしない", () => {
    expect(
      reduce(initialEditorState, {
        type: "definitionLoaded",
        file,
        areaIds: ["1", "2"],
      }).areas,
    ).toEqual([]);
    expect(
      reduce(loaded(), { type: "definitionLoaded", file, areaIds: ["1"] })
        .areas,
    ).toEqual([]);
  });
});

describe("描画", () => {
  it("startDrawing で drawing（0点）に移り、選択を解除する", () => {
    const before = {
      ...loaded([area("a", "A")]),
      selection: { kind: "area", areaId: "a" } as const,
    };
    const after = reduce(before, { type: "startDrawing" });
    expect(after.mode).toEqual({ kind: "drawing", points: [] });
    expect(after.selection).toEqual({ kind: "none" });
  });

  it("画像がないときは startDrawing しない", () => {
    expect(reduce(initialEditorState, { type: "startDrawing" }).mode).toEqual({
      kind: "noImage",
    });
  });

  it("頂点を追加し、直前と同じピクセルは状態を変えずに無視する", () => {
    // Given
    const drawing = run(
      loaded(),
      { type: "startDrawing" },
      { type: "addDrawingPoint", point: [1, 2] },
    );
    // When
    const same = reduce(drawing, { type: "addDrawingPoint", point: [1, 2] });
    // Then
    expect(same).toBe(drawing);
    expect(
      reduce(drawing, { type: "addDrawingPoint", point: [3, 4] }).mode,
    ).toEqual({
      kind: "drawing",
      points: [
        [1, 2],
        [3, 4],
      ],
    });
  });

  it("Backspace で最後の頂点を取り消す（0点なら何もしない）", () => {
    const drawing = run(
      loaded(),
      { type: "startDrawing" },
      { type: "addDrawingPoint", point: [1, 2] },
    );
    expect(run(drawing, { type: "removeLastDrawingPoint" }).mode).toEqual({
      kind: "drawing",
      points: [],
    });
    expect(
      run(
        drawing,
        { type: "removeLastDrawingPoint" },
        { type: "removeLastDrawingPoint" },
      ).mode,
    ).toEqual({
      kind: "drawing",
      points: [],
    });
  });

  it("3点以上で確定すると、既定の名前と表示色でエリアを追加し、そのエリアを選択する", () => {
    // Given: 既に「エリア1」がある
    const drawing = run(
      loaded([area("a", "エリア1")]),
      { type: "startDrawing" },
      ...triangle.map((point): EditorAction => ({
        type: "addDrawingPoint",
        point,
      })),
    );
    // When
    const after = reduce(drawing, { type: "finishDrawing", areaId: "new" });
    // Then
    expect(after.areas.at(-1)).toEqual(area("new", "エリア2", triangle, 1));
    expect(after.mode).toEqual({ kind: "select" });
    expect(after.selection).toEqual({ kind: "area", areaId: "new" });
  });

  it("2点以下で確定しようとするとエラーの通知を出し、描画を続ける", () => {
    const drawing = run(
      loaded(),
      { type: "startDrawing" },
      { type: "addDrawingPoint", point: [1, 1] },
      { type: "addDrawingPoint", point: [2, 2] },
    );
    const after = reduce(drawing, { type: "finishDrawing", areaId: "new" });
    expect(after.message).toEqual({
      level: "error",
      text: "頂点を3つ以上置いてください",
    });
    expect(after.mode).toEqual(drawing.mode);
    expect(after.areas).toEqual([]);
  });

  it("Esc で描画を中止し、エリアは作らない", () => {
    const drawing = run(
      loaded(),
      { type: "startDrawing" },
      { type: "addDrawingPoint", point: [1, 1] },
    );
    const after = reduce(drawing, { type: "cancelDrawing" });
    expect(after.mode).toEqual({ kind: "select" });
    expect(after.areas).toEqual([]);
  });

  it("描画中でない操作は何もしない", () => {
    const state = loaded();
    for (const action of [
      { type: "addDrawingPoint", point: [1, 1] },
      { type: "removeLastDrawingPoint" },
      { type: "finishDrawing", areaId: "x" },
      { type: "cancelDrawing" },
    ] as const) {
      expect(reduce(state, action).mode).toEqual({ kind: "select" });
    }
  });
});

describe("select", () => {
  const state = loaded([area("a", "A")]);

  it("存在するエリアや頂点を選択する", () => {
    expect(
      reduce(state, {
        type: "select",
        selection: { kind: "area", areaId: "a" },
      }).selection,
    ).toEqual({
      kind: "area",
      areaId: "a",
    });
    expect(
      reduce(state, {
        type: "select",
        selection: { kind: "vertex", areaId: "a", index: 2 },
      }).selection,
    ).toEqual({
      kind: "vertex",
      areaId: "a",
      index: 2,
    });
  });

  it("存在しないエリアや頂点、描画中の選択は無視する", () => {
    expect(
      reduce(state, {
        type: "select",
        selection: { kind: "area", areaId: "x" },
      }).selection,
    ).toEqual({ kind: "none" });
    expect(
      reduce(state, {
        type: "select",
        selection: { kind: "vertex", areaId: "a", index: 3 },
      }).selection,
    ).toEqual({
      kind: "none",
    });
    const drawing = reduce(state, { type: "startDrawing" });
    expect(
      reduce(drawing, {
        type: "select",
        selection: { kind: "area", areaId: "a" },
      }).selection,
    ).toEqual({
      kind: "none",
    });
  });

  it("選択の解除", () => {
    const selected = reduce(state, {
      type: "select",
      selection: { kind: "area", areaId: "a" },
    });
    expect(
      reduce(selected, { type: "select", selection: { kind: "none" } })
        .selection,
    ).toEqual({ kind: "none" });
  });

  it("selectedAreaId は頂点の選択でもエリアの id を返す", () => {
    expect(selectedAreaId({ kind: "none" })).toBeNull();
    expect(selectedAreaId({ kind: "area", areaId: "a" })).toBe("a");
    expect(selectedAreaId({ kind: "vertex", areaId: "a", index: 0 })).toBe("a");
  });
});

describe("頂点の編集", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("頂点を移動し、その頂点を選択する", () => {
    const after = reduce(loaded([area("a", "A")]), {
      type: "moveVertex",
      areaId: "a",
      index: 1,
      point: [50, 60],
    });
    expect(after.areas[0]?.points).toEqual([
      [10, 10],
      [50, 60],
      [10, 100],
    ]);
    expect(after.selection).toEqual({ kind: "vertex", areaId: "a", index: 1 });
  });

  it("辺に頂点を挿入し、挿入した頂点を選択する", () => {
    const after = reduce(loaded([area("a", "A")]), {
      type: "insertVertex",
      areaId: "a",
      edgeIndex: 2,
      point: [5, 50],
    });
    expect(after.areas[0]?.points).toEqual([...triangle, [5, 50]]);
    expect(after.selection).toEqual({ kind: "vertex", areaId: "a", index: 3 });
  });

  it("4点以上のエリアから頂点を削除し、削除した頂点が選択中なら選択を解除する", () => {
    const state = {
      ...loaded([area("a", "A", square)]),
      selection: { kind: "vertex", areaId: "a", index: 1 } as const,
    };
    const after = reduce(state, {
      type: "deleteVertex",
      areaId: "a",
      index: 1,
    });
    expect(after.areas[0]?.points).toEqual([
      [0, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(after.selection).toEqual({ kind: "none" });
  });

  it("選択していない頂点を削除しても選択は変えない", () => {
    const state = {
      ...loaded([area("a", "A", square)]),
      selection: { kind: "area", areaId: "a" } as const,
    };
    expect(
      reduce(state, { type: "deleteVertex", areaId: "a", index: 0 }).selection,
    ).toEqual({ kind: "area", areaId: "a" });
  });

  it("3点のエリアからは削除せず、エラーの通知を出す", () => {
    const after = reduce(loaded([area("a", "A")]), {
      type: "deleteVertex",
      areaId: "a",
      index: 0,
    });
    expect(after.areas[0]?.points).toEqual(triangle);
    expect(after.message).toEqual({
      level: "error",
      text: "エリアの頂点は3つ以上必要です",
    });
  });

  it("存在しないエリアや範囲外の番号は無視する", () => {
    const state = loaded([area("a", "A")]);
    for (const action of [
      { type: "moveVertex", areaId: "x", index: 0, point: [0, 0] },
      { type: "moveVertex", areaId: "a", index: 5, point: [0, 0] },
      { type: "insertVertex", areaId: "a", edgeIndex: 3, point: [0, 0] },
      { type: "insertVertex", areaId: "x", edgeIndex: 0, point: [0, 0] },
      { type: "deleteVertex", areaId: "a", index: -1 },
      { type: "deleteVertex", areaId: "x", index: 0 },
    ] as const) {
      expect(reduce(state, action).areas).toEqual(state.areas);
    }
  });
});

describe("エリアの名前の変更と削除", () => {
  const state = loaded([area("a", "A"), area("b", "B")]);

  it("正規化した名前に変える", () => {
    expect(
      reduce(state, { type: "renameArea", areaId: "a", name: " 入口 " })
        .areas[0]?.name,
    ).toBe("入口");
  });

  it("規則を満たさない名前は変えず、エラーの通知を出す", () => {
    const after = reduce(state, { type: "renameArea", areaId: "a", name: "B" });
    expect(after.areas[0]?.name).toBe("A");
    expect(after.message).toEqual({
      level: "error",
      text: "同じ名前のエリアがあります",
    });
  });

  it("存在しないエリアの名前の変更は無視する", () => {
    expect(
      reduce(state, { type: "renameArea", areaId: "x", name: "C" }).areas,
    ).toEqual(state.areas);
  });

  it("エリアを削除し、選択中なら選択を解除する", () => {
    const selected = {
      ...state,
      selection: { kind: "vertex", areaId: "a", index: 0 } as const,
    };
    const after = reduce(selected, { type: "deleteArea", areaId: "a" });
    expect(after.areas.map((a) => a.id)).toEqual(["b"]);
    expect(after.selection).toEqual({ kind: "none" });
  });

  it("選択していないエリアを削除しても選択は変えない。描画中でも削除できる", () => {
    const drawing = { ...reduce(state, { type: "startDrawing" }) };
    const after = reduce(drawing, { type: "deleteArea", areaId: "b" });
    expect(after.areas.map((a) => a.id)).toEqual(["a"]);
    expect(after.mode.kind).toBe("drawing");
    expect(reduce(state, { type: "deleteArea", areaId: "x" }).areas).toEqual(
      state.areas,
    );
  });
});

describe("表示範囲", () => {
  it("zoom は anchor を中心に拡大する", () => {
    const state = {
      ...loaded(),
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    };
    expect(
      reduce(state, { type: "zoom", factor: 2, anchor: screenPoint(100, 100) })
        .viewport,
    ).toEqual({
      scale: 2,
      offsetX: -100,
      offsetY: -100,
    });
  });

  it("pan は表示位置を動かす", () => {
    const state = {
      ...loaded(),
      viewport: { scale: 1, offsetX: 5, offsetY: 5 },
    };
    expect(reduce(state, { type: "pan", dx: 3, dy: -2 }).viewport).toEqual({
      scale: 1,
      offsetX: 8,
      offsetY: 3,
    });
  });

  it("fitToView は全体表示にする。画像がなければ何もしない", () => {
    const state = {
      ...loaded(),
      viewport: { scale: 5, offsetX: 0, offsetY: 0 },
    };
    expect(
      reduce(state, { type: "fitToView", viewportSize }).viewport.scale,
    ).toBeCloseTo(0.95);
    expect(
      reduce(initialEditorState, { type: "fitToView", viewportSize }).viewport,
    ).toEqual(initialEditorState.viewport);
  });
});

describe("通知", () => {
  it("showMessage で表示し、dismissMessage で消す", () => {
    const shown = reduce(loaded(), { type: "showMessage", message: error });
    expect(shown.message).toEqual(error);
    expect(reduce(shown, { type: "dismissMessage" }).message).toBeNull();
  });

  it("zoom・pan・moveVertex では消さない", () => {
    const shown = { ...loaded([area("a", "A")]), message: error };
    expect(
      reduce(shown, { type: "zoom", factor: 2, anchor: screenPoint(0, 0) })
        .message,
    ).toEqual(error);
    expect(reduce(shown, { type: "pan", dx: 1, dy: 1 }).message).toEqual(error);
    expect(
      reduce(shown, {
        type: "moveVertex",
        areaId: "a",
        index: 0,
        point: [1, 1],
      }).message,
    ).toEqual(error);
  });

  it("それ以外の操作では消す", () => {
    const shown = { ...loaded([area("a", "A")]), message: error };
    expect(
      reduce(shown, {
        type: "select",
        selection: { kind: "area", areaId: "a" },
      }).message,
    ).toBeNull();
    expect(reduce(shown, { type: "startDrawing" }).message).toBeNull();
  });
});

describe("レビュー指摘への対応（r1）", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("描画中は頂点の移動・挿入・削除を受け付けない（ドラッグ中に N を押した場合など）", () => {
    // Given: 頂点を選択した後、描画を始めた
    const drawing = reduce(
      {
        ...loaded([area("a", "A", square)]),
        selection: { kind: "vertex", areaId: "a", index: 1 },
      },
      { type: "startDrawing" },
    );
    // When
    const after = run(
      drawing,
      { type: "moveVertex", areaId: "a", index: 1, point: [5, 5] },
      { type: "insertVertex", areaId: "a", edgeIndex: 0, point: [5, 0] },
      { type: "deleteVertex", areaId: "a", index: 0 },
    );
    // Then: エリアも「描画中は選択なし」も変わらない
    expect(after.areas[0]?.points).toEqual(square);
    expect(after.selection).toEqual({ kind: "none" });
  });

  it("辺 0 に挿入すると、最初の頂点の直後に入る", () => {
    const after = reduce(loaded([area("a", "A")]), {
      type: "insertVertex",
      areaId: "a",
      edgeIndex: 0,
      point: [50, 5],
    });
    expect(after.areas[0]?.points).toEqual([
      [10, 10],
      [50, 5],
      [100, 10],
      [10, 100],
    ]);
    expect(after.selection).toEqual({ kind: "vertex", areaId: "a", index: 1 });
  });

  it("選択中の頂点より前の頂点を消すと、選択の番号を詰める", () => {
    const state = {
      ...loaded([area("a", "A", square)]),
      selection: { kind: "vertex", areaId: "a", index: 2 } as const,
    };
    const after = reduce(state, {
      type: "deleteVertex",
      areaId: "a",
      index: 0,
    });
    expect(after.selection).toEqual({ kind: "vertex", areaId: "a", index: 1 });
    expect(after.areas[0]?.points[1]).toEqual([10, 10]);
  });

  it("選択中の頂点より後の頂点を消しても、選択の番号は変えない", () => {
    const state = {
      ...loaded([area("a", "A", square)]),
      selection: { kind: "vertex", areaId: "a", index: 1 } as const,
    };
    expect(
      reduce(state, { type: "deleteVertex", areaId: "a", index: 3 }).selection,
    ).toEqual({
      kind: "vertex",
      areaId: "a",
      index: 1,
    });
  });

  it("直前と同じピクセルの頂点は、表示中の通知も消さずに無視する", () => {
    const drawing = {
      ...run(
        loaded(),
        { type: "startDrawing" },
        { type: "addDrawingPoint", point: [1, 2] },
      ),
      message: error,
    };
    expect(
      reduce(drawing, { type: "addDrawingPoint", point: [1, 2] }).message,
    ).toEqual(error);
  });
});
