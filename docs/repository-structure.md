# リポジトリ構造定義書 (Repository Structure Document)

[architecture.md](architecture.md) の技術スタック（Astro + TypeScript + Preact）とレイヤー構成を、ディレクトリと配置ルールに落とし込む。構成と命名は Astro の慣習に合わせる。

## プロジェクト構造

```
yamaden_site/
├── src/
│   ├── pages/                        # URLごとのページ（Astro のルーティング）
│   │   ├── index.astro               #   / トップページ
│   │   └── tools/
│   │       ├── index.astro           #   /tools/ ツール一覧
│   │       └── polygon-area.astro    #   /tools/polygon-area/ ポリゴンエリア定義ツール
│   ├── layouts/                      # ページ共通のレイアウト
│   │   └── BaseLayout.astro
│   ├── components/                   # サイトの表示用部品（Astro コンポーネント）
│   │   ├── AchievementList.astro
│   │   ├── NewsList.astro
│   │   └── ToolCard.astro
│   ├── content/                      # サイトコンテンツのデータ
│   │   ├── achievements.yaml         #   実績
│   │   ├── news.yaml                 #   お知らせ
│   │   ├── tools/                    #   ツール情報（1ツール1ファイル）
│   │   │   └── polygon-area.yaml
│   │   └── content.test.ts           #   id の一意性のテスト
│   ├── content.config.ts             # コンテンツコレクションの定義とスキーマ
│   ├── routing/                      # サイト内リンクの作成
│   │   ├── withBase.ts
│   │   └── withBase.test.ts
│   ├── styles/                       # サイト全体のCSS
│   │   └── global.css
│   └── tools/                        # ツールの実装（1ツール1ディレクトリ）
│       └── polygon-area/
│           ├── ui/                   #   UIレイヤー（Preact コンポーネント）
│           ├── application/          #   アプリケーションレイヤー
│           ├── domain/               #   ドメインレイヤー
│           └── infrastructure/       #   インフラレイヤー
├── public/                           # そのまま配信する静的ファイル（favicon など）
├── tests/
│   ├── e2e/                          # E2E テスト（Playwright）
│   └── fixtures/                     # テスト用の画像・JSON
├── .github/
│   ├── workflows/                    # GitHub Actions（ci.yml・deploy.yml）
│   ├── dependabot.yml                # GitHub Actions の更新
│   ├── agents/  prompts/  skills/    # GitHub Copilot 用の設定（.claude/ と対になる）
│   └── copilot-instructions.md
├── .claude/                          # Claude Code の設定
│   ├── agents/  commands/  hooks/  skills/
│   └── settings.json
├── docs/                             # 永続ドキュメント
│   └── ideas/                        #   壁打ち・技術調査のメモ
├── .steering/                        # 作業単位の計画（git 管理外）
├── tmp/                              # 個人の作業用ファイル（git 管理外）
├── reviews/                          # pr-fix-push の対応レポートと pr-review-loop の記録（git 管理外）
├── AGENTS.md                         # AI エージェント向けの指示（GitHub Copilot など）
├── CLAUDE.md                         # Claude Code 向けの指示
├── prompt.md                         # 個人のメモ（git 管理外）
├── astro.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── .prettierrc
├── .prettierignore
├── tsconfig.json
├── mise.toml                         # Node.js と pnpm のバージョン
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml               # 依存のビルドスクリプトの許可など、pnpm の設定
```

## ディレクトリ詳細

### src/pages/

- **役割**: URLとページの対応。Astro のファイルベースルーティングに従う
- **配置するもの**: `.astro` のページファイルだけ。テストファイルは置かない（Astro がページとして扱うため）
- **依存してよい先**: `src/layouts/`、`src/components/`、`astro:content`（コンテンツコレクション）、`src/routing/`、各ツールの `ui/` のルートコンポーネント
- **依存禁止**: 各ツールの `application/`・`domain/`・`infrastructure/`（ツールの中身はツールのUIレイヤーを通して使う）

