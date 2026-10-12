// ツールバーのボタン（docs/functional-design.md の「ツールバーのボタンの有効・無効」）
import { useRef } from "preact/hooks";
import type { EditorMode } from "../application/editorState";

interface Props {
  mode: EditorMode["kind"];
  helpOpen: boolean;
  onOpenFiles: (files: readonly File[]) => void;
  onStartDrawing: () => void;
  onDownload: () => void;
  onFitToView: () => void;
  onToggleHelp: () => void;
}

/** ボタンにフォーカスが残ると Enter や Space でボタンも押されるので、クリックの後に外す */
/**
 * マウスで押したボタンにフォーカスが残ると、Enter や Space でボタンも押されるので外す。
 * キーボードで押したとき（detail が 0）はフォーカスを残し、Tab での移動を妨げない
 */
const blurAfter = (action: () => void) => (event: MouseEvent) => {
  if (event.detail > 0) (event.currentTarget as HTMLElement).blur();
  action();
};

export function Toolbar({
  mode,
  helpOpen,
  onOpenFiles,
  onStartDrawing,
  onDownload,
  onFitToView,
  onToggleHelp,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const onChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    onOpenFiles([...(input.files ?? [])]);
    // 同じファイルをもう一度選べるようにする
    input.value = "";
  };

  return (
    <div
      class="pae-toolbar"
      role="toolbar"
      aria-label="ポリゴンエリア定義ツールの操作"
    >
      <button
        type="button"
        onClick={blurAfter(() => imageInputRef.current?.click())}
      >
        画像を開く
      </button>
      <button
        type="button"
        disabled={mode === "noImage"}
        onClick={blurAfter(() => jsonInputRef.current?.click())}
      >
        JSONを開く
      </button>
      <button
        type="button"
        disabled={mode !== "select"}
        onClick={blurAfter(onStartDrawing)}
      >
        エリアを追加
      </button>
      <button
        type="button"
        disabled={mode !== "select"}
        onClick={blurAfter(onDownload)}
      >
        JSONをダウンロード
      </button>
      <button
        type="button"
        disabled={mode === "noImage"}
        onClick={blurAfter(onFitToView)}
      >
        全体表示
      </button>
      <button
        type="button"
        aria-expanded={helpOpen}
        onClick={blurAfter(onToggleHelp)}
      >
        操作説明
      </button>
      <input
        ref={imageInputRef}
        class="pae-file-input"
        type="file"
        accept="image/*"
        aria-label="画像ファイル"
        onChange={onChange}
      />
      <input
        ref={jsonInputRef}
        class="pae-file-input"
        type="file"
        accept=".json,application/json"
        aria-label="エリア定義JSONファイル"
        onChange={onChange}
      />
    </div>
  );
}
