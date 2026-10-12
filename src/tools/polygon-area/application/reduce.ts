// エディタの状態を操作に応じて更新する純粋関数（docs/functional-design.md の「アプリケーションレイヤー」）
import {
  nextColorIndex,
  nextDefaultName,
  validateAreaName,
} from "../domain/area";
import { toMessage } from "../domain/errors";
import type { ToolError } from "../domain/errors";
import type { Area, Point } from "../domain/types";
import { fitViewport, zoomAt } from "../domain/viewport";
import type { EditorAction, EditorState, Selection } from "./editorState";

const MIN_AREA_POINTS = 3;

/** 受け取っても通知を消さない操作 */
const KEEP_MESSAGE: ReadonlySet<EditorAction["type"]> = new Set([
  "zoom",
  "pan",
  "moveVertex",
  "showMessage",
  "dismissMessage",
]);

const samePoint = (a: Point | undefined, b: Point) =>
  a !== undefined && a[0] === b[0] && a[1] === b[1];

const withError = (state: EditorState, error: ToolError): EditorState => ({
  ...state,
  message: toMessage(error),
});

const updateArea = (
  state: EditorState,
  areaId: string,
  update: (area: Area) => Area,
): EditorState => ({
  ...state,
  areas: state.areas.map((area) => (area.id === areaId ? update(area) : area)),
});

const findArea = (state: EditorState, areaId: string) =>
  state.areas.find((area) => area.id === areaId);

const isValidSelection = (
  state: EditorState,
  selection: Selection,
): boolean => {
  if (selection.kind === "none") return true;
  const area = findArea(state, selection.areaId);
  if (area === undefined) return false;
  return (
    selection.kind === "area" ||
    (selection.index >= 0 && selection.index < area.points.length)
  );
};