### src/layouts/

- **役割**: 全ページ共通の `<head>`・ヘッダー・ナビゲーション・フッター
- **配置するもの**: `.astro` のレイアウト
- **依存してよい先**: `src/components/`、`src/routing/`、`src/styles/`
- **依存禁止**: `src/pages/`、`src/tools/`、`astro:content`

### src/components/

- **役割**: サイトの表示用の部品（実績の一覧、お知らせの一覧、ツールのカードなど）
- **配置するもの**: `.astro` コンポーネント。データはプロパティで受け取る
- **依存してよい先**: `src/routing/`。型の参照としての `astro:content`
- **依存禁止**: `src/pages/`、`src/layouts/`、`src/tools/`。コンテンツコレクションを読む関数（`getCollection` など）の呼び出し

### src/content/ と src/content.config.ts

- **役割**: サイトコンテンツ（実績・お知らせ・ツール情報、P2 の技術メモ）のデータと、そのスキーマ
- **配置するもの**: YAML（実績・お知らせ・ツール情報）、Markdown（技術メモ）、データを検証するテスト（`content.test.ts`）。スキーマは `src/content.config.ts` に `astro/zod` で書く
- **依存してよい先**: `content.config.ts` は `astro:content`・`astro/loaders`・`astro/zod` だけ。`content.test.ts` は `node:fs/promises`・`node:path`・`yaml`・`vitest` だけ
- **依存禁止**: `src/` の他の全て

### src/routing/

- **役割**: サイト内リンクの作成（`withBase`）。`base` の扱いをここだけに閉じ込める
- **配置するもの**: `.ts` と、そのユニットテスト（`withBase.test.ts`）
- **依存してよい先**: なし（`import.meta.env.BASE_URL` のみ。テストは `vitest` も使う）
- **依存禁止**: `src/` の他の全て

### src/styles/

- **役割**: サイト全体で共通のCSS（色・文字・余白の変数、基本のスタイル）
- **配置するもの**: `.css`
- **依存してよい先 / 依存禁止**: 該当なし（CSS のみ）

### src/tools/[slug]/

1つのツールの実装。ディレクトリ名はツール情報の slug と同じにする。ツールの中は、[architecture.md](architecture.md) の4レイヤーに対応するディレクトリに分ける（使わないレイヤーのディレクトリは作らなくてよい）。

| ディレクトリ | レイヤー | 配置するもの | 依存してよい先 | 依存禁止 |
|---|---|---|---|---|
| `ui/` | UIレイヤー | Preact コンポーネント（`.tsx`）、ツール専用のCSS | `application/`、`domain/`、`infrastructure/`、Preact | 他のツールのディレクトリ |
| `application/` | アプリケーションレイヤー | 状態の型、`reduce`、操作の型 | `domain/` | `ui/`、`infrastructure/`、ブラウザのAPI、外部パッケージ |
| `infrastructure/` | インフラレイヤー | ファイルの読み込み・保存 | `domain/`（型のみ） | `ui/`、`application/`、外部パッケージ、ネットワーク通信 |
| `domain/` | ドメインレイヤー | 型、幾何計算、エリアの規則、JSON変換、エラー | なし | 他の全て、ブラウザのAPI、外部パッケージ |

ポリゴンエリア定義ツールのファイル構成:

