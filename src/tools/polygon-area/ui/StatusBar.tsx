// カーソル位置のピクセル座標・拡大率・通知の表示（docs/functional-design.md の「表示項目」）
import type { Message } from "../domain/types";

interface Props {
  cursor: readonly [number, number] | null;
  scale: number;
  message: Message | null;
}

export function StatusBar({ cursor, scale, message }: Props) {
  return (
    <div class="pae-status">
      <span class="pae-status__coords" data-testid="cursor-position">
        {cursor === null ? "x: -, y: -" : `x: ${cursor[0]}, y: ${cursor[1]}`}
      </span>
      <span class="pae-status__scale">拡大率: {Math.round(scale * 100)}%</span>
      <span
        class={`pae-status__message${message?.level === "error" ? " pae-status__message--error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message?.text ?? ""}
      </span>
    </div>
  );
}