export function reduce(state: EditorState, action: EditorAction): EditorState {
  const base: EditorState = KEEP_MESSAGE.has(action.type)
    ? state
    : { ...state, message: null };

  switch (action.type) {
    case "imageLoaded":
      return {
        ...base,
        image: action.image,
        areas: [],
        mode: { kind: "select" },
        selection: { kind: "none" },
        viewport: fitViewport(action.image, action.viewportSize),
      };

    case "definitionLoaded": {
      if (
        base.image === null ||
        action.areaIds.length !== action.file.areas.length
      )
        return base;
      const areas: Area[] = [];
      action.file.areas.forEach((area, i) => {
        areas.push({
          id: action.areaIds[i] ?? String(i),
          name: area.name,
          points: area.points,
          colorIndex: nextColorIndex(areas),
        });
      });
      return {
        ...base,
        areas,
        mode: { kind: "select" },
        selection: { kind: "none" },
      };
    }

    case "startDrawing":
      if (base.mode.kind !== "select") return base;
      return {
        ...base,
        mode: { kind: "drawing", points: [] },
        selection: { kind: "none" },
      };

    case "addDrawingPoint": {
      if (base.mode.kind !== "drawing") return base;
      // 直前と同じピクセルの連続は、状態を変えずに無視する（通知も出さない）
      if (samePoint(base.mode.points.at(-1), action.point)) return state;
      return {
        ...base,
        mode: { kind: "drawing", points: [...base.mode.points, action.point] },
      };
    }

    case "removeLastDrawingPoint":
      if (base.mode.kind !== "drawing") return base;
      return {
        ...base,
        mode: { kind: "drawing", points: base.mode.points.slice(0, -1) },
      };

    case "finishDrawing": {
      if (base.mode.kind !== "drawing") return base;
      if (base.mode.points.length < MIN_AREA_POINTS)
        return withError(base, { kind: "tooFewPointsToFinish" });
      const area: Area = {
        id: action.areaId,
        name: nextDefaultName(base.areas),
        points: base.mode.points,
        colorIndex: nextColorIndex(base.areas),
      };
      return {
        ...base,
        areas: [...base.areas, area],
        mode: { kind: "select" },
        selection: { kind: "area", areaId: area.id },
      };
    }

    case "cancelDrawing":
      if (base.mode.kind !== "drawing") return base;
      return { ...base, mode: { kind: "select" } };

    case "select":
      if (
        base.mode.kind !== "select" ||
        !isValidSelection(base, action.selection)
      )
        return base;
      return { ...base, selection: action.selection };

    case "moveVertex": {
      // 頂点の編集は select のときだけ（ドラッグ中のキー操作でモードが変わった後の操作を捨てる）
      if (base.mode.kind !== "select") return base;
      const area = findArea(base, action.areaId);
      if (
        area === undefined ||
        action.index < 0 ||
        action.index >= area.points.length
      )
        return base;
      return {
        ...updateArea(base, action.areaId, (a) => ({
          ...a,
          points: a.points.map((p, i) =>
            i === action.index ? action.point : p,
          ),
        })),
        selection: {
          kind: "vertex",
          areaId: action.areaId,
          index: action.index,
        },
      };
    }

    case "insertVertex": {
      // 頂点の編集は select のときだけ（ドラッグ中のキー操作でモードが変わった後の操作を捨てる）
      if (base.mode.kind !== "select") return base;
      const area = findArea(base, action.areaId);
      if (
        area === undefined ||
        action.edgeIndex < 0 ||
        action.edgeIndex >= area.points.length
      )
        return base;
      const index = action.edgeIndex + 1;
      return {
        ...updateArea(base, action.areaId, (a) => ({
          ...a,
          points: [
            ...a.points.slice(0, index),
            action.point,
            ...a.points.slice(index),
          ],
        })),
        selection: { kind: "vertex", areaId: action.areaId, index },
      };
    }

    case "deleteVertex": {
      // 頂点の編集は select のときだけ（ドラッグ中のキー操作でモードが変わった後の操作を捨てる）
      if (base.mode.kind !== "select") return base;
      const area = findArea(base, action.areaId);
      if (
        area === undefined ||
        action.index < 0 ||
        action.index >= area.points.length
      )
        return base;
      if (area.points.length <= MIN_AREA_POINTS)
        return withError(base, { kind: "minimumPointsRequired" });
      const selection = base.selection;
      const sameArea =
        selection.kind === "vertex" && selection.areaId === action.areaId;
      // 選択中の頂点を消したら選択を解除し、それより前の頂点を消したら番号を詰める
      const nextSelection: Selection = !sameArea
        ? selection
        : selection.index === action.index
          ? { kind: "none" }
          : selection.index > action.index
            ? { ...selection, index: selection.index - 1 }
            : selection;
      return {
        ...updateArea(base, action.areaId, (a) => ({
          ...a,
          points: a.points.filter((_, i) => i !== action.index),
        })),
        selection: nextSelection,
      };
    }

    case "renameArea": {
      if (findArea(base, action.areaId) === undefined) return base;
      const result = validateAreaName(action.name, base.areas, action.areaId);
      if (!result.ok) return withError(base, result.error);
      return updateArea(base, action.areaId, (a) => ({
        ...a,
        name: result.value,
      }));
    }

    case "deleteArea": {
      if (findArea(base, action.areaId) === undefined) return base;
      const selection = base.selection;
      const wasSelected =
        selection.kind !== "none" && selection.areaId === action.areaId;
      return {
        ...base,
        areas: base.areas.filter((area) => area.id !== action.areaId),
        selection: wasSelected ? { kind: "none" } : selection,
      };
    }

    case "zoom":
      return {
        ...base,
        viewport: zoomAt(base.viewport, action.factor, action.anchor),
      };

    case "pan":
      return {
        ...base,
        viewport: {
          ...base.viewport,
          offsetX: base.viewport.offsetX + action.dx,
          offsetY: base.viewport.offsetY + action.dy,
        },
      };

    case "fitToView":
      if (base.image === null) return base;
      return {
        ...base,
        viewport: fitViewport(base.image, action.viewportSize),
      };

    case "showMessage":
      return { ...base, message: action.message };

    case "dismissMessage":
      return { ...base, message: null };
  }
}