```
src/tools/polygon-area/
├── ui/
│   ├── PolygonAreaEditor.tsx   # ルートコンポーネント（ページから client:only で読み込む）
│   ├── cursorStore.ts          # カーソル位置（座標表示だけが購読する）
│   ├── Toolbar.tsx
│   ├── HelpPanel.tsx
│   ├── Canvas.tsx
│   ├── AreaList.tsx
│   ├── StatusBar.tsx
│   └── polygonArea.css
├── application/
│   ├── editorState.ts          # EditorState・EditorMode・Selection・EditorAction の型と初期状態
│   ├── reduce.ts
│   ├── reduce.test.ts
│   └── roundtrip.integration.test.ts
├── domain/
│   ├── types.ts                # Point・ImagePoint・ScreenPoint・Size・ImageInfo・Area・Viewport・AreaDefinitionFile・Message・Result の型と、imagePoint・screenPoint（brand 付きの座標を作る関数）
│   ├── errors.ts               # 全てのエラーの型（ImageLoadError・FileReadError・DefinitionParseError・AreaNameError・EditOperationError・FileDropError）と toMessage
│   ├── errors.test.ts
│   ├── viewport.ts             # 座標変換、拡大縮小、全体表示
│   ├── viewport.test.ts
│   ├── hitTest.ts              # 当たり判定、内外判定
│   ├── hitTest.test.ts
│   ├── area.ts                 # エリア名の正規化と検証、既定の名前、表示色
│   ├── area.test.ts
│   ├── definitionFile.ts       # エリア定義JSONの出力・解析・検証、ファイル名
│   ├── definitionFile.test.ts
│   ├── fileKind.ts             # ファイルの振り分け
│   └── fileKind.test.ts
└── infrastructure/
    └── files.ts                # loadImageFile・readTextFile・downloadText・releaseImageUrl
```

### src/tools/shared/

- **役割**: 2つ以上のツールで使うコードの置き場（必要になるまで作らない）
- **構成**: `src/tools/shared/[レイヤー名]/`（例: `src/tools/shared/infrastructure/files.ts`）
- **依存のルール**: ツールのレイヤー X が依存してよいのは、上の表で X の「依存してよい先」にあるレイヤーと同じ名前の `shared/` と、`shared/X/` だけ（同じ制限で）。
  - `ui/` → `shared/ui/`・`shared/application/`・`shared/infrastructure/`・`shared/domain/`
  - `application/` → `shared/application/`・`shared/domain/`
  - `infrastructure/` → `shared/infrastructure/`・`shared/domain/`（`shared/domain/` は型だけ）
  - `domain/` → `shared/domain/`
  - `shared/` の中のレイヤー間の依存は、ツールと同じルールに従う。`shared/` から各ツールへの依存は禁止
- `shared` は予約された名前で、ツールの slug には使わない

### public/

- **役割**: ビルドで加工せず、そのまま配信するファイル
- **配置するもの**: favicon、robots.txt など。独自ドメインはリポジトリの Pages の設定で指定するので、`CNAME` は置かない

### tests/

- **役割**: ソースの横に置かないテスト（E2E）と、テスト用のファイル
- **配置するもの**: `e2e/` に Playwright のテスト、`fixtures/` にテスト用の画像（小さいPNG、4K のJPEG）とJSON
- **テスト用の画像**: リポジトリは公開なので、自分で作った画像（単色・模様・図形など）か、ライセンスがはっきりしたものだけを置く。顧客や業務のカメラ画像は置かない
- **依存してよい先**: `tests/fixtures/`
- **依存禁止**: `src/` の内部（E2E テストは画面の操作だけで確認する）

### .github/

- **`workflows/`**: `ci.yml`（PR と `main` への push で必須チェックを全て実行）、`deploy.yml`（`main` への push で GitHub Pages に公開）
- **`agents/`・`prompts/`・`skills/`・`copilot-instructions.md`**: GitHub Copilot 用の設定。`.claude/` との対応は下の「.claude/」を参照

### .claude/

