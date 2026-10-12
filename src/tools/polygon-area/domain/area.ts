// エリア名の規則と表示色（docs/functional-design.md の「エリア名と表示色」）
import type { AreaNameError } from "./errors";
import { err, ok } from "./types";
import type { Area, Result } from "./types";

export const MAX_AREA_NAME_LENGTH = 50;

/** 表示色のパレット。番号は Area.colorIndex */
export const AREA_COLORS = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#9a6324",
  "#469990",
] as const;

export const areaColor = (colorIndex: number): string =>
  AREA_COLORS[colorIndex % AREA_COLORS.length] ?? AREA_COLORS[0];

/** 前後の空白を除く。保存と比較の両方に使う */
export const normalizeAreaName = (name: string): string => name.trim();

/** 文字数はコードポイント数で数える */
export const nameLength = (name: string): number => [...name].length;

/**
 * 名前を検証し、正規化した名前を返す
 * @param selfId 名前を変えるエリアの id（自分自身とは重複とみなさない）
 */
export function validateAreaName(
  name: string,
  areas: readonly Area[],
  selfId?: string,
): Result<string, AreaNameError> {
  const normalized = normalizeAreaName(name);
  if (normalized === "") return err({ kind: "empty" });
  if (nameLength(normalized) > MAX_AREA_NAME_LENGTH)
    return err({ kind: "tooLong" });
  if (areas.some((area) => area.id !== selfId && area.name === normalized))
    return err({ kind: "duplicate" });
  return ok(normalized);
}

/** `エリア{n}`。n は既存の名前と重ならない最小の整数 */
export function nextDefaultName(areas: readonly Area[]): string {
  const names = new Set(areas.map((area) => area.name));
  for (let n = 1; ; n++) {
    const name = `エリア${n}`;
    if (!names.has(name)) return name;
  }
}

/** 使われている回数が最も少ない色のうち、番号が最小の色 */
export function nextColorIndex(
  areas: readonly Pick<Area, "colorIndex">[],
): number {
  const counts = AREA_COLORS.map(() => 0);
  for (const area of areas) {
    const index = area.colorIndex % AREA_COLORS.length;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const min = Math.min(...counts);
  return counts.indexOf(min);
}
