// ポリゴンエリア定義ツールのドメインの型。定義と制約は docs/functional-design.md の「ドメインの型」

/** 元画像のピクセル座標 [x, y]。x は 0〜width-1、y は 0〜height-1 の整数 */
export type Point = readonly [x: number, y: number];

/** 画像座標（小数を含む）。画面座標と取り違えないよう brand で区別する */
export type ImagePoint = {
  readonly x: number;
  readonly y: number;
  readonly __brand: "ImagePoint";
};

/** 画面座標（画面px = CSS ピクセル。キャンバスの左上が原点） */
export type ScreenPoint = {
  readonly x: number;
  readonly y: number;
  readonly __brand: "ScreenPoint";
};

export const imagePoint = (x: number, y: number): ImagePoint =>
  ({ x, y }) as ImagePoint;

export const screenPoint = (x: number, y: number): ScreenPoint =>
  ({ x, y }) as ScreenPoint;

/** 大きさ（画面px または画像px） */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** 読み込んだ画像の情報 */
export interface ImageInfo {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

/** エリア。閉じたポリゴン1つ */
export interface Area {
  /** ツール内部の識別子。UI レイヤーが作って操作で渡す。JSON には出力しない */
  readonly id: string;
  /** 前後の空白を除いた値。1〜50文字。同じ画像の中で一意 */
  readonly name: string;
  /** 3点以上。最初の点を末尾に重複して持たない */
  readonly points: readonly Point[];
  /** 表示色のパレット番号（0〜9）。JSON には出力しない */
  readonly colorIndex: number;
}

/** 表示範囲。画面座標 = 画像座標 × scale + offset */
export interface Viewport {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** エリア定義JSONのファイル形式 */
export interface AreaDefinitionFile {
  readonly version: 1;
  readonly image: ImageInfo;
  readonly areas: readonly {
    readonly name: string;
    readonly points: readonly Point[];
  }[];
}

/** 画面に表示する通知 */
export interface Message {
  readonly level: "info" | "error";
  readonly text: string;
}

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
