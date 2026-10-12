# 開発ガイドライン (Development Guidelines)

技術スタックは [architecture.md](architecture.md)、ファイルの配置は [repository-structure.md](repository-structure.md) を参照。ここには、このプロジェクトでのコマンドと決め事だけを書く。

## コマンド

| 用途 | コマンド |
|---|---|
| 依存のインストール | `pnpm install --frozen-lockfile`（`pnpm-lock.yaml` ができた後。初回は「プロジェクトの初期化」を参照） |
| 開発サーバー | `pnpm dev` |
| テスト | `pnpm test` |
| テスト（カバレッジ付き） | `pnpm test:coverage` |
| lint | `pnpm lint` |
| フォーマット確認 | `pnpm format:check` |
| フォーマットの適用 | `pnpm format` |
| 型チェック | `pnpm typecheck` |
| ビルド | `pnpm build` |
| E2E テスト | `pnpm test:e2e` |
| JavaScript の大きさの確認 | 下のコマンド（gzip 後の合計バイト数を表示する） |
| E2E 用ブラウザのインストール | `pnpm exec playwright install chromium`（初回と、@playwright/test を更新したとき。CI では `pnpm exec playwright install --with-deps chromium`） |

JavaScript の大きさの確認:

```bash
pnpm build && find dist/_astro -name '*.js' -exec sh -c 'gzip -c "$1" | wc -c' _ {} \; | awk '{s+=$1} END {print s " bytes (gzip)"}'
```

### 必須チェック

| チェック | コマンド | 手元 | CI（`ci.yml`） |
|---|---|---|---|
| テスト（カバレッジの閾値を含む） | `pnpm test:coverage` | 毎回（`pnpm test` でもよい） | 毎回 |
| lint | `pnpm lint` | 毎回 | 毎回 |
| フォーマット確認 | `pnpm format:check` | 毎回 | 毎回 |
| 型チェック | `pnpm typecheck` | 毎回 | 毎回 |
| ビルド | `pnpm build` | 画面に関わる変更のとき | 毎回 |
| E2E テスト | `pnpm test:e2e` | 画面に関わる変更のとき | 毎回 |
| JavaScript の大きさ（50KB 以下） | 上のコマンド | 画面に関わる変更のとき | 実行しない |

- 「画面に関わる変更」とは、`src/` と `tests/` の下、`public/`、ルートの設定ファイル（`*.config.*`・`tsconfig.json`・`mise.toml`・`pnpm-workspace.yaml`）、`package.json`・`pnpm-lock.yaml` のいずれかを変えたとき。`docs/`・`.claude/`・`.github/` の `agents/`・`prompts/`・`skills/` だけの変更は含まない
- 変更後とPRの作成前は、上の表の「手元」の列のチェックを全て通す。CI では「CI」の列を全て実行し、1つでも失敗したらマージできない（ブランチの保護で強制する）

### package.json

```json
{
  "type": "module",
  "packageManager": "pnpm@12.11.2",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "astro sync && eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "astro check"
  }
}
```

- `pnpm lint` は、先に `astro sync` で Astro の型（`.astro/types.d.ts`。Git の管理外）を生成する。生成しないと、clone した直後や CI で `astro:content` と `import.meta.env` の型が解決できず、型情報を使う lint が失敗する

### 設定ファイルの決め事