- **役割**: Claude Code の設定（`agents/`・`commands/`・`hooks/`・`skills/`・`settings.json`）
- **`.github/` との対応**: 対応する名前のファイルを置くが、ツールごとに書き方が違うので、内容は同じでなくてよい。手順や判断の基準（目的）を変えたら、対応するもう片方も更新する
  - 対応: `.claude/agents/<名前>.md` ↔ `.github/agents/<名前>.agent.md`、`.claude/commands/<名前>.md` ↔ `.github/prompts/<名前>.prompt.md`、`.claude/skills/<名前>/` ↔ `.github/skills/<名前>/`
  - 片方にしかないもの（`.github/agents/` の `impl`・`issue`・`orchestrator`・`plan`・`pr`・`review`、`.claude/commands/pr-review-loop.md`、`.claude/hooks/`）は、そのツール専用とする
- `settings.local.json`（個人の設定）はコミットしない

### .steering/

- **役割**: 作業単位の計画と記録（`[YYYYMMDD]-[タスク名]/requirements.md` など）
- **git の管理**: 管理外（既存の `.gitignore` の運用に従う）。`.steering/.active` もこれに含まれる

### tmp/

- **役割**: 個人情報を含む作業用ファイル（職務経歴書など）の置き場
- **git の管理**: 管理外。リポジトリは公開なので、個人情報は必ずここに置く。ここにあるファイルをサイトから参照しない

## ファイル配置規則

| ファイル種別 | 配置先 | 命名規則 | 例 |
|---|---|---|---|
| ページ | `src/pages/` | kebab-case（URLになる） | `tools/polygon-area.astro` |
| レイアウト | `src/layouts/` | PascalCase + `Layout` | `BaseLayout.astro` |
| サイトの部品 | `src/components/` | PascalCase | `NewsList.astro` |
| 実績・お知らせ | `src/content/` | 1種類1ファイルの YAML | `achievements.yaml` |
| ツール情報 | `src/content/tools/` | `[slug].yaml` | `polygon-area.yaml` |
| 技術メモ（P2） | `src/content/notes/` | `[slug].md` | `opencv-tips.md` |
| ツールの実装 | `src/tools/[slug]/` | ディレクトリ名は slug | `src/tools/polygon-area/` |
| Preact コンポーネント | `src/tools/[slug]/ui/` | PascalCase の `.tsx` | `AreaList.tsx` |
| ルートコンポーネント | `src/tools/[slug]/ui/` 直下に1つだけ | slug の PascalCase + 役割 | `PolygonAreaEditor.tsx` |
| それ以外の TypeScript | 各レイヤーのディレクトリ、`src/routing/` | camelCase の `.ts` | `definitionFile.ts` |
| ツール専用のCSS | `src/tools/[slug]/ui/` | camelCase の `.css` | `polygonArea.css` |
| ワークフロー | `.github/workflows/` | kebab-case の `.yml` | `deploy.yml` |

### テスト

| テスト種別 | 配置先 | 命名規則 | 例 |
|---|---|---|---|
| ユニットテスト | テスト対象と同じディレクトリ | `[対象のファイル名].test.ts` | `domain/viewport.test.ts` |
| 統合テスト | 組み合わせる層のうち上位の層のディレクトリ | `[テーマ].integration.test.ts` | `application/roundtrip.integration.test.ts` |
| コンテンツのテスト | `src/content/` | `content.test.ts` | `src/content/content.test.ts` |
| E2E テスト | `tests/e2e/` | ツールは `[slug].spec.ts`、サイトのページ（トップ・ツール一覧・ページ間の移動・CSP）は `site.spec.ts` | `tests/e2e/polygon-area.spec.ts`、`tests/e2e/site.spec.ts` |
| テスト用ファイル | `tests/fixtures/` | 内容が分かる kebab-case | `sample-4k.jpg`、`two-areas.areas.json` |

- Vitest は `src/**/*.test.ts` だけを、Playwright は `tests/e2e/` だけを対象にする（設定は [development-guidelines.md](development-guidelines.md)）

## 命名規則

- ディレクトリ: kebab-case（`polygon-area`）。ただしツール内のレイヤー名（`ui`・`application`・`domain`・`infrastructure`）は固定
- ファイル: 上の表のとおり。Astro・Preact のコンポーネントは PascalCase、それ以外の TypeScript は camelCase、URL になるものと YAML・Markdown は kebab-case
- プレースホルダーは `[slug]` と書く（ツール名 `ToolInfo.name` と区別するため）

