// ツール全体のルートコンポーネント（docs/functional-design.md の「UIレイヤー」）
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";
import type { EditorAction } from "../application/editorState";
import { initialEditorState, selectedAreaId } from "../application/editorState";
import { reduce } from "../application/reduce";
import {
  checkCompatibility,
  definitionFileName,
  parse,
  serialize,
} from "../domain/definitionFile";
import { toMessage } from "../domain/errors";
import { classifyFile } from "../domain/fileKind";
import type { Size } from "../domain/types";
import {
  downloadText,
  loadImageFile,
  readTextFile,
  releaseImageUrl,
} from "../infrastructure/files";
import { AreaList } from "./AreaList";
import { Canvas } from "./Canvas";
import { HelpPanel } from "./HelpPanel";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import "./polygonArea.css";

/** 通知を自動で消すまでの時間 */
const MESSAGE_TIMEOUT_MS = 5000;
const CONFIRM_REPLACE_TEXT = "エリアは全て消えます。よろしいですか？";
const UNEXPECTED_ERROR_TEXT = "予期しないエラーが発生しました";

/** 入力欄・ボタン・リンクにフォーカスがあるときは、キー操作をそちらに任せる */
const isFocusedControl = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLButtonElement ||
  target instanceof HTMLAnchorElement;

