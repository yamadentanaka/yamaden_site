/**
 * サイト内のリンクを作る。base の扱いはここだけに閉じ込める（docs/architecture.md の「公開」）。
 * @param path 先頭に `/` を付けないパス。トップページは `""`
 */
export function withBase(path: string): string {
  if (path.startsWith("/")) {
    throw new Error(`withBase には先頭に / を付けないパスを渡す: ${path}`);
  }
  // trailingSlash: "always" なので BASE_URL の末尾は "/" だが、念のため揃える
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}
