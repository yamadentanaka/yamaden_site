// 画像とエリアの表示（SVG）と、ポインター・ホイールの操作（docs/functional-design.md の「操作一覧」「表示項目」）
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { EditorAction, EditorState } from "../application/editorState";
import { selectedAreaId } from "../application/editorState";
import { areaColor, nextColorIndex } from "../domain/area";
import { hitArea, hitEdge, hitVertex, isDrag } from "../domain/hitTest";
import { screenPoint } from "../domain/types";
import type { Point, ScreenPoint, Size } from "../domain/types";
import {
  clampToImage,
  screenToImage,
  toPixel,
  wheelZoomFactor,
} from "../domain/viewport";

const HANDLE_RADIUS_PX = 5;
const FIRST_VERTEX_HIGHLIGHT_RADIUS_PX = 7;
const AREA_STROKE_PX = 2;
const SELECTED_AREA_STROKE_PX = 3;
const LABEL_OFFSET_PX = 6;
const LABEL_FONT_PX = 12;

interface Props {
  state: EditorState;
  spaceHeld: boolean;
  dispatch: (action: EditorAction) => void;
  onFinishDrawing: () => void;
  onCursorChange: (pixel: readonly [number, number] | null) => void;
  onSizeChange: (size: Size) => void;
  onUnexpectedError: (error: unknown) => void;
}

/** 押した時点で決まる、この操作の対象 */
type PressTarget =
  | { kind: "pan" }
  | { kind: "drawingStart" }
  | { kind: "drawingAdd" }
  | { kind: "vertex"; areaId: string; index: number; pointCount: number }
  | { kind: "edge" }
  | { kind: "area"; areaId: string }
  | { kind: "background" };

interface Press {
  pointerId: number;
  start: ScreenPoint;
  last: ScreenPoint;
  target: PressTarget;
  dragging: boolean;
}

const toPolygonPoints = (points: readonly Point[]) =>
  points.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ");

