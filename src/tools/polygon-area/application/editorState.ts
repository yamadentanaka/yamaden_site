// エディタの状態と操作（docs/functional-design.md の「エディタの状態」「アプリケーションレイヤー」）
import type {
  AreaDefinitionFile,
  Area,
  ImageInfo,
  Message,
  Point,
  ScreenPoint,
  Size,
  Viewport,
} from "../domain/types";

export type LoadedImage = ImageInfo & { readonly url: string };

export type EditorMode =
  | { readonly kind: "noImage" }
  | { readonly kind: "select" }
  | { readonly kind: "drawing"; readonly points: readonly Point[] };

export type Selection =
  | { readonly kind: "none" }
  | { readonly kind: "area"; readonly areaId: string }
  | {
      readonly kind: "vertex";
      readonly areaId: string;
      readonly index: number;
    };

export interface EditorState {
  readonly image: LoadedImage | null;
  /** 作成順 */
  readonly areas: readonly Area[];
  readonly mode: EditorMode;
  readonly selection: Selection;
  readonly viewport: Viewport;
  readonly message: Message | null;
}

export type EditorAction =
  | {
      readonly type: "imageLoaded";
      readonly image: LoadedImage;
      readonly viewportSize: Size;
    }
  | {
      readonly type: "definitionLoaded";
      readonly file: AreaDefinitionFile;
      readonly areaIds: readonly string[];
    }
  | { readonly type: "startDrawing" }
  | { readonly type: "addDrawingPoint"; readonly point: Point }
  | { readonly type: "removeLastDrawingPoint" }
  | { readonly type: "finishDrawing"; readonly areaId: string }
  | { readonly type: "cancelDrawing" }
  | { readonly type: "select"; readonly selection: Selection }
  | {
      readonly type: "moveVertex";
      readonly areaId: string;
      readonly index: number;
      readonly point: Point;
    }
  | {
      readonly type: "insertVertex";
      readonly areaId: string;
      readonly edgeIndex: number;
      readonly point: Point;
    }
  | {
      readonly type: "deleteVertex";
      readonly areaId: string;
      readonly index: number;
    }
  | {
      readonly type: "renameArea";
      readonly areaId: string;
      readonly name: string;
    }
  | { readonly type: "deleteArea"; readonly areaId: string }
  | {
      readonly type: "zoom";
      readonly factor: number;
      readonly anchor: ScreenPoint;
    }
  | { readonly type: "pan"; readonly dx: number; readonly dy: number }
  | { readonly type: "fitToView"; readonly viewportSize: Size }
  | { readonly type: "showMessage"; readonly message: Message }
  | { readonly type: "dismissMessage" };

export const initialEditorState: EditorState = {
  image: null,
  areas: [],
  mode: { kind: "noImage" },
  selection: { kind: "none" },
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  message: null,
};

/** 選択中のエリアの id（頂点を選択中のときは、その頂点のエリア） */
export const selectedAreaId = (selection: Selection): string | null =>
  selection.kind === "none" ? null : selection.areaId;
