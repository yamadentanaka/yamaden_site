// @ts-check
import eslintPluginAstro from "eslint-plugin-astro";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// 依存のルールは docs/repository-structure.md、設定の作り方は docs/development-guidelines.md を参照。
// flat config では同じルールの設定は後のもので置き換わるので、1つのファイルに当たる禁止はルールごとに1つにまとめる。

const ERROR = /** @type {const} */ ("error");

/** ツールの slug の一覧。ツールを追加したらここに足す */
const tools = ["polygon-area"];

/** @typedef {"ui" | "application" | "infrastructure" | "domain"} Layer */
/** @type {Layer[]} */
const layers = ["ui", "application", "infrastructure", "domain"];

/** @type {Record<Layer, string[]>} */
const layerBans = {
  ui: [],
  application: ["**/ui/**", "**/infrastructure/**"],
  infrastructure: ["**/ui/**", "**/application/**"],
  domain: ["**/ui/**", "**/application/**", "**/infrastructure/**"],
};

/** 相対パスとテストの vitest 以外の import（外部パッケージ）を禁止する */
const externalPackages = {
  regex: "^(?!\\.|vitest$)",
  message:
    "このレイヤーでは外部パッケージを使わない（docs/repository-structure.md）",
};

const networkGlobals = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
].map((name) => ({
  name,
  message: "ツールではネットワーク通信をしない（docs/architecture.md）",
}));

const browserGlobals = [
  "window",
  "document",
  "navigator",
  "File",
  "Blob",
  "URL",
  "Image",
  "crypto",
  "performance",
  "setTimeout",
  "setInterval",
  "localStorage",
  "sessionStorage",
  "globalThis",
  "self",
].map((name) => ({
  name,
  message:
    "ドメイン・アプリケーションレイヤーではブラウザのAPIを使わない（docs/architecture.md）",
}));

const networkProperties = [
  { object: "navigator", property: "sendBeacon" },
  ...["window", "globalThis", "self"].flatMap((object) =>
    ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((property) => ({
      object,
      property,
    })),
  ),
].map((p) => ({
  ...p,
  message: "ツールではネットワーク通信をしない（docs/architecture.md）",
}));

const nondeterministicProperties = [
  { object: "Date", property: "now" },
  { object: "Math", property: "random" },
].map((p) => ({
  ...p,
  message: "決まらない値は操作の引数で受け取る（docs/architecture.md）",
}));

/** @param {Layer} layer */
const isPure = (layer) => layer === "domain" || layer === "application";

/**
 * @param {Layer} layer
 * @param {string[]} otherToolPatterns
 */
const importPatterns = (layer, otherToolPatterns) => {
  const group = [...layerBans[layer], ...otherToolPatterns];
  /** @type {object[]} */
  const patterns = group.length > 0 ? [{ group }] : [];
  if (layer !== "ui") patterns.push(externalPackages);
  if (layer === "infrastructure") {
    patterns.push({
      group: ["**/domain/**"],
      allowTypeImports: true,
      message: "インフラレイヤーはドメインレイヤーの型だけを参照する",
    });
  }
  return patterns;
};

/**
 * @param {string} dir src/tools/ の下のディレクトリ（ツールの slug か "shared"）
 * @param {Layer} layer
 * @param {string[]} otherToolPatterns
 * @returns {import("eslint").Linter.Config}
 */
const toolLayerConfig = (dir, layer, otherToolPatterns) => ({
  files: [`src/tools/${dir}/${layer}/**/*.{ts,tsx}`],
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: {
    "@typescript-eslint/no-restricted-imports": [
      ERROR,
      { patterns: importPatterns(layer, otherToolPatterns) },
    ],
    "no-restricted-globals": [
      ERROR,
      ...networkGlobals,
      ...(isPure(layer) ? browserGlobals : []),
    ],
    "no-restricted-properties": [
      ERROR,
      ...networkProperties,
      ...(isPure(layer) ? nondeterministicProperties : []),
    ],
    ...(isPure(layer)
      ? {
          "no-restricted-syntax": [
            ERROR,
            {
              selector: "NewExpression[callee.name='Date']",
              message:
                "決まらない値は操作の引数で受け取る（docs/architecture.md）",
            },
          ],
        }
      : {}),
  },
});

const toolLayerConfigs = [
  ...tools.flatMap((slug) =>
    layers.map((layer) =>
      toolLayerConfig(
        slug,
        layer,
        tools.filter((t) => t !== slug).map((t) => `**/${t}/**`),
      ),
    ),
  ),
  ...layers.map((layer) =>
    toolLayerConfig(
      "shared",
      layer,
      tools.map((t) => `**/${t}/**`),
    ),
  ),
];

/**
 * @param {string[]} files
 * @param {object} options @typescript-eslint/no-restricted-imports のオプション
 * @returns {import("eslint").Linter.Config}
 */
const restrictImports = (files, options) => ({
  files,
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: { "@typescript-eslint/no-restricted-imports": [ERROR, options] },
});

const siteConfigs = [
  restrictImports(["src/pages/**"], {
    patterns: [
      {
        group: [
          "**/tools/*/application/**",
          "**/tools/*/domain/**",
          "**/tools/*/infrastructure/**",
        ],
        message:
          "ページからはツールの UI レイヤーのルートコンポーネントだけを使う",
      },
    ],
  }),
  restrictImports(["src/layouts/**"], {
    paths: [
      {
        name: "astro:content",
        message: "コンテンツを読むのは src/pages/ だけ",
      },
    ],
    patterns: [{ group: ["**/tools/**", "**/pages/**"] }],
  }),
  restrictImports(["src/components/**"], {
    paths: [
      {
        name: "astro:content",
        allowTypeImports: true,
        message: "部品はコンテンツを直接読まない（型だけ参照してよい）",
      },
    ],
    patterns: [{ group: ["**/tools/**", "**/pages/**", "**/layouts/**"] }],
  }),
  restrictImports(["src/routing/**"], {
    patterns: [
      {
        regex: "^(?!\\./|vitest$)",
        message:
          "src/routing/ は他に依存しない（同じディレクトリとテストの vitest だけ）",
      },
    ],
  }),
  restrictImports(["src/content.config.ts"], {
    patterns: [
      {
        regex: "^(?!astro:content$|astro/loaders$|astro/zod$)",
        message:
          "content.config.ts は astro:content・astro/loaders・astro/zod だけを使う",
      },
    ],
  }),
  restrictImports(["src/content/**/*.test.ts"], {
    patterns: [
      {
        regex: "^(?!node:fs/promises$|node:path$|yaml$|vitest$)",
        message:
          "コンテンツのテストは node:fs/promises・node:path・yaml・vitest だけを使う",
      },
    ],
  }),
  restrictImports(["tests/**"], {
    patterns: [
      { group: ["**/src/**"], message: "E2E テストは src/ に依存しない" },
    ],
  }),
];

export default defineConfig(
  globalIgnores([
    "dist/",
    ".astro/",
    "coverage/",
    "test-results/",
    "playwright-report/",
    "tmp/",
    ".steering/",
    "reviews/",
  ]),
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintPluginAstro.configs.recommended,
  {
    rules: { "no-console": [ERROR, { allow: ["error"] }] },
  },
  ...toolLayerConfigs,
  ...siteConfigs,
);
