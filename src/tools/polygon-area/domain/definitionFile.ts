// エリア定義JSONの出力・解析・検証（docs/functional-design.md の「JSONの出力」「JSONの検証」）
import { MAX_AREA_NAME_LENGTH, nameLength, normalizeAreaName } from "./area";
import type { DefinitionParseError } from "./errors";
import { err, ok } from "./types";
import type {
  Area,
  AreaDefinitionFile,
  ImageInfo,
  Point,
  Result,
} from "./types";

export const DEFINITION_FILE_VERSION = 1;
const MIN_POINTS = 3;

/** 出力する項目だけで新しいオブジェクトを作る（url・id・colorIndex は出力しない） */
export function serialize(image: ImageInfo, areas: readonly Area[]): string {
  const data = {
    version: DEFINITION_FILE_VERSION,
    image: { name: image.name, width: image.width, height: image.height },
    areas: areas.map((area) => ({
      name: area.name,
      points: area.points.map(([x, y]) => [x, y]),
    })),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** 画像のファイル名の最後の `.` から後ろを除き、`.areas.json` を付ける */
export function definitionFileName(imageName: string): string {
  const dot = imageName.lastIndexOf(".");
  const base = dot <= 0 ? imageName : imageName.slice(0, dot);
  return `${base}.areas.json`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

const isIntegerPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((v) => typeof v === "number" && Number.isInteger(v));

const invalid = (path: string): Result<never, DefinitionParseError> =>
  err({ kind: "invalidField", path });

function parseImage(value: unknown): Result<ImageInfo, DefinitionParseError> {
  if (!isRecord(value)) return invalid("image");
  const { name, width, height } = value;
  if (typeof name !== "string" || name.length === 0)
    return invalid("image.name");
  if (!isPositiveInteger(width)) return invalid("image.width");
  if (!isPositiveInteger(height)) return invalid("image.height");
  return ok({ name, width, height });
}

function parseArea(
  value: unknown,
  i: number,
): Result<{ name: string; points: readonly Point[] }, DefinitionParseError> {
  const path = `areas[${i}]`;
  if (!isRecord(value)) return invalid(path);
  if (typeof value["name"] !== "string") return invalid(`${path}.name`);
  const name = normalizeAreaName(value["name"]);
  if (name === "" || nameLength(name) > MAX_AREA_NAME_LENGTH)
    return invalid(`${path}.name`);
  const points = value["points"];
  if (!Array.isArray(points) || points.length < MIN_POINTS)
    return invalid(`${path}.points`);
  const result: Point[] = [];
  for (const [j, point] of points.entries()) {
    if (!isIntegerPair(point)) return invalid(`${path}.points[${j}]`);
    result.push([point[0], point[1]]);
  }
  return ok({ name, points: result });
}

/** JSON の文字列を検証して AreaDefinitionFile にする。エリア名は正規化した値で返す */
export function parse(
  text: string,
): Result<AreaDefinitionFile, DefinitionParseError> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err({ kind: "invalidJson" });
  }
  if (!isRecord(json)) return invalid("");
  const { version } = json;
  if (typeof version !== "number") return invalid("version");
  if (version !== DEFINITION_FILE_VERSION)
    return err({ kind: "unsupportedVersion", version });

  const image = parseImage(json["image"]);
  if (!image.ok) return image;

  const rawAreas = json["areas"];
  if (!Array.isArray(rawAreas)) return invalid("areas");
  const areas: { name: string; points: readonly Point[] }[] = [];
  for (const [i, rawArea] of rawAreas.entries()) {
    const area = parseArea(rawArea, i);
    if (!area.ok) return area;
    areas.push(area.value);
  }

  const seen = new Set<string>();
  for (const area of areas) {
    if (seen.has(area.name))
      return err({ kind: "duplicateName", name: area.name });
    seen.add(area.name);
  }

  return ok({ version: DEFINITION_FILE_VERSION, image: image.value, areas });
}

/** 読み込んでいる画像に使えるかを確かめる（サイズの一致と、座標の範囲） */
export function checkCompatibility(
  file: AreaDefinitionFile,
  image: ImageInfo,
): Result<void, DefinitionParseError> {
  if (file.image.width !== image.width || file.image.height !== image.height) {
    return err({
      kind: "imageSizeMismatch",
      json: { width: file.image.width, height: file.image.height },
      image: { width: image.width, height: image.height },
    });
  }
  for (const [i, area] of file.areas.entries()) {
    for (const [j, [x, y]] of area.points.entries()) {
      if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) {
        return err({
          kind: "pointOutOfRange",
          path: `areas[${i}].points[${j}]`,
        });
      }
    }
  }
  return ok(undefined);
}