| ファイル | 決め事 |
|---|---|
| `astro.config.mjs` | `site: "https://yamadentanaka.github.io"`、`base: "/yamaden_site/"`、`trailingSlash: "always"`、`integrations: [preact()]`、`markdown: { syntaxHighlight: "prism" }`（Markdown のコードの色付けの既定の Shiki はインラインスタイルを使い、CSP と両立しないため）。`security.csp` は `directives` に [architecture.md](architecture.md) の「CSP」の7つだけを書く（`script-src`・`style-src` は書かない。書くとビルドが設定エラーで止まる） |
| `tsconfig.json` | `{ "extends": "astro/tsconfigs/strictest", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"], "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact", "types": ["node"] } }`。`.ts` の設定ファイル（`vitest.config.ts`・`playwright.config.ts`）もこの tsconfig に入る |
| `vitest.config.ts` | `test.include: ["src/**/*.test.ts"]`、`test.environment: "node"`、`test.passWithNoTests: true`。`coverage.provider: "v8"`、`coverage.include: ["src/tools/*/{domain,application}/**/*.ts"]`、`coverage.exclude: ["**/*.test.ts"]`、`coverage.thresholds: { lines: 90 }` |
| `playwright.config.ts` | `testDir: "tests/e2e"`、`projects` は chromium だけ。`webServer: { command: "pnpm build && pnpm preview --ignore-lock", url: "http://localhost:4321/yamaden_site/", reuseExistingServer: !process.env["CI"], timeout: 180_000 }`、`use.baseURL: "http://localhost:4321/yamaden_site/"`、CI では `forbidOnly` と `reporter: "github"`。`--ignore-lock` を付けるのは、Astro 7 が AI エージェント（Claude Code など）の中での `astro preview` を自動でバックグラウンドにし、Playwright がサーバーの終了と判断してしまうため（CI では影響しない）。テストの中のページ移動は `page.goto("./tools/")` のように、先頭に `/` を付けない相対パスで書く |
| `eslint.config.js` | `globalIgnores(["dist/", ".astro/", "coverage/", "test-results/", "playwright-report/", "tmp/", ".steering/", "reviews/"])`。typescript-eslint の `recommendedTypeChecked` は `**/*.{ts,tsx}` に当て、`parserOptions: { projectService: true }` にする（`.ts` は全て tsconfig に入るので `allowDefaultProject` は使わない）。`.astro` と `.js`・`.mjs` には、eslint-plugin-astro の `recommended` と typescript-eslint の型情報を使わない `recommended` を当てる。依存のルールは下の「依存のルールの確認」 |
| `.prettierrc` | `{ "plugins": ["prettier-plugin-astro"] }` だけを書き、他は既定の設定 |
| `.prettierignore` | `docs/`、`.claude/`、`.github/agents/`、`.github/prompts/`、`.github/skills/`、`.github/copilot-instructions.md`、`AGENTS.md`、`CLAUDE.md`、`prompt.md`、`pnpm-lock.yaml`、`tests/fixtures/`。ドキュメントとエージェントの設定は Prettier で整形しない（表の書き方などが変わるため）。テスト用のファイルは、ツールの出力と1文字も違わないことを確かめるので整形しない |
| `mise.toml` | `[tools]` に `node = "24"`、`pnpm = "12.11.2"`。pnpm のバージョンは `package.json` の `packageManager` と同じにする |
| `pnpm-workspace.yaml` | 依存のビルドスクリプトは既定で止める。許可する依存は、pnpm 12 の `allowBuilds` に `<パッケージ名>: true` で書く（2026-10-12 の初期化の時点では、許可が必要な依存はなく `allowBuilds: {}`。`node_modules/.modules.yaml` の `pendingBuilds` で確かめられる）。対話式の `pnpm approve-builds` は使わない。許可しなかった依存は、理由をコメントで残す |

## コーディング規約

TypeScript・Astro・Preact の標準的な慣習に従う。以下はこのプロジェクトでの決め事。

### 言語ごとに決める項目

| 言語 | 項目 | 決定 |
|---|---|---|
| 共通 | エラー処理の方針（どの層で捕捉し、ユーザーにどう伝えるか） | 想定内のエラー（入力の誤り、ファイルの不備）は、ドメインレイヤーとインフラレイヤーが `Result` 型で返し、例外を投げない。エラーの型は全て `domain/errors.ts` に、`kind` で種類を区別する判別共用体として置く。表示する文言は、同じファイルの `toMessage(error)` で作る。UIレイヤーは、ドメインやインフラから受け取ったエラーを `toMessage` で通知にして `showMessage` を送る。`reduce` は、自分で確かめた操作の前提のエラーを `toMessage` で通知にして `message` に入れる。想定外の例外は、UIレイヤーのイベント処理で捕捉し、「予期しないエラーが発生しました」と表示して、詳細を `console.error` に出す |
| 共通 | ログの出し方 | 本番で出してよいのは、想定外の例外の `console.error` だけ。`console.log` はコミットしない（ESLint の `no-console` で `error` 以外を禁止する）。性能の目印（`performance.mark`）は残してよい。アクセス解析などの外部へのログ送信はしない |
| 共通 | 外部依存を追加するときの基準 | 実行時の依存（ブラウザに配信されるもの）は、自分で書くと200行を超えるか、正しく書くのが難しいもの（例: 画像のデコード）に限る。ネットワーク通信をするもの、ライセンスが MIT・Apache-2.0・BSD・ISC 以外のものは使わない。追加したら [architecture.md](architecture.md) の技術選定の表にバージョンと理由を書く。ドメインレイヤーとアプリケーションレイヤーには外部依存を入れない |
| TypeScript | パッケージマネージャ（npm / pnpm / yarn / bun） | pnpm（バージョンは `mise.toml` と `packageManager` で固定）。依存は `pnpm add -E`（開発用は `pnpm add -DE`）で、正確なバージョンで追加する |
| TypeScript | モジュール形式（ESM / CJS）、`strict` の範囲 | ESM のみ（`"type": "module"`）。`tsconfig.json` は `astro/tsconfigs/strictest` を継承し、全てのファイルに strict を適用する。`any` は使わない（外部から来るデータは `unknown` で受けて検証する）。`@ts-ignore` は禁止、`@ts-expect-error` は理由のコメント付きでのみ可 |
| TypeScript | テストランナー、lint / フォーマッタ（ESLint + Prettier / Biome など） | テストは Vitest、E2E は Playwright。lint は ESLint（typescript-eslint の `recommendedTypeChecked` と eslint-plugin-astro の `recommended`）、フォーマットは Prettier（既定の設定に prettier-plugin-astro を追加） |

