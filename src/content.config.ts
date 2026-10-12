import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

// 制約は docs/functional-design.md の「サイトコンテンツ」のとおり。文字数はコードポイント数で数える

const text = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = [...value].length;
    return length >= min && length <= max;
  }, `${min}〜${max}文字で書く`);

/** "2026-02-30" や "2026-13-01" のような、実在しない日付を弾く */
const isRealDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined)
    return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const achievements = defineCollection({
  loader: file("src/content/achievements.yaml"),
  schema: z.object({
    year: z.number().int().min(1000).max(9999),
    order: z.number().int().min(0).optional(),
    title: text(1, 100),
    description: text(1, 200),
  }),
});

const news = defineCollection({
  loader: file("src/content/news.yaml"),
  schema: z.object({
    // YAML では必ずクォートする（クォートしないと Date 型になり、ここで失敗する）
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式の文字列で書く")
      .refine(isRealDate, "実在する日付を書く"),
    title: text(1, 100),
    body: text(0, 500).optional(),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "src/content/tools" }),
  schema: z.object({
    name: text(1, 40),
    description: text(1, 120),
    order: z.number().int().min(0),
  }),
});

export const collections = { achievements, news, tools };
