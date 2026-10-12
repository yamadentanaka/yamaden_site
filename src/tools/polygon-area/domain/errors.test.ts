import { describe, expect, it } from "vitest";
import { toMessage } from "./errors";
import type { ToolError } from "./errors";

describe("toMessage", () => {
  it.each<[ToolError, string]>([
    [
      { kind: "unknownFileType" },
      "画像ファイル（PNG / JPEG / WebP など）またはエリア定義JSONを選んでください",
    ],
    [{ kind: "imageRequiredFirst" }, "先に画像を読み込んでください"],
    [
      { kind: "unsupported" },
      "対応していない画像の形式です。PNG / JPEG / WebP / GIF / BMP の画像を選んでください",
    ],
    [
      { kind: "decodeFailed" },
      "画像を読み込めませんでした。ファイルが壊れていないか確認してください",
    ],
    [{ kind: "readFailed" }, "ファイルを読み込めませんでした"],
    [{ kind: "invalidJson" }, "JSONの形式が正しくありません"],
    [
      { kind: "unsupportedVersion", version: 2 },
      "対応していないバージョンです（version: 2）",
    ],
    [
      { kind: "invalidField", path: "areas[1].points" },
      "areas[1].points が正しくありません",
    ],
    [{ kind: "invalidField", path: "" }, "JSONの形式が正しくありません"],
    [
      { kind: "duplicateName", name: "判定エリアA" },
      "エリア名「判定エリアA」が重複しています",
    ],
    [
      {
        kind: "imageSizeMismatch",
        json: { width: 1920, height: 1080 },
        image: { width: 1280, height: 720 },
      },
      "画像のサイズが一致しません（JSON: 1920×1080、読み込んだ画像: 1280×720）",
    ],
    [
      { kind: "pointOutOfRange", path: "areas[0].points[2]" },
      "areas[0].points[2] が画像の範囲外です",
    ],
    [{ kind: "empty" }, "名前を入力してください"],
    [{ kind: "tooLong" }, "名前は50文字以内にしてください"],
    [{ kind: "duplicate" }, "同じ名前のエリアがあります"],
    [{ kind: "tooFewPointsToFinish" }, "頂点を3つ以上置いてください"],
    [{ kind: "minimumPointsRequired" }, "エリアの頂点は3つ以上必要です"],
  ])("%o の文言を error の通知にする", (error, text) => {
    expect(toMessage(error)).toEqual({ level: "error", text });
  });
});
