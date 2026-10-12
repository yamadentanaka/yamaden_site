import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const fixtures = join(import.meta.dirname, "..", "fixtures");
const IMAGE = join(fixtures, "pattern-200x100.png");
const IMAGE_WIDTH = 200;
const TWO_AREAS_JSON = join(fixtures, "two-areas.areas.json");

const imageInput = (page: Page) => page.getByLabel("画像ファイル");
const jsonInput = (page: Page) => page.getByLabel("エリア定義JSONファイル");
const status = (page: Page) => page.getByRole("status");
const areaItems = (page: Page) => page.locator(".pae-areas__item");

async function openTool(page: Page) {
  await page.goto("./tools/polygon-area/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "画像を開く" })).toBeVisible();
}

async function openImage(page: Page) {
  await imageInput(page).setInputFiles(IMAGE);
  await expect(page.locator(".pae-image")).toBeVisible();
}

/** 画像のピクセル [x, y] の中心の、ページ上の座標 */
async function pixelPosition(page: Page, [x, y]: readonly [number, number]) {
  const box = await page.locator(".pae-image").boundingBox();
  if (box === null) throw new Error("画像が表示されていない");
  const scale = box.width / IMAGE_WIDTH;
  return { x: box.x + (x + 0.5) * scale, y: box.y + (y + 0.5) * scale };
}

async function clickPixel(page: Page, pixel: readonly [number, number]) {
  const { x, y } = await pixelPosition(page, pixel);
  await page.mouse.click(x, y);
}

async function drawArea(
  page: Page,
  points: readonly (readonly [number, number])[],
  finish: "start" | "enter",
) {
  await page.getByRole("button", { name: "エリアを追加" }).click();
  for (const point of points) await clickPixel(page, point);
  const first = points[0];
  if (finish === "start" && first !== undefined) await clickPixel(page, first);
  else await page.keyboard.press("Enter");
}

async function downloadJson(
  page: Page,
): Promise<{ fileName: string; text: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSONをダウンロード" }).click(),
  ]);
  const path = await download.path();
  return {
    fileName: download.suggestedFilename(),
    text: await readFile(path, "utf-8"),
  };
}

const nameOf = (item: Locator) => item.locator(".pae-areas__name");

