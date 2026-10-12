// エリアの一覧。選択・名前の編集・削除（docs/functional-design.md の「操作一覧」）
import { useRef, useState } from "preact/hooks";
import type { EditorAction } from "../application/editorState";
import { areaColor, validateAreaName } from "../domain/area";
import { toMessage } from "../domain/errors";
import type { Area } from "../domain/types";

interface Props {
  areas: readonly Area[];
  selectedAreaId: string | null;
  canSelect: boolean;
  dispatch: (action: EditorAction) => void;
  onUnexpectedError: (error: unknown) => void;
}

export function AreaList({
  areas,
  selectedAreaId,
  canSelect,
  dispatch,
  onUnexpectedError,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Enter や Esc で閉じた後に、blur で二重に確定しないようにする
  const closingRef = useRef(false);

  const startEditing = (area: Area) => {
    if (!canSelect) return;
    dispatch({ type: "select", selection: { kind: "area", areaId: area.id } });
    closingRef.current = false;
    setEditingId(area.id);
    setDraft(area.name);
  };

  const close = () => {
    closingRef.current = true;
    setEditingId(null);
  };

  /** UI で先に検証し、通ったときだけ renameArea を送る */
  const commit = (areaId: string, keepOpenOnError: boolean) => {
    try {
      commitName(areaId, keepOpenOnError);
    } catch (error) {
      onUnexpectedError(error);
    }
  };

  const commitName = (areaId: string, keepOpenOnError: boolean) => {
    const result = validateAreaName(draft, areas, areaId);
    if (!result.ok) {
      dispatch({ type: "showMessage", message: toMessage(result.error) });
      if (!keepOpenOnError) close();
      return;
    }
    dispatch({ type: "renameArea", areaId, name: result.value });
    close();
  };

  return (
    <aside class="pae-areas" aria-label="エリア一覧">
      <h2 class="pae-areas__title">エリア一覧</h2>
      {areas.length === 0 ? (
        <p class="pae-areas__empty">エリアはまだありません</p>
      ) : (
        <ul class="pae-areas__list">
          {areas.map((area) => (
            <li
              key={area.id}
              class={`pae-areas__item${area.id === selectedAreaId ? " pae-areas__item--selected" : ""}`}
              data-area-id={area.id}
              onClick={() => {
                if (canSelect && editingId !== area.id) {
                  dispatch({
                    type: "select",
                    selection: { kind: "area", areaId: area.id },
                  });
                }
              }}
            >
              <svg
                class="pae-areas__swatch"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <rect
                  width="12"
                  height="12"
                  rx="2"
                  fill={areaColor(area.colorIndex)}
                />
              </svg>
              {editingId === area.id ? (
                <input
                  class="pae-areas__input"
                  value={draft}
                  aria-label="エリア名"
                  // 編集を始めたらすぐ入力できるようにする
                  ref={(element) => element?.focus()}
                  onInput={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    // IME の変換を確定・取り消す Enter・Esc は、名前の編集の確定・取り消しに使わない（229 は Safari）
                    if (event.isComposing || event.keyCode === 229) return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commit(area.id, true);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      close();
                    }
                  }}
                  onBlur={() => {
                    if (!closingRef.current) commit(area.id, false);
                  }}
                />
              ) : (
                <span
                  class="pae-areas__name"
                  title="ダブルクリックで名前を変更"
                  onDblClick={() => startEditing(area)}
                >
                  {area.name}
                </span>
              )}
              <span class="pae-areas__count">{area.points.length}点</span>
              <button
                type="button"
                class="pae-areas__delete"
                aria-label={`${area.name}を削除`}
                onClick={(event) => {
                  event.stopPropagation();
                  (event.currentTarget as HTMLElement).blur();
                  dispatch({ type: "deleteArea", areaId: area.id });
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
