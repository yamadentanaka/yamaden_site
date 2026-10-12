import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** CSP の違反を記録する（ページの CSP の影響を受けない初期化スクリプトで登録する） */
async function recordCspViolations(
  page: Page,
): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations =
      violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy/i.test(message.text())
    ) {
      consoleErrors.push(message.text());
    }
  });
  return async () => [
    ...(await page.evaluate(
      () =>
        (window as unknown as { __cspViolations: string[] }).__cspViolations,
    )),
    ...consoleErrors,
  ];
}

test.describe("サイト", () => {
  for (const [name, path] of [
    ["トップ", "./"],
    ["ツール一覧", "./tools/"],
    ["ポリゴンエリア定義ツール", "./tools/polygon-area/"],
  ] as const) {
    test(`${name}のページで CSP の違反が出ない`, async ({ page }) => {
      // Given
      const violations = await recordCspViolations(page);
      // When
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Then
      expect(await violations()).toEqual([]);
    });
  }

  test("トップページに会社名・事業内容・実績を表示する", async ({ page }) => {
    await page.goto("./");
    await expect(
      page.getByRole("heading", { level: 1, name: "有限会社山田田中商店" }),
    ).toBeVisible();
    await expect(
      page.getByText("顧客企業の研究開発チームに参画し"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "実績" })).toBeVisible();
    // お知らせは0件なので、見出しごと表示しない
    await expect(page.getByRole("heading", { name: "お知らせ" })).toHaveCount(
      0,
    );
  });

  test("トップページ → ツール一覧 → ポリゴンエリア定義ツールと移動できる", async ({
    page,
  }) => {
    await page.goto("./");
    await page
      .getByRole("navigation", { name: "サイト内" })
      .getByRole("link", { name: "ツール" })
      .click();
    await expect(page).toHaveTitle("ツール | 有限会社山田田中商店");
    await page.getByRole("link", { name: /ポリゴンエリア定義ツール/ }).click();
    await expect(page).toHaveTitle(
      "ポリゴンエリア定義ツール | 有限会社山田田中商店",
    );
    await expect(
      page.getByRole("button", { name: "画像を開く" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "有限会社山田田中商店" }).click();
    await expect(page).toHaveTitle("有限会社山田田中商店");
  });

  test("ツール一覧の全てのリンク先が開ける", async ({ page, request }) => {
    await page.goto("./tools/");
    const hrefs = await page
      .locator(".tool-list a")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
      );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });
});