export function Canvas({
  state,
  spaceHeld,
  dispatch,
  onFinishDrawing,
  onCursorChange,
  onSizeChange,
  onUnexpectedError,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pressRef = useRef<Press | null>(null);
  const pendingMoveRef = useRef<PointerEvent | null>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [cursorImage, setCursorImage] = useState<Point | null>(null);
  const [hoverFirstVertex, setHoverFirstVertex] = useState(false);

  const { image, areas, mode, viewport } = state;
  const scale = viewport.scale;
  const selectedId = selectedAreaId(state.selection);
  const selectedArea = areas.find((area) => area.id === selectedId);

  /** 想定外の例外を捕捉して通知にする（docs/functional-design.md の「エラーハンドリング」） */
  const guard =
    <E,>(handler: (event: E) => void) =>
    (event: E) => {
      try {
        handler(event);
      } catch (error) {
        onUnexpectedError(error);
      }
    };

  const toScreen = (event: {
    clientX: number;
    clientY: number;
  }): ScreenPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    return screenPoint(
      event.clientX - (rect?.left ?? 0),
      event.clientY - (rect?.top ?? 0),
    );
  };

  // キャンバスの大きさを親に伝える（全体表示の計算に使う）。
  // 画面に出る前に測り、ページを開いた直後に画像を読み込んでも大きさ 0 で全体表示しないようにする
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const report = () =>
      onSizeChange({ width: svg.clientWidth, height: svg.clientHeight });
    report();
    const observer = new ResizeObserver(report);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onSizeChange]);

  // ホイールは passive: false で登録し、ページのスクロールとピンチでのページのズームを止める
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const onWheel = guard((event: WheelEvent) => {
      event.preventDefault();
      if (stateRef.current.image === null) return;
      dispatch({
        type: "zoom",
        factor: wheelZoomFactor(event.deltaY, event.deltaMode),
        anchor: toScreen(event),
      });
    });
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [dispatch]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const decideTarget = (
    event: PointerEvent,
    p: ScreenPoint,
  ): PressTarget | null => {
    const current = stateRef.current;
    if (current.image === null) return null;
    if (event.button === 1 || (event.button === 0 && spaceHeld))
      return { kind: "pan" };
    if (event.button !== 0) return null;
    if (current.mode.kind === "drawing") {
      const points = current.mode.points;
      return points.length > 0 &&
        hitVertex(points.slice(0, 1), p, current.viewport) === 0
        ? { kind: "drawingStart" }
        : { kind: "drawingAdd" };
    }
    const area = current.areas.find(
      (a) => a.id === selectedAreaId(current.selection),
    );
    if (area !== undefined) {
      const vertex = hitVertex(area.points, p, current.viewport);
      if (vertex !== null)
        return {
          kind: "vertex",
          areaId: area.id,
          index: vertex,
          pointCount: area.points.length,
        };
      if (hitEdge(area, p, current.viewport) !== null) return { kind: "edge" };
    }
    const inside = hitArea(current.areas, screenToImage(p, current.viewport));
    return inside !== null
      ? { kind: "area", areaId: inside }
      : { kind: "background" };
  };

  /** ドラッグ中の移動を反映する。pointermove は requestAnimationFrame で1フレームに1回にまとめる */
  const applyMove = (event: PointerEvent) => {
    const current = stateRef.current;
    const p = toScreen(event);
    if (current.image !== null) {
      const imageP = screenToImage(p, current.viewport);
      const pixel = toPixel(imageP, current.image);
      onCursorChange(pixel);
      setCursorImage(clampToImage(imageP, current.image));
      const points = current.mode.kind === "drawing" ? current.mode.points : [];
      setHoverFirstVertex(
        points.length > 0 &&
          hitVertex(points.slice(0, 1), p, current.viewport) === 0,
      );
    }
    const press = pressRef.current;
    if (
      press === null ||
      press.pointerId !== event.pointerId ||
      current.image === null
    )
      return;
    if (!press.dragging && isDrag(p.x - press.start.x, p.y - press.start.y))
      press.dragging = true;
    if (!press.dragging) return;
    if (press.target.kind === "vertex") {
      // ドラッグ中にキー操作でモードが変わったか、頂点が増減した（Delete など）ら、このドラッグはやめる。
      // 番号が詰まった後に同じ番号で動かし続けると、別の頂点が動いてしまうため
      const target = press.target;
      const area = current.areas.find((a) => a.id === target.areaId);
      if (
        current.mode.kind !== "select" ||
        area?.points.length !== target.pointCount
      ) {
        pressRef.current = null;
        return;
      }
    }
    if (press.target.kind === "vertex") {
      dispatch({
        type: "moveVertex",
        areaId: press.target.areaId,
        index: press.target.index,
        point: clampToImage(screenToImage(p, current.viewport), current.image),
      });
    } else if (press.target.kind !== "edge") {
      dispatch({ type: "pan", dx: p.x - press.last.x, dy: p.y - press.last.y });
    }
    press.last = p;
  };

  const flushMove = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (pending !== null) applyMove(pending);
  };

  const onPointerMove = (event: PointerEvent) => {
    pendingMoveRef.current = event;
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(
        guard(() => {
          frameRef.current = null;
          flushMove();
        }),
      );
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    // preventDefault でフォーカスが移らなくなるので、入力欄などからは自分で外す
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    const p = toScreen(event);
    const target = decideTarget(event, p);
    if (target === null) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    pressRef.current = {
      pointerId: event.pointerId,
      start: p,
      last: p,
      target,
      dragging: false,
    };
  };

  const onPointerUp = (event: PointerEvent) => {
    flushMove();
    const press = pressRef.current;
    if (press === null || press.pointerId !== event.pointerId) return;
    pressRef.current = null;
    const current = stateRef.current;
    if (press.dragging || current.image === null) return;
    // クリック（4画面px 未満の移動）
    const target = press.target;
    switch (target.kind) {
      case "drawingAdd":
        dispatch({
          type: "addDrawingPoint",
          point: clampToImage(
            screenToImage(toScreen(event), current.viewport),
            current.image,
          ),
        });
        return;
      case "drawingStart":
        onFinishDrawing();
        return;
      case "vertex":
        dispatch({
          type: "select",
          selection: {
            kind: "vertex",
            areaId: target.areaId,
            index: target.index,
          },
        });
        return;
      case "area":
        dispatch({
          type: "select",
          selection: { kind: "area", areaId: target.areaId },
        });
        return;
      case "background":
        dispatch({ type: "select", selection: { kind: "none" } });
        return;
      case "edge":
      case "pan":
        return;
    }
  };

  const onDoubleClick = (event: MouseEvent) => {
    const current = stateRef.current;
    if (current.mode.kind !== "select" || current.image === null) return;
    const area = current.areas.find(
      (a) => a.id === selectedAreaId(current.selection),
    );
    if (area === undefined) return;
    const p = toScreen(event);
    if (hitVertex(area.points, p, current.viewport) !== null) return;
    const edgeIndex = hitEdge(area, p, current.viewport);
    if (edgeIndex === null) return;
    dispatch({
      type: "insertVertex",
      areaId: area.id,
      edgeIndex,
      point: clampToImage(screenToImage(p, current.viewport), current.image),
    });
  };

  const onPointerLeave = () => {
    onCursorChange(null);
    setCursorImage(null);
    setHoverFirstVertex(false);
  };

  /** 画像を表示した後の最初のフレームで、読み込み時間の測定を終える */
  const onImageLoad = () => {
    requestAnimationFrame(() => {
      performance.mark("image-load-end");
      try {
        performance.measure("image-load", "image-load-start", "image-load-end");
      } catch {
        // 開始の目印がない（ページを開き直した直後など）ときは測らない
      }
    });
  };

  const drawingPoints = mode.kind === "drawing" ? mode.points : [];
  const drawingColor = areaColor(nextColorIndex(areas));
  const handle = (
    point: Point,
    radius: number,
    color: string,
    filled: boolean,
    key: string,
  ) => (
    <circle
      key={key}
      class="pae-handle"
      cx={point[0] + 0.5}
      cy={point[1] + 0.5}
      r={radius / scale}
      fill={filled ? color : "#ffffff"}
      stroke={color}
      stroke-width={2 / scale}
    />
  );

  const cursorClass = spaceHeld
    ? "pae-canvas--pan"
    : mode.kind === "drawing"
      ? "pae-canvas--draw"
      : "pae-canvas--select";

  return (
    <div class="pae-canvas-wrap">
      <svg
        ref={svgRef}
        class={`pae-canvas ${cursorClass}`}
        role="img"
        aria-label="画像とエリアのキャンバス"
        onPointerDown={guard(onPointerDown)}
        onPointerMove={guard(onPointerMove)}
        onPointerUp={guard(onPointerUp)}
        onPointerCancel={() => {
          pressRef.current = null;
        }}
        onPointerLeave={guard(onPointerLeave)}
        onDblClick={guard(onDoubleClick)}
        onContextMenu={(event) => event.preventDefault()}
      >
        {image !== null && (
          <g
            transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${scale})`}
          >
            <image
              class={
                scale >= 1 ? "pae-image pae-image--pixelated" : "pae-image"
              }
              href={image.url}
              x={0}
              y={0}
              width={image.width}
              height={image.height}
              onLoad={onImageLoad}
            />
            {areas.map((area) => {
              const color = areaColor(area.colorIndex);
              const selected = area.id === selectedId;
              const first = area.points[0];
              return (
                <g key={area.id} data-area-id={area.id}>
                  <polygon
                    class="pae-area"
                    points={toPolygonPoints(area.points)}
                    fill={color}
                    fill-opacity={0.25}
                    stroke={color}
                    stroke-width={
                      (selected ? SELECTED_AREA_STROKE_PX : AREA_STROKE_PX) /
                      scale
                    }
                    stroke-linejoin="round"
                  />
                  {first !== undefined && (
                    <text
                      class="pae-label"
                      x={first[0] + 0.5 + LABEL_OFFSET_PX / scale}
                      y={first[1] + 0.5 - LABEL_OFFSET_PX / scale}
                      font-size={LABEL_FONT_PX / scale}
                      fill={color}
                      stroke="#ffffff"
                      stroke-width={3 / scale}
                      paint-order="stroke"
                    >
                      {area.name}
                    </text>
                  )}
                </g>
              );
            })}
            {selectedArea !== undefined &&
              selectedArea.points.map((point, index) =>
                handle(
                  point,
                  HANDLE_RADIUS_PX,
                  areaColor(selectedArea.colorIndex),
                  state.selection.kind === "vertex" &&
                    state.selection.index === index,
                  `h-${index}`,
                ),
              )}
            {mode.kind === "drawing" && drawingPoints.length > 0 && (
              <g class="pae-drawing">
                <polyline
                  points={toPolygonPoints(
                    cursorImage !== null
                      ? [...drawingPoints, cursorImage]
                      : drawingPoints,
                  )}
                  fill="none"
                  stroke={drawingColor}
                  stroke-width={AREA_STROKE_PX / scale}
                  stroke-dasharray={`${6 / scale} ${4 / scale}`}
                />
                {drawingPoints.map((point, index) =>
                  handle(
                    point,
                    index === 0 && hoverFirstVertex
                      ? FIRST_VERTEX_HIGHLIGHT_RADIUS_PX
                      : HANDLE_RADIUS_PX,
                    drawingColor,
                    false,
                    `d-${index}`,
                  ),
                )}
              </g>
            )}
          </g>
        )}
      </svg>
      {image === null && (
        <p class="pae-placeholder">
          画像をドラッグ&ドロップするか、[画像を開く]を押してください
        </p>
      )}
    </div>
  );
}