export function PolygonAreaEditor() {
  const [state, dispatch] = useReducer(reduce, initialEditorState);
  const [helpOpen, setHelpOpen] = useState(true);
  const [cursor, setCursor] = useState<readonly [number, number] | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // document のイベントから最新の状態を読むための参照
  const stateRef = useRef(state);
  stateRef.current = state;
  const canvasSizeRef = useRef<Size>({ width: 0, height: 0 });

  /** 想定外の例外を捕捉して通知にする（状態は例外の前のまま） */
  const reportUnexpected = useCallback((error: unknown) => {
    console.error(error);
    dispatch({
      type: "showMessage",
      message: { level: "error", text: UNEXPECTED_ERROR_TEXT },
    });
  }, []);

  const safeDispatch = useCallback(
    (action: EditorAction) => {
      try {
        dispatch(action);
      } catch (error) {
        reportUnexpected(error);
      }
    },
    [reportUnexpected],
  );

  const finishDrawing = useCallback(() => {
    safeDispatch({ type: "finishDrawing", areaId: crypto.randomUUID() });
  }, [safeDispatch]);

  const confirmReplace = () =>
    stateRef.current.areas.length === 0 || window.confirm(CONFIRM_REPLACE_TEXT);

  const openImage = async (file: File): Promise<boolean> => {
    if (!confirmReplace()) return false;
    const result = await loadImageFile(file);
    if (!result.ok) {
      dispatch({ type: "showMessage", message: toMessage(result.error) });
      return false;
    }
    const previousUrl = stateRef.current.image?.url;
    dispatch({
      type: "imageLoaded",
      image: result.value,
      viewportSize: canvasSizeRef.current,
    });
    if (previousUrl !== undefined) releaseImageUrl(previousUrl);
    return true;
  };

  const openDefinition = async (file: File): Promise<boolean> => {
    const image = stateRef.current.image;
    if (image === null) {
      dispatch({
        type: "showMessage",
        message: toMessage({ kind: "imageRequiredFirst" }),
      });
      return false;
    }
    if (!confirmReplace()) return false;
    const text = await readTextFile(file);
    if (!text.ok) {
      dispatch({ type: "showMessage", message: toMessage(text.error) });
      return false;
    }
    const parsed = parse(text.value);
    if (!parsed.ok) {
      dispatch({ type: "showMessage", message: toMessage(parsed.error) });
      return false;
    }
    const compatible = checkCompatibility(parsed.value, image);
    if (!compatible.ok) {
      dispatch({ type: "showMessage", message: toMessage(compatible.error) });
      return false;
    }
    dispatch({
      type: "definitionLoaded",
      file: parsed.value,
      areaIds: parsed.value.areas.map(() => crypto.randomUUID()),
    });
    return true;
  };

  /** ボタンで選んだファイルとドロップしたファイルを振り分けて読み込む */
  const openFiles = (files: readonly File[]) => {
    const file = files[0];
    if (file === undefined) return;
    const run = async () => {
      const kind = classifyFile(file);
      const loaded =
        kind === "image"
          ? await openImage(file)
          : kind === "json"
            ? await openDefinition(file)
            : false;
      if (kind === "unknown") {
        dispatch({
          type: "showMessage",
          message: toMessage({ kind: "unknownFileType" }),
        });
      }
      if (loaded && files.length > 1) {
        dispatch({
          type: "showMessage",
          message: {
            level: "info",
            text: "最初のファイルだけを読み込みました",
          },
        });
      }
    };
    run().catch(reportUnexpected);
  };

  const download = () => {
    try {
      const { image, areas } = stateRef.current;
      if (image === null) return;
      downloadText(definitionFileName(image.name), serialize(image, areas));
    } catch (error) {
      reportUnexpected(error);
    }
  };

  const onCanvasSizeChange = useCallback((size: Size) => {
    canvasSizeRef.current = size;
  }, []);

  const fitToView = useCallback(() => {
    safeDispatch({ type: "fitToView", viewportSize: canvasSizeRef.current });
  }, [safeDispatch]);

  // 通知は5秒で消す。通知が変わるたびにタイマーを作り直す
  useEffect(() => {
    if (state.message === null) return;
    const timer = setTimeout(
      () => dispatch({ type: "dismissMessage" }),
      MESSAGE_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.message]);

  // ツールの外にファイルを落としても、ブラウザがそのファイルを開いてページを移らないようにする
  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  // キーボード操作（docs/functional-design.md の「操作一覧」）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isFocusedControl(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const { mode, selection } = stateRef.current;
      const handled = (action?: () => void) => {
        event.preventDefault();
        action?.();
      };
      try {
        switch (event.key) {
          case " ":
            handled(() => setSpaceHeld(true));
            return;
          case "n":
          case "N":
            if (mode.kind === "select")
              handled(() => dispatch({ type: "startDrawing" }));
            return;
          case "Enter":
            if (mode.kind === "drawing") handled(finishDrawing);
            return;
          case "Escape":
            if (mode.kind === "drawing")
              handled(() => dispatch({ type: "cancelDrawing" }));
            else if (mode.kind === "select")
              handled(() =>
                dispatch({ type: "select", selection: { kind: "none" } }),
              );
            return;
          case "0":
            if (mode.kind !== "noImage") handled(fitToView);
            return;
          case "Backspace":
          case "Delete":
            if (mode.kind === "drawing" && event.key === "Backspace") {
              handled(() => dispatch({ type: "removeLastDrawingPoint" }));
            } else if (mode.kind === "select" && selection.kind === "vertex") {
              handled(() =>
                dispatch({
                  type: "deleteVertex",
                  areaId: selection.areaId,
                  index: selection.index,
                }),
              );
            } else if (mode.kind === "select" && selection.kind === "area") {
              handled(() =>
                dispatch({ type: "deleteArea", areaId: selection.areaId }),
              );
            }
            return;
        }
      } catch (error) {
        reportUnexpected(error);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [finishDrawing, fitToView, reportUnexpected]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    openFiles([...(event.dataTransfer?.files ?? [])]);
  };

  return (
    <div
      class="pae"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <Toolbar
        mode={state.mode.kind}
        helpOpen={helpOpen}
        onOpenFiles={openFiles}
        onStartDrawing={() => safeDispatch({ type: "startDrawing" })}
        onDownload={download}
        onFitToView={fitToView}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />
      {helpOpen && <HelpPanel />}
      <div class="pae-workspace">
        <Canvas
          state={state}
          spaceHeld={spaceHeld}
          dispatch={safeDispatch}
          onFinishDrawing={finishDrawing}
          onCursorChange={setCursor}
          onSizeChange={onCanvasSizeChange}
          onUnexpectedError={reportUnexpected}
        />
        <AreaList
          areas={state.areas}
          selectedAreaId={selectedAreaId(state.selection)}
          canSelect={state.mode.kind === "select"}
          dispatch={safeDispatch}
          onUnexpectedError={reportUnexpected}
        />
      </div>
      <StatusBar
        cursor={cursor}
        scale={state.viewport.scale}
        message={state.message}
      />
    </div>
  );
}
