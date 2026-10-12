import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4321/yamaden_site/";

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? "github" : "list",
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // --ignore-lock: AI エージェントの中で実行すると Astro が preview を自動でバックグラウンドにするので、それを止める
    // CI では前の手順で build 済みなので配信だけにする。手元では build してから配信する
    command: process.env["CI"]
      ? "pnpm preview --ignore-lock"
      : "pnpm build && pnpm preview --ignore-lock",
    url: baseURL,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
