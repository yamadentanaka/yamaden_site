// ボタンで選んだファイルとドロップしたファイルの振り分け（docs/functional-design.md の「ファイルの振り分け」）

export type FileKind = "image" | "json" | "unknown";

export function classifyFile(file: {
  readonly name: string;
  readonly type: string;
}): FileKind {
  if (file.type.startsWith("image/")) return "image";
  if (
    file.name.toLowerCase().endsWith(".json") ||
    file.type === "application/json"
  )
    return "json";
  return "unknown";
}
