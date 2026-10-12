// 全てのエラーの型と、表示する文言。一覧は docs/functional-design.md の「エラーハンドリング」
import type { Message, Size } from "./types";

export type ImageLoadError =
  { readonly kind: "unsupported" } | { readonly kind: "decodeFailed" };

export type FileReadError = { readonly kind: "readFailed" };

export type DefinitionParseError =
  | { readonly kind: "invalidJson" }
  | { readonly kind: "unsupportedVersion"; readonly version: number }
  | { readonly kind: "invalidField"; readonly path: string }
  | { readonly kind: "duplicateName"; readonly name: string }
  | {
      readonly kind: "imageSizeMismatch";
      readonly json: Size;
      readonly image: Size;
    }
  | { readonly kind: "pointOutOfRange"; readonly path: string };

export type AreaNameError =
  | { readonly kind: "empty" }
  | { readonly kind: "tooLong" }
  | { readonly kind: "duplicate" };

export type EditOperationError =
  | { readonly kind: "tooFewPointsToFinish" }
  | { readonly kind: "minimumPointsRequired" };

export type FileDropError =
  | { readonly kind: "unknownFileType" }
  | { readonly kind: "imageRequiredFirst" };

export type ToolError =
  | ImageLoadError
  | FileReadError
  | DefinitionParseError
  | AreaNameError
  | EditOperationError
  | FileDropError;

const size = (s: Size) => `${s.width}×${s.height}`;

function textOf(error: ToolError): string {
  switch (error.kind) {
    case "unknownFileType":
      return "画像ファイル（PNG / JPEG / WebP など）またはエリア定義JSONを選んでください";
    case "imageRequiredFirst":
      return "先に画像を読み込んでください";
    case "unsupported":
      return "対応していない画像の形式です。PNG / JPEG / WebP / GIF / BMP の画像を選んでください";
    case "decodeFailed":
      return "画像を読み込めませんでした。ファイルが壊れていないか確認してください";
    case "readFailed":
      return "ファイルを読み込めませんでした";
    case "invalidJson":
      return "JSONの形式が正しくありません";
    case "unsupportedVersion":
      return `対応していないバージョンです（version: ${error.version}）`;
    case "invalidField":
      return error.path === ""
        ? "JSONの形式が正しくありません"
        : `${error.path} が正しくありません`;
    case "duplicateName":
      return `エリア名「${error.name}」が重複しています`;
    case "imageSizeMismatch":
      return `画像のサイズが一致しません（JSON: ${size(error.json)}、読み込んだ画像: ${size(error.image)}）`;
    case "pointOutOfRange":
      return `${error.path} が画像の範囲外です`;
    case "empty":
      return "名前を入力してください";
    case "tooLong":
      return "名前は50文字以内にしてください";
    case "duplicate":
      return "同じ名前のエリアがあります";
    case "tooFewPointsToFinish":
      return "頂点を3つ以上置いてください";
    case "minimumPointsRequired":
      return "エリアの頂点は3つ以上必要です";
  }
}

export function toMessage(error: ToolError): Message {
  return { level: "error", text: textOf(error) };
}