### 依存のルールの確認（ESLint）

[repository-structure.md](repository-structure.md) の依存のルールを、ESLint で確かめる。

**設定の作り方**: flat config では、同じルールを設定したオブジェクトが同じファイルに複数当たると、後のもので置き換わる（オプションはマージされない）。そのため、次の2点を守る。

- import の制限は、全て `@typescript-eslint/no-restricted-imports` で書く（core の `no-restricted-imports` は使わない。`allowTypeImports` を使うため）
- 1つのファイルに当たる禁止は、ルールごとに1つの設定オブジェクトにまとめる。ツールのファイルは、ツールの slug の一覧とレイヤーごとの禁止から、「ツール × レイヤー」の設定を関数で作る

```js
// eslint.config.js（ツールの部分の骨格）
const tools = ["polygon-area"]; // ツールを追加したらここに足す
const layers = ["ui", "application", "infrastructure", "domain"];
const layerBans = {
  ui: [],
  application: ["**/ui/**", "**/infrastructure/**"],
  infrastructure: ["**/ui/**", "**/application/**"],
  domain: ["**/ui/**", "**/application/**", "**/infrastructure/**"],
};
const toolLayerConfigs = tools.flatMap((slug) =>
  layers.map((layer) => ({
    files: [`src/tools/${slug}/${layer}/**/*.{ts,tsx}`],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", { patterns: [
        { group: [...layerBans[layer], ...tools.filter((t) => t !== slug).map((t) => `**/${t}/**`)] },
        ...extraImportPatterns[layer], // 下の表の「外部パッケージ」「型だけ」
      ] }],
      "no-restricted-globals": ["error", ...restrictedGlobals[layer]],
      "no-restricted-properties": ["error", ...restrictedProperties[layer]],
    },
  })),
);
```

**ツールのレイヤーごとの禁止**（1つのレイヤーの設定に、その行の全てを入れる）:

| レイヤー | `@typescript-eslint/no-restricted-imports` | `no-restricted-globals` | `no-restricted-properties` / `no-restricted-syntax` |
|---|---|---|---|
| `ui/` | 他のツール | `fetch`・`XMLHttpRequest`・`WebSocket`・`EventSource` | `navigator.sendBeacon`、`window`・`globalThis`・`self` の `fetch`・`XMLHttpRequest`・`WebSocket`・`EventSource` |
| `application/` | `**/ui/**`・`**/infrastructure/**`、他のツール、外部パッケージ（`regex: "^(?!\\.\|vitest$)"`。相対パスとテストの `vitest` 以外の全て） | `ui/` の通信の4つに加えて、`window`・`document`・`navigator`・`File`・`Blob`・`URL`・`Image`・`crypto`・`performance`・`setTimeout`・`setInterval`・`localStorage`・`sessionStorage`・`globalThis`・`self` | `ui/` と同じものに加えて、`Date.now`・`Math.random`。`no-restricted-syntax` で `NewExpression[callee.name='Date']` |
| `infrastructure/` | `**/ui/**`・`**/application/**`、他のツール、外部パッケージ（同じ regex）。`**/domain/**` は `allowTypeImports: true` で型だけを許す | `ui/` と同じ | `ui/` と同じ |
| `domain/` | `**/ui/**`・`**/application/**`・`**/infrastructure/**`、他のツール、外部パッケージ（同じ regex） | `application/` と同じ | `application/` と同じ |

- 表の中の regex は、表の書式の都合で `|` を `\|` と書いている。設定ファイルには `"^(?!\\.|vitest$)"` と書く
- 「他のツール」のパターンは `**/<slug>/**` と書く（ツール間の import は `../../<slug>/...` の相対パスになり、`tools/` を含まないため）
- `src/tools/shared/[レイヤー名]/` も同じレイヤーの禁止を当て、加えて全てのツール（`**/<slug>/**`）を禁止する
- ツールから `shared/` への依存は、上のレイヤーのパターン（`**/ui/**` など）がそのまま `shared/` の上位のレイヤーも止めるので、許可のために別のパターンは書かない

**サイトの禁止**:

| 対象のファイル | `@typescript-eslint/no-restricted-imports` |
|---|---|
| `src/pages/**` | `**/tools/*/application/**`・`**/tools/*/domain/**`・`**/tools/*/infrastructure/**` |
| `src/layouts/**` | `**/tools/**`・`**/pages/**`・`astro:content` |
| `src/components/**` | `**/tools/**`・`**/pages/**`・`**/layouts/**`。`astro:content` は `allowTypeImports: true` で型だけを許す |
| `src/routing/**` | 同じディレクトリ（`./`）とテストの `vitest` 以外の全て（`regex: "^(?!\\./\|vitest$)"`） |
| `src/content.config.ts` | `astro:content`・`astro/loaders`・`astro/zod` 以外の全て |
| `src/content/**/*.test.ts` | `node:fs/promises`・`node:path`・`yaml`・`vitest` 以外の全て |
| `tests/**` | `**/src/**` |

- 「`src/pages/` からはルートコンポーネントだけ」は ESLint では確かめられないので、レビューで確認する

### その他の決め事

- **言語**: 識別子（変数名・関数名・型名）は英語。コメント、テスト名、画面の文言、コミットメッセージの本文は日本語
- **不変のデータ**: ドメインレイヤーとアプリケーションレイヤーの型は `readonly` を付け、状態を書き換えずに新しいオブジェクトを返す
- **座標の扱い**: 画像座標は `ImagePoint`、画面座標は `ScreenPoint` を使う。どちらも brand で区別するので、作るときは `imagePoint(x, y)`・`screenPoint(x, y)` の関数を使い、オブジェクトリテラルを直接書かない
- **サイト内のリンク**: `withBase("tools/")` のように、`src/routing/withBase.ts` の `withBase` で作る。`/tools/` のような絶対パスや、`import.meta.env.BASE_URL` との文字列の連結を直接書かない
- **HTML の挿入**: `dangerouslySetInnerHTML` と Astro の `set:html` は使わない
- **`.astro` のスタイル**: `style` 属性と `define:vars` は使わず、クラスと CSS ファイルで書く（CSP で止められるため）
- **フォント**: Webフォントは使わず、システムフォントだけを使う（CSP の `font-src 'none'`）
- **コメント**: 「なぜそうしたか」が読み取れない箇所にだけ書く。数値の定数（当たり判定の 8画面px など）には、[functional-design.md](functional-design.md) と同じ意味の名前を付ける（例: `VERTEX_HIT_RADIUS_PX`）

## Git 運用

- **ブランチ**: `main` から `feature/<説明>`（機能追加）・`fix/<説明>`（不具合修正）・`docs/<説明>`（ドキュメントのみ）を切る。説明は kebab-case の英語（例: `feature/polygon-area-zoom`）。`main` への直接コミットはしない（唯一の例外は、「プロジェクトの初期化」の最初のコミット）
- **コミットメッセージ**: Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `ci`）。1行目は `feat: ポリゴンの頂点を削除できるようにする` のように、型の後ろを日本語で書く。本文も日本語
- **PR**:
  - 作成前に、必須チェックの「手元」の列を全て通す
  - PR のタイトルも Conventional Commits の形式で書く（Squash merge で `main` のコミットの1行目になるため）
  - PR の説明には、変更の目的、変更内容、確認したこと（画面の変更ならスクリーンショット）を書く
  - CI（`ci.yml`）が全て成功してからマージする（ブランチの保護で強制する）。マージは Squash merge
  - 1人で開発しているので、人のレビューは必須にしない。必要に応じて `/pr-review-loop` で AI のレビューを受ける
- **公開リポジトリ**: リポジトリは公開なので、個人情報や顧客の非公開の情報をコミットしない。作業用のファイルは `tmp/` に置く

## テスト方針

| 種類 | 対象 | 配置 |
|---|---|---|
| ユニットテスト | 各ツールのドメインレイヤーとアプリケーションレイヤー、サイトコンテンツの id の一意性 | 対象と同じディレクトリに `*.test.ts`（コンテンツは `src/content/content.test.ts`） |
| 統合テスト | エリア定義JSONの往復など、ドメインとアプリケーションの組み合わせ | 上位の層のディレクトリに `*.integration.test.ts` |
| E2E テスト | 画面の操作、ファイルの読み込みとダウンロード、外部への通信がないこと、全ページで CSP の違反がないこと、ページ間の移動 | `tests/e2e/*.spec.ts` |

- カバレッジ目標: ドメインレイヤーとアプリケーションレイヤーで 90%（行）。`vitest.config.ts` の `thresholds` で、下回ったら `pnpm test:coverage` を失敗させる。UIレイヤーとインフラレイヤーは計測せず、E2E テストで確認する。100% は目指さない
- テストは Given-When-Then の構造で書き、テスト名から何を確認するかが分かるようにする（例: `it("3点のエリアから頂点を削除しようとすると、削除せずにエラーの通知を出す")`）
- モック: ドメインレイヤーとアプリケーションレイヤーは純粋関数なので、モックを使わずに入力と出力で確かめる。E2E テストでは、`tests/fixtures/` のファイルを `setInputFiles` で読み込ませる
- テスト用の画像は自分で作ったものだけを使う（[repository-structure.md](repository-structure.md) の「tests/」）
- 不具合を直すときは、先にその不具合を再現するテストを書く

## 開発環境のセットアップ

1. 必要なツール: mise（`brew install mise`）、Git
2. mise をシェルで有効にする（初回のみ）:

```bash
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc   # 実行後、シェルを開き直す
```

3. リポジトリを clone した後（`package.json` と `pnpm-lock.yaml` がある状態）:

```bash
mise trust                        # このリポジトリの mise.toml を信頼する
mise install                      # mise.toml の Node.js と pnpm を入れる
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

4. 開発サーバーは `http://localhost:4321/yamaden_site/` で開く

### プロジェクトの初期化（最初の1回だけ）

`package.json` がまだない状態から始めるときの手順。最初の実装の作業で1回だけ行う。

```bash
# 1. リポジトリを作り、除外設定と docs だけを main に最初のコミットとして入れる
git init -b main
#    → .gitignore に repository-structure.md の「除外設定」の項目を追記してから
git add .gitignore docs AGENTS.md CLAUDE.md .claude .github
git commit -m "docs: プロジェクトのドキュメントを追加する"   # main に直接コミットしてよい唯一の例外
#    → GitHub に公開リポジトリ yamadentanaka/yamaden_site を作り、main を push する

# 2. 作業ブランチで初期化する
git switch -c feature/project-setup
mise use node@24 pnpm@12.11.2     # mise.toml を作る
pnpm init                         # package.json を作り、上の「package.json」の内容に合わせる
pnpm add -E astro@7.3.8 preact@10.29.8 @astrojs/preact@6.0.6
pnpm add -DE typescript@6.0.3 @astrojs/check@0.9.10 @types/node@24.19.2 vitest@5.0.3 @vitest/coverage-v8@5.0.3 \
  @playwright/test@1.64.0 eslint@10.12.0 typescript-eslint@8.71.1 eslint-plugin-astro@3.2.1 \
  prettier@3.9.10 prettier-plugin-astro@1.1.1 yaml@2.9.1
pnpm exec playwright install chromium
```

- ビルドスクリプトを止められた依存を `node_modules/.modules.yaml` の `pendingBuilds` で確かめ、許可するものを `pnpm-workspace.yaml` の `allowBuilds` に書く（「設定ファイルの決め事」）
- コマンドは、シェルで mise を有効にしていなければ `mise exec -- pnpm <コマンド>` で実行できる
- 続けて、「設定ファイルの決め事」の設定ファイルを作る
- `package.json`・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`mise.toml`・設定ファイルを全てコミットし、PR で `main` にマージする
- マージした後、Settings → Pages の Source を「GitHub Actions」にして、`main` のブランチの保護（[architecture.md](architecture.md) の「公開」）を設定する
