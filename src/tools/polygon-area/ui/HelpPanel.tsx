// 操作説明（docs/functional-design.md の「操作説明」）

const ITEMS: readonly (readonly [title: string, text: string])[] = [
  ["画像を開く", "[画像を開く] を押すか、画像をドラッグ&ドロップ"],
  [
    "エリアを描く",
    "[エリアを追加]（N）→ 画像をクリックして頂点を置く → 始点をクリックか Enter で確定。Backspace で1つ戻す、Esc で中止",
  ],
  [
    "編集する",
    "エリアをクリックして選択 → 頂点をドラッグで移動、辺をダブルクリックで頂点を追加、頂点を選んで Delete で削除。エリアを選んで Delete、またはエリア一覧の [削除] でエリアを削除。Esc で選択を解除",
  ],
  ["名前を変える", "エリア一覧の名前をダブルクリック"],
  [
    "拡大・移動",
    "ホイールで拡大縮小、背景をドラッグか Space + ドラッグで移動、0 で全体表示",
  ],
  [
    "保存・再開",
    "[JSONをダウンロード] で保存、画像を開いてから [JSONを開く] で再開",
  ],
];

export function HelpPanel() {
  return (
    <section class="pae-help" aria-label="操作説明">
      <ol>
        {ITEMS.map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong>: {text}
          </li>
        ))}
      </ol>
    </section>
  );
}
