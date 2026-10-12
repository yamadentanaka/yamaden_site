import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

// 制約は docs/functional-design.md の「サイトコンテンツ」のとおり。文字数はコードポイント数で数える

const text = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = [...value].length;
    return length >= min && length <= max;
  }, `${min}〜${max}文字で書く`);

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
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式の文字列で書く"),
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
