import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// スキーマでは確かめられない、複数件にまたがる制約を確かめる（docs/architecture.md）

const contentDir = join(import.meta.dirname, ".");

async function readEntries(fileName: string): Promise<unknown[]> {
  const parsed: unknown = parse(
    await readFile(join(contentDir, fileName), "utf-8"),
  );
  if (!Array.isArray(parsed)) throw new Error(`${fileName} は配列で書く`);
  return parsed as unknown[];
}

function idsOf(entries: unknown[]): unknown[] {
  return entries.map((entry) =>
    typeof entry === "object" && entry !== null && "id" in entry
      ? entry.id
      : undefined,
  );
}

describe.each(["achievements.yaml", "news.yaml"])("%s", (fileName) => {
  it("全ての id が小文字英数字とハイフンだけの文字列である", async () => {
    // Given
    const ids = idsOf(await readEntries(fileName));
    // Then
    for (const id of ids) {
      expect(
        typeof id === "string" && /^[a-z0-9-]+$/.test(id),
        `id: ${String(id)}`,
      ).toBe(true);
    }
  });

  it("id が重複していない", async () => {
    // Given
    const ids = idsOf(await readEntries(fileName));
    // Then
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("tools/", () => {
  it("ツール情報のファイル名（slug）が小文字英数字とハイフンだけで、shared ではない", async () => {
    // Given
    const files = (await readdir(join(contentDir, "tools"))).filter((name) =>
      name.endsWith(".yaml"),
    );
    // Then
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const slug = file.replace(/\.yaml$/, "");
      expect(
        /^[a-z0-9-]+$/.test(slug) && slug !== "shared",
        `slug: ${slug}`,
      ).toBe(true);
    }
  });
});
