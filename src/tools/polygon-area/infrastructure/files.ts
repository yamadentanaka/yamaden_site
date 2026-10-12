// PC のファイルの読み込みと保存。ネットワーク通信はしない（docs/architecture.md の「インフラレイヤー」）
import type { FileReadError, ImageLoadError } from "../domain/errors";
import type { ImageInfo, Result } from "../domain/types";

/** ブラウザで表示できることを確かめた画像の形式 */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

export type LoadedImageFile = ImageInfo & { readonly url: string };

function decode(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 画像を読み込み、ローカルURL（blob:）と大きさを返す */
export async function loadImageFile(
  file: File,
): Promise<Result<LoadedImageFile, ImageLoadError>> {
  // 読み込み時間の測定の開始（docs/architecture.md の「測定のための目印」）
  performance.mark("image-load-start");
  if (!SUPPORTED_IMAGE_TYPES.has(file.type))
    return { ok: false, error: { kind: "unsupported" } };
  const url = URL.createObjectURL(file);
  const img = await decode(url);
  if (img === null || img.naturalWidth === 0 || img.naturalHeight === 0) {
    URL.revokeObjectURL(url);
    return { ok: false, error: { kind: "decodeFailed" } };
  }
  return {
    ok: true,
    value: {
      name: file.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      url,
    },
  };
}

export async function readTextFile(
  file: File,
): Promise<Result<string, FileReadError>> {
  try {
    return { ok: true, value: await file.text() };
  } catch {
    return { ok: false, error: { kind: "readFailed" } };
  }
}

/** テキストをファイルとして保存（ダウンロード）させる */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // クリックの処理が終わってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function releaseImageUrl(url: string): void {
  URL.revokeObjectURL(url);
}
