import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/tools/*/{domain,application}/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90 },
    },
  },
});