## 依存関係のルール

サイト（依存元 → 依存してよい先）:

- `src/pages/` → `src/layouts/`、`src/components/`、`src/routing/`、`astro:content`、`src/tools/[slug]/ui/` のルートコンポーネント
- `src/layouts/` → `src/components/`、`src/routing/`、`src/styles/`
- `src/components/` → `src/routing/`（`astro:content` は型だけ）
- `src/content/`・`src/routing/`・`src/styles/` → なし（`src/` の他に依存しない）
- `tests/` → なし（`src/` に依存しない）
- コンテンツコレクションを読むのは `src/pages/` だけ

ツールの中（依存元 → 依存してよい先）:

- `ui/` → `application/`、`infrastructure/`、`domain/`
- `application/` → `domain/`
- `infrastructure/` → `domain/`（型だけ）
- `domain/` → なし

- 禁止: 下位から上位への依存（`domain/` から `application/` など）、`application/` と `infrastructure/` の相互依存、ツール間の依存、`src/pages/` からツールの `ui/` 以外への依存
- 循環依存は禁止。複数のレイヤーで共通の型が必要になったら `domain/types.ts` に置く
- 依存のルールは全て ESLint で機械的に確認する（設定は [development-guidelines.md](development-guidelines.md) の「依存のルールの確認」）。ただし「`src/pages/` からはルートコンポーネントだけ」は、ESLint では確かめられないので、レビューで確認する

## 機能追加時の分割方針

- **ツールの追加**: `src/tools/[slug]/` を作り、必要なレイヤーのディレクトリを置く。あわせて `src/content/tools/[slug].yaml` と `src/pages/tools/[slug].astro` を追加し、`eslint.config.js` のツールの slug の一覧に追加する（[development-guidelines.md](development-guidelines.md) の「依存のルールの確認」）
- **ツール間の共有**: 2つ以上のツールで同じコードが必要になったら、`src/tools/shared/[レイヤー名]/` に移す。1つのツールでしか使わないものは移さない
- **ファイルの分割**: 1ファイルが300行を超えたら、責務ごとにファイルを分ける。1つのレイヤーのファイルが10個を超えたら（テストを除く）、レイヤーの中にサブディレクトリを作る（例: `domain/geometry/`）
- **技術メモ（P2）を作るとき**: `src/content/notes/[slug].md`、一覧の `src/pages/notes/index.astro`、各メモの `src/pages/notes/[slug].astro`（`getStaticPaths` で生成）を追加する

## 除外設定

- **.gitignore**: `.steering/`・`prompt.md`・`tmp/`・`reviews/` に加えて、次を入れている（プロジェクトの初期化と `.claude` の更新で追記）
  - ビルド成果物: `dist/`、`.astro/`
  - 依存: `node_modules/`
  - テストの出力: `coverage/`、`test-results/`、`playwright-report/`
  - 環境変数: `.env`、`.env.*`
  - 個人の設定: `.claude/settings.local.json`、`mise.local.toml`
  - OS: `.DS_Store`
  - `/add-feature` の実行中マーカー: `.steering/.active`（`.steering/` に含まれるが、コミットされると24時間で無視する保護が効かないため明示する）
- **ESLint**: flat config は `.gitignore` を読まないので、`eslint.config.js` の `globalIgnores` に `dist/`・`.astro/`・`coverage/`・`test-results/`・`playwright-report/`・`tmp/`・`.steering/`・`reviews/` を入れる
- **Prettier**: `.prettierignore` に、Prettier で整形しないものを書く（内容は [development-guidelines.md](development-guidelines.md)）
- **Vitest**: `include` を `src/**/*.test.ts` に限る（`tests/e2e/*.spec.ts` を拾わないようにする）