test.describe("ポリゴンエリア定義ツール", () => {
  test("画像を読み込み、エリアを2つ描いて、エリア定義JSONをダウンロードできる", async ({
    page,
  }) => {
    // Given
    await openTool(page);
    await openImage(page);
    // When: 1つ目は始点のクリック、2つ目は Enter で確定する
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "start",
    );
    await drawArea(
      page,
      [
        [100, 20],
        [180, 20],
        [180, 90],
        [100, 90],
      ],
      "enter",
    );
    const { fileName, text } = await downloadJson(page);
    // Then
    expect(fileName).toBe("pattern-200x100.areas.json");
    expect(JSON.parse(text)).toEqual({
      version: 1,
      image: { name: "pattern-200x100.png", width: 200, height: 100 },
      areas: [
        {
          name: "エリア1",
          points: [
            [10, 10],
            [60, 10],
            [60, 50],
          ],
        },
        {
          name: "エリア2",
          points: [
            [100, 20],
            [180, 20],
            [180, 90],
            [100, 90],
          ],
        },
      ],
    });
    expect(text.endsWith("}\n")).toBe(true);
  });

  test("ダウンロードしたJSONを読み込むとエリアが復元され、もう一度ダウンロードすると内容が一致する", async ({
    page,
  }) => {
    // Given
    await openTool(page);
    await openImage(page);
    // When
    await jsonInput(page).setInputFiles(TWO_AREAS_JSON);
    // Then
    await expect(areaItems(page)).toHaveCount(2);
    await expect(nameOf(areaItems(page).nth(0))).toHaveText("入口");
    await expect(nameOf(areaItems(page).nth(1))).toHaveText("通路");
    const { text } = await downloadJson(page);
    expect(text).toBe(await readFile(TWO_AREAS_JSON, "utf-8"));
  });

  test("画像とJSONを読み込んで操作する間に、http・https のリクエストが発生しない", async ({
    page,
  }) => {
    // Given: ページの読み込みが終わってから監視を始める
    await openTool(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("http:") || url.startsWith("https:"))
        requests.push(url);
    });
    // When
    await openImage(page);
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "enter",
    );
    await downloadJson(page);
    page.once("dialog", (dialog) => void dialog.accept());
    await jsonInput(page).setInputFiles(TWO_AREAS_JSON);
    await expect(areaItems(page)).toHaveCount(2);
    // Then
    expect(requests).toEqual([]);
  });

  test("カーソル位置のピクセル座標と拡大率を表示し、ホイールで拡大する", async ({
    page,
  }) => {
    await openTool(page);
    await openImage(page);
    const position = await pixelPosition(page, [12, 34]);
    await page.mouse.move(position.x, position.y);
    await expect(page.getByTestId("cursor-position")).toHaveText(
      "x: 12, y: 34",
    );
    const before = await page.locator(".pae-status__scale").textContent();
    await page.mouse.wheel(0, -100);
    await expect(page.locator(".pae-status__scale")).not.toHaveText(
      before ?? "",
    );
    // 拡大してもカーソルの下のピクセルは変わらない
    await page.mouse.move(position.x, position.y);
    await expect(page.getByTestId("cursor-position")).toHaveText(
      "x: 12, y: 34",
    );
  });

  test("頂点の移動・辺への頂点の挿入・頂点の削除ができる", async ({ page }) => {
    // Given: 4点のエリアを選択した状態
    await openTool(page);
    await openImage(page);
    await drawArea(
      page,
      [
        [20, 20],
        [80, 20],
        [80, 80],
        [20, 80],
      ],
      "enter",
    );
    // When: 頂点 [80, 80] を [90, 70] にドラッグする
    const from = await pixelPosition(page, [80, 80]);
    const to = await pixelPosition(page, [90, 70]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    // When: 上の辺の中央をダブルクリックして頂点を挿入する
    const edge = await pixelPosition(page, [50, 20]);
    await page.mouse.dblclick(edge.x, edge.y);
    await expect(
      areaItems(page).first().locator(".pae-areas__count"),
    ).toHaveText("5点");
    // When: 挿入した頂点（選択中）を Delete で削除する
    await page.keyboard.press("Delete");
    await expect(
      areaItems(page).first().locator(".pae-areas__count"),
    ).toHaveText("4点");
    // Then
    const { text } = await downloadJson(page);
    const saved = JSON.parse(text) as { areas: { points: number[][] }[] };
    expect(saved.areas[0]?.points).toEqual([
      [20, 20],
      [80, 20],
      [90, 70],
      [20, 80],
    ]);
  });

  test("エリア一覧で名前を変え、エリアを削除できる", async ({ page }) => {
    await openTool(page);
    await openImage(page);
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "enter",
    );
    // 名前の変更（重複はエラーで、入力欄は開いたまま）
    await drawArea(
      page,
      [
        [100, 20],
        [180, 20],
        [140, 90],
      ],
      "enter",
    );
    await nameOf(areaItems(page).nth(1)).dblclick();
    const input = page.getByLabel("エリア名");
    await input.fill("エリア1");
    await input.press("Enter");
    await expect(status(page)).toHaveText("同じ名前のエリアがあります");
    await expect(input).toBeVisible();
    await input.fill(" 通路 ");
    await input.press("Enter");
    await expect(nameOf(areaItems(page).nth(1))).toHaveText("通路");
    // 削除
    await areaItems(page)
      .nth(0)
      .getByRole("button", { name: "エリア1を削除" })
      .click();
    await expect(areaItems(page)).toHaveCount(1);
    await expect(nameOf(areaItems(page).first())).toHaveText("通路");
  });

  test("IME の変換を確定する Enter では、名前の編集を確定しない", async ({
    page,
  }) => {
    // Given: 名前を編集中
    await openTool(page);
    await openImage(page);
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "enter",
    );
    await nameOf(areaItems(page).first()).dblclick();
    const input = page.getByLabel("エリア名");
    await input.fill("判定");
    // When: 変換中（isComposing）の Enter
    await input.dispatchEvent("keydown", {
      key: "Enter",
      isComposing: true,
      bubbles: true,
    });
    // Then: 入力欄は開いたままで、続けて入力できる
    await expect(input).toBeVisible();
    await input.fill("判定エリアA");
    await input.press("Enter");
    await expect(nameOf(areaItems(page).first())).toHaveText("判定エリアA");
  });

  test("名前の編集中にキャンバスを押すと、名前を確定して入力欄からフォーカスを外す", async ({
    page,
  }) => {
    // Given: 名前を編集中
    await openTool(page);
    await openImage(page);
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "enter",
    );
    await nameOf(areaItems(page).first()).dblclick();
    await page.getByLabel("エリア名").fill("入口");
    // When
    await clickPixel(page, [150, 80]);
    // Then
    await expect(page.getByLabel("エリア名")).toHaveCount(0);
    await expect(nameOf(areaItems(page).first())).toHaveText("入口");
    // キー操作がツールに届く（N で描画を始めると「エリアを追加」が押せなくなる）
    await page.keyboard.press("n");
    await expect(
      page.getByRole("button", { name: "エリアを追加" }),
    ).toBeDisabled();
  });

  test("2点以下で確定しようとすると、確定せずに通知を出す", async ({
    page,
  }) => {
    await openTool(page);
    await openImage(page);
    await page.getByRole("button", { name: "エリアを追加" }).click();
    await clickPixel(page, [10, 10]);
    await clickPixel(page, [50, 10]);
    // 始点のクリックでも Enter でも確定しない
    await clickPixel(page, [10, 10]);
    await expect(status(page)).toHaveText("頂点を3つ以上置いてください");
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("頂点を3つ以上置いてください");
    await expect(areaItems(page)).toHaveCount(0);
    // Esc で中止できる
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "エリアを追加" }),
    ).toBeEnabled();
  });

  test("画像サイズが違うJSONや、画像でもJSONでもないファイルは読み込まない", async ({
    page,
  }) => {
    await openTool(page);
    await openImage(page);
    await jsonInput(page).setInputFiles({
      name: "other.areas.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          image: { name: "x.jpg", width: 1920, height: 1080 },
          areas: [],
        }),
      ),
    });
    await expect(status(page)).toHaveText(
      "画像のサイズが一致しません（JSON: 1920×1080、読み込んだ画像: 200×100）",
    );
    await imageInput(page).setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(status(page)).toHaveText(
      "画像ファイル（PNG / JPEG / WebP など）またはエリア定義JSONを選んでください",
    );
    await jsonInput(page).setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
    await expect(status(page)).toHaveText("JSONの形式が正しくありません");
  });

  test("エリアがある状態で画像を開き直すときは確認し、キャンセルなら何も変えない", async ({
    page,
  }) => {
    await openTool(page);
    await openImage(page);
    await drawArea(
      page,
      [
        [10, 10],
        [60, 10],
        [60, 50],
      ],
      "enter",
    );
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("エリアは全て消えます。よろしいですか？");
      void dialog.dismiss();
    });
    await imageInput(page).setInputFiles(IMAGE);
    await expect(areaItems(page)).toHaveCount(1);
    page.once("dialog", (dialog) => void dialog.accept());
    await imageInput(page).setInputFiles(IMAGE);
    await expect(areaItems(page)).toHaveCount(0);
  });

  test("操作説明を開閉できる", async ({ page }) => {
    await openTool(page);
    const help = page.getByRole("region", { name: "操作説明" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("辺をダブルクリックで頂点を追加");
    await page.getByRole("button", { name: "操作説明" }).click();
    await expect(help).toHaveCount(0);
  });
});
