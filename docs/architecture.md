# 技術仕様書 (Architecture Design Document)

PRD（[product-requirements.md](product-requirements.md)）と機能設計書（[functional-design.md](functional-design.md)）を実現するための技術構成を定める。バージョンは 2026-10-12 時点の安定版。

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン | 選定理由 |
|------|-----------|----------|
| TypeScript | 6.0.3 | ツールのロジックとUIを型付きで書くため。最新は 7.0 だが、typescript-eslint（`>=4.8.4 <6.1.0`）と @astrojs/check（`^5.0.0 \|\| ^6.0.0`）が 7 に未対応なので 6.0 系にする（移行の条件は「依存関係管理」の「TypeScript 7 への移行」を参照） |
| Node.js | 24 LTS（`mise.toml` では `24` と指定し、その時点の最新の 24.x を使う。2026-10-12 時点では 24.21.0） | ビルドと開発ツールの実行環境。Astro 7 の要件（`>=22.12.0`）を満たす LTS |
| pnpm | 12.11.2 | パッケージマネージャ。インストールが速く、依存のバージョンを厳密に固定できる。GitHub Pages へのデプロイに使う withastro/action も対応している |
| mise | 開発者の手元で入れた最新版 | Node.js と pnpm のバージョンを `mise.toml` 1か所で管理し、手元と CI（`ci.yml`）で同じバージョンを使うため。`deploy.yml` は withastro/action に `node-version: 24` を明示して合わせる |

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Astro | 7.3.8 | サイト全体の静的サイト生成 | 会社ページ・Markdownのメモ・ツールを1つのサイトで扱え、出力が静的HTMLなのでGitHub Pagesにそのまま置ける。必要なページだけJavaScriptを読み込む（アイランド）ので、会社ページは軽いまま保てる。CSP を出力する機能（`security.csp`）がある |
| Preact | 10.29.8 | ポリゴンエリア定義ツールのUI | 状態が多いエディタをコンポーネントで組める。React と同じ書き方で、本体が約4KBと小さい。@astrojs/preact が 10 系を要求するので 11 ではなく 10 系にする |
| @astrojs/preact | 6.0.6 | Astro と Preact の連携 | Astro 公式のインテグレーション |

- ポリゴンの表示は SVG で行う（ライブラリは使わない）。頂点が数百程度なら SVG で十分速く、当たり判定やハンドルの表示をDOMのイベントで扱えるため。HTML の `<canvas>` 要素は使わない
- 座標計算・当たり判定・JSONの検証は自前で書く。ドメインレイヤーを外部ライブラリに依存させないため
- 計算が重いツールを将来作るときは、その処理だけ Rust → WebAssembly にする（今回は使わない）

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Vitest | 5.0.3 | ユニットテスト・統合テスト | Vite ベースで、TypeScript をそのまま実行できる。ドメインとアプリケーションのテストは Astro に依存しないので、単独の設定で動かす |
| @vitest/coverage-v8 | 5.0.3 | カバレッジ計測 | Vitest 公式。追加の変換なしで計測できる |
| @types/node | 24.19.2 | Node.js の API の型 | 設定ファイル（`process.env`）とコンテンツのテスト（`node:fs`）で使う。TypeScript 6 は `@types/*` を自動で読み込まないので、tsconfig の `types` に指定する |
| yaml | 2.9.1 | テストでのサイトコンテンツの読み込み | 実績・お知らせの id の一意性をユニットテストで確かめるため（開発時のみ。ブラウザには配信しない） |
| Playwright（@playwright/test） | 1.64.0 | E2E テスト | ファイルの読み込み・ダウンロード・ネットワーク通信の監視を、実際のブラウザで確認できる |
| ESLint | 10.12.0 | lint | Astro ファイルを lint できるプラグインがある。レイヤーの依存のルールを `no-restricted-imports` で確かめられる |
| typescript-eslint | 8.71.1 | TypeScript の lint | 型情報を使ったルール（Promise の扱い忘れなど）を使うため |
| eslint-plugin-astro | 3.2.1 | Astro ファイルの lint | Astro 公式のコミュニティプラグイン |
| Prettier | 3.9.10 | フォーマッタ | Astro ファイルに対応している（Biome は Astro ファイルへの対応が部分的なため使わない） |
| prettier-plugin-astro | 1.1.1 | Astro ファイルのフォーマット | Astro 公式 |
| @astrojs/check | 0.9.10 | 型チェック | `.astro` ファイルも含めて型チェックできる |

### CI・デプロイ（GitHub Actions）

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| actions/checkout | v7.0.1（`3d3c42e`） | リポジトリの取得 | GitHub 公式 |
| jdx/mise-action | v5.1.1（`2d8d4ca`） | CI での Node.js と pnpm の導入 | `mise.toml` を読むので、手元と同じバージョンになる |
| withastro/action | v6.1.3（`3eafd00`） | GitHub Pages 用のビルド | Astro 公式のアクション。`packageManager` から pnpm のバージョンを取り、Node.js は既定で 24 を使う |
| actions/deploy-pages | v5.0.1（`368f825`） | GitHub Pages への公開 | GitHub 公式 |
| Dependabot | - | GitHub Actions の更新 | Actions をコミットの SHA で固定しているので、更新の PR を自動で作らせる（`.github/dependabot.yml`、毎週） |

## アーキテクチャパターン

### サイト全体

```
┌────────────────────────────────────────────┐
│  ページ（src/pages）                           │ ← URLごとのページ。コンテンツを読み、部品に渡す
├──────────────┬──────────────┬──────────────┤
│ レイアウト      │ 部品           │ ツールの UI    │
│（src/layouts） │（src/components）│（src/tools/*/ui）│
├──────────────┴──────────────┴──────────────┤
│  サイトコンテンツ（src/content）・CSS（src/styles）・リンクの作成（src/routing） │
└────────────────────────────────────────────┘
```

- ページだけがコンテンツコレクションを読み、並べ替えたデータを部品に渡す。部品はコンテンツを直接読まない
- ページはビルド時にコンテンツを読み込み、静的HTMLにする
- ツールのページは、ツールのUIレイヤーのルートコンポーネントを `client:only="preact"` で読み込む（ブラウザのAPIに依存するため、ビルド時には描画しない）
- 依存のルールの詳細は [repository-structure.md](repository-structure.md) の「依存関係のルール」を参照

### ポリゴンエリア定義ツール（各ツール共通の構成）

```
┌──────────────────────────────┐
│   UIレイヤー                   │ ← 画面の表示、マウス・キーボード操作の受付
├──────────────┬───────────────┤
│ アプリケーション │  インフラ       │
│ レイヤー       │  レイヤー       │
│（状態と操作）   │（ファイル入出力）│
├──────────────┴───────────────┤
│   ドメインレイヤー               │ ← エリアの規則、幾何計算、JSON変換、エラー
└──────────────────────────────┘
```

#### UIレイヤー
- **責務**: 画面の表示、マウス・キーボード・ドラッグ&ドロップの受付、ファイルの振り分けと検証の呼び出し、エラーの表示、id の作成
- **許可される操作**: アプリケーションレイヤー・インフラレイヤー・ドメインレイヤーの呼び出し。`EditorState` に入れない一時的な状態（カーソル位置、ホバー、ドラッグ中の情報、入力中の文字列、タイマー、操作説明の開閉）をコンポーネントの状態に持つこと
- **禁止される操作**: `EditorState` を `reduce` 以外の方法で変更すること。JSONの出力や操作の結果に影響する値をコンポーネントの状態に持つこと

#### アプリケーションレイヤー
- **責務**: エディタの状態（`EditorState`）を、操作（`EditorAction`）に応じて更新する
- **許可される操作**: ドメインレイヤーの呼び出し
- **禁止される操作**: UIレイヤー・インフラレイヤーへの依存、ブラウザのAPI（DOM、`File`、`URL`、`crypto`、タイマーなど）の使用。`reduce` は純粋関数にする（同じ入力には同じ出力。副作用なし）。id や時刻などの決まらない値は、操作の引数で受け取る

#### インフラレイヤー
- **責務**: PCのファイルの読み込み、ファイルの保存（ダウンロード）、ローカルURLの作成と解放
- **許可される操作**: ブラウザのAPI（`File`、`Blob`、`URL.createObjectURL`・`URL.revokeObjectURL`、`HTMLImageElement`（`Image`）、`document.createElement("a")` によるダウンロード、`setTimeout`、`performance.mark`）、ドメインレイヤーの型の参照
- **禁止される操作**: ネットワーク通信（`fetch`、`XMLHttpRequest`、`WebSocket` など）、アプリケーションレイヤー・UIレイヤーへの依存、ドメインレイヤーの関数の呼び出し（型の参照だけにする）

#### ドメインレイヤー
- **責務**: エリアの規則、座標変換、当たり判定、JSONとの相互変換と検証、全てのエラーの型と文言（`toMessage`）
- **許可される操作**: 純粋な計算のみ
- **禁止される操作**: 他のレイヤーへの依存、ブラウザのAPIや外部ライブラリの使用

依存は上から下への一方向のみ。アプリケーションレイヤーとインフラレイヤーは互いに依存しない（両方を組み合わせるのはUIレイヤー）。

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| 実績・お知らせ | リポジトリ内のファイル（コンテンツコレクション、`file()` ローダー） | YAML（1種類1ファイルの配列） | ページのコードに触れずに、データを足すだけで更新できる。ビルド時にスキーマで検証できる |
| ツール情報 | リポジトリ内のファイル（コンテンツコレクション、`glob()` ローダー） | YAML（1ツール1ファイル。ファイル名が slug） | ツールを追加するとき、一覧ページのコードを変更しなくて済む |
| 技術メモ（P2） | リポジトリ内のファイル（コンテンツコレクション、`glob()` ローダー） | Markdown | Markdown で書いて置くだけで公開できる |
| エリア定義 | 利用者のPC（エリア定義JSONのダウンロード） | JSON（`AreaDefinitionFile`） | 画像を外に出さないため、サーバーにもブラウザのストレージにも保存しない |

- コンテンツコレクションのスキーマは `astro/zod` で `src/content.config.ts` に書き、[functional-design.md](functional-design.md) のデータモデルの制約と一致させる。スキーマで確かめられる1件ごとの制約（文字数、年・日付の形式と実在する日付、`order` など）を満たさないデータがあると、ビルドが失敗する
- id の一意性のように複数件にまたがる制約と、id・slug の形式（`file()` ローダーの id と、`glob()` ローダーのファイル名はスキーマの外）は、YAML とファイル名を直接読むユニットテスト（`src/content/content.test.ts`）で確かめる。`file()` ローダーは id が重複しても警告を出して後のデータで上書きするだけなので、このテストが必要
- 表示順は、データから決まる規則でページで並べ替える（実績は年の降順・`order` の昇順・`id` の昇順、お知らせは日付の降順・`id` の昇順、ツールは `order` の昇順・slug の昇順）。`getCollection` が返す順序は保証されないので、それに頼らない
- 日付: Astro の YAML 読み込みは、クォートしない `2026-10-01` を `Date` 型にする。お知らせの `date` は YAML で必ずクォートし、スキーマは `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` にする（クォートし忘れるとビルドが失敗するので気付ける）

### バックアップ戦略

- サイトのコードとコンテンツは Git（GitHub）で管理する。GitHub のリポジトリがバックアップを兼ねる
- エリア定義JSONは利用者のPCに保存される。ツールは保存しないので、バックアップは利用者の責任とする

## 公開（デプロイ）

| 項目 | 方針 |
|---|---|
| リポジトリ | GitHub の公開（public）リポジトリにする。GitHub Free で GitHub Pages を無料で使うため。個人情報は `tmp/` に置き、コミットしない |
| ホスティング | GitHub Pages（Settings → Pages の Source を「GitHub Actions」にする） |
| PR の確認（`ci.yml`） | PR と `main` への push で動く。`jdx/mise-action` で Node.js と pnpm を入れ、`pnpm install --frozen-lockfile`、`pnpm exec playwright install --with-deps chromium` の後、[development-guidelines.md](development-guidelines.md) の「必須チェック」の CI の列を全て実行する。E2E はその前の手順でビルドした `dist/` を配信して行う（ビルドは1回）。同じブランチで新しく push されたら古い実行を取り消す（`concurrency`）。権限は `contents: read` だけ |
| ブランチの保護 | `main` にルールセットを設定し、`ci.yml` のジョブの成功をマージの必須条件にする。`main` への直接の push は禁止する（公開リポジトリなので GitHub Free で使える）。設定するのは、初期化の PR を `main` にマージした後 |
| 公開（`deploy.yml`） | `main` への push で動いた CI（`ci.yml`）が成功したとき（`workflow_run`）と、手動実行（`workflow_dispatch`）で動く。CI が確かめたコミット（`workflow_run.head_sha`）を公開するので、組み合わせて壊れた `main` は CI で止まり、公開されない。`build` ジョブ（withastro/action、`node-version: 24`）と、`deploy` ジョブ（`needs: build`、`environment: github-pages`、actions/deploy-pages）の2つに分ける。`concurrency: { group: pages, cancel-in-progress: false }`。権限は、ワークフロー全体は `contents: read` だけにし、`pages: write`・`id-token: write` は `deploy` ジョブにだけ付ける。手動実行で `main` 以外を公開しないよう、リポジトリの Settings → Environments → `github-pages` の Deployment branches を `main` に限る |
| URL | `https://yamadentanaka.github.io/yamaden_site/`（GitHub アカウントは `yamadentanaka`、リポジトリ名は `yamaden_site`）。Astro の `site` を `https://yamadentanaka.github.io`、`base` を `/yamaden_site/`、`trailingSlash` を `"always"`、`build.format` を既定の `"directory"` にする |
| サイト内のリンク | 全て `src/routing/withBase.ts` の `withBase(path)` で作る。`path` は先頭に `/` を付けない相対パス（例: `withBase("tools/")`。トップページは `withBase("")`）。先頭が `/` のパスを渡したら例外を投げる。`base` が変わっても、サイト内リンクのコードは変えなくて済む |
| 独自ドメイン（任意） | 使う場合は、リポジトリの Settings → Pages でカスタムドメインを設定し、DNS に CNAME を追加する（Actions で公開するので、`public/CNAME` は置かない）。あわせて、`astro.config.mjs` の `base` を `/`、`site` を独自ドメインのURLに変え、`playwright.config.ts` の URL と [development-guidelines.md](development-guidelines.md) の開発サーバーの URL も変える。メール（MXレコード）には影響しない |
| 移行 | 物足りなくなったら Cloudflare Pages への移行を検討する。出力は静的ファイルなので、ビルドコマンドと公開先を変えるだけで移行できる |

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標 | 測定方法 | 測定環境 |
|------|---------|---------|---------|
| 4K画像（3840×2160 の JPEG）の読み込み | 2秒以内（5回の中央値） | 下記の `performance.measure("image-load")` の値を、Chrome のパフォーマンスパネル（または DevTools のコンソールで `performance.getEntriesByName("image-load")`）で5回読み取り、中央値をとる | 開発者のノートPC（Apple Silicon の MacBook）、Chrome 最新版、DevTools のパフォーマンスパネルで「CPU: 4x slowdown」、本番ビルド（`pnpm build && pnpm preview`。Claude Code などの AI エージェントの中では `pnpm preview --ignore-lock`） |
| 拡大縮小・移動・頂点のドラッグ | 16.7ms を超えるフレームが全体の5%以下 | 4K画像に10エリア（合計100頂点）を設定し、各操作を5秒ずつ行う間を Chrome のパフォーマンスパネルで記録し、フレームの時間を数える | 同上 |
| トップページの表示 | Lighthouse の Performance スコア 90以上 | Chrome の Lighthouse（モバイル設定）で、公開前に1回測る | 同上（CPU の設定は Lighthouse の既定） |

#### 測定のための目印
- `loadImageFile` の開始時に `performance.mark("image-load-start")` を付ける。キャンバスの SVG の `<image>` の `load` イベントの中で `requestAnimationFrame` を呼び、そのコールバックで `performance.mark("image-load-end")` を付け、`performance.measure("image-load", "image-load-start", "image-load-end")` を記録する
- この目印は本番のコードに残す（外部には送らず、`console` にも出さない）
- 性能の測定は手作業で、公開前と、ツールの表示や操作の速さに関わる変更をしたときに行う。CI では測らない

#### 性能を保つための方針
- 拡大縮小・移動は、画像とエリアをまとめた SVG のグループ1つに `transform` を当てて行い、要素を作り直さない
- 頂点ハンドルや線の太さは、`1 / scale` を掛けて、拡大率に関係なく同じ画面px にする
- `pointermove` の処理は `requestAnimationFrame` で1フレームに1回にまとめる
- 画像は `URL.createObjectURL` で作ったURLをそのまま SVG の `<image>` に指定し、HTML の `<canvas>` に描き直したり Base64 に変換したりしない。画像を差し替えるときは古いURLを解放する

### リソース使用量

| リソース | 上限 | 測定方法 | 理由 |
|---------|------|---------|------|
| サイトのJavaScript | gzip 後の合計 50KB 以下 | `pnpm build` の後、`dist/_astro/` の全ての `.js` を gzip した大きさの合計（[development-guidelines.md](development-guidelines.md) のコマンドを使う）。画面に関わる変更の PR で手元で確認する | Preact（約4KB）とツールのコードだけで足りる規模のため。超えたら原因を調べる |
| ホスティング費用 | 月0円 | GitHub の請求画面 | PRD の運用コストの要件。GitHub Pages の無料の範囲（サイトの容量 1GB 以下）に収める |

## セキュリティアーキテクチャ

### データ保護

- **画像とJSONを外に送らない**: インフラレイヤーでネットワーク通信を禁止し、ESLint でも機械的に確かめる（[development-guidelines.md](development-guidelines.md)）。加えて、ブラウザ側でも CSP で通信を止める
- **CSP**: `astro.config.mjs` の `security.csp` を有効にし、Astro が `<meta http-equiv="content-security-policy">` を出力するようにする。`directives` には次の7つだけを指定する
  - `default-src 'none'`
  - `img-src 'self' blob:`（ローカルURLの画像を表示するため）
  - `connect-src 'none'`（JavaScript からの通信を全て止める）
  - `font-src 'none'`（Webフォントは使わない）
  - `base-uri 'self'`
  - `form-action 'none'`
  - `object-src 'none'`
  - `script-src` と `style-src` は `directives` に書かない（Astro 7.3.8 は、書くと設定エラーでビルドを止める）。`scriptDirective`・`styleDirective` も指定しない。既定で `'self'` と、Astro が作ったハッシュが出力される。`'unsafe-inline'` と `strictDynamic` は使わない
  - 設定例: `security: { csp: { directives: ["default-src 'none'", "img-src 'self' blob:", "connect-src 'none'", "font-src 'none'", "base-uri 'self'", "form-action 'none'", "object-src 'none'"] } }`
  - HTML の `style` 属性はハッシュでは許されないので、`.astro` ファイルでは `style` 属性と `define:vars` を使わない（Preact の `style` は CSSOM 経由で設定されるので問題ない）
  - CSP は開発サーバー（`pnpm dev`）では効かないので、確認は本番ビルド（`pnpm preview`、E2E テスト）で行う。E2E テストで、全てのページのコンソールに CSP の違反が出ないことを確かめる
- **遅れて取得されるリソースを使わない**: ツールのページでは、ページを開いた後で取得されるリソース（Webフォント、CSS の `url()` の画像、動的な `import()`）を使わない。フォントはシステムフォントだけにする。「通信0件」の E2E テストは、`page.waitForLoadState("networkidle")` を待ってから監視を始める
- **外部のスクリプトを読み込まない**: CDN やアクセス解析のスクリプトは使わない
- **機密情報**: サイトに機密情報はない。GitHub Actions は、上の「公開」の表の権限だけを使う
- **リポジトリに個人情報を入れない**: リポジトリは公開なので、職務経歴書などの作業用ファイルは `tmp/` に置き、Git の管理対象から外す

### 入力検証

- **ファイルの振り分け**: [functional-design.md](functional-design.md) の「ファイルの振り分け」の規則で、画像・JSON・それ以外に分ける
- **画像**: `File.type` が `image/png`・`image/jpeg`・`image/webp`・`image/gif`・`image/bmp` のどれかであることを確認し、`HTMLImageElement` でデコードでき、`naturalWidth`・`naturalHeight` が1以上のものだけを受け付ける
- **JSON**: [functional-design.md](functional-design.md) の「JSONの検証」の順に、ドメインレイヤーで全ての項目を検証してから状態に入れる。検証前のデータを状態に入れない
- **エリア名**: 画面への表示は Preact のテキストとして行い（自動でエスケープされる）、HTML として挿入しない（`dangerouslySetInnerHTML` を使わない）
- **エラーの表示**: ユーザーには原因と対処が分かるメッセージだけを出し、例外の詳細はブラウザのコンソールに出す

## スケーラビリティ設計

### データ増加への対応

- **想定データ量**: 1枚の画像あたりエリア10件・合計100頂点を性能の基準とする。これを大きく超える使い方（数千頂点）は想定しない
- **画像サイズ**: 性能の目標は 4K までとする。それより大きい画像も読み込めるが、性能は保証しない
- **実績・お知らせ**: 件数が増えても全件をトップページに表示する。100件を超えたら、ページ分けか過去分のページを検討する

### 機能拡張性

- **ツールの追加**: 新しいツールは「ツール情報のYAMLを1ファイル追加」「ツールのページを1つ追加」「ツールのコードを専用のディレクトリに追加」の3つで足せる。既存のツールのコードには触れない
- **ツールの構成**: 各ツールは独立したディレクトリに置き、UI・アプリケーション・ドメイン・インフラのレイヤーに分ける（使わないレイヤーは省略できる）。ツール間でコードを共有する必要が出たら、2つ以上のツールで使うものだけを `src/tools/shared/` に移す
- **JSONの形式**: `version` で形式を区別する。形式を変えるときは `version` を上げ、古い形式の読み込みに対応するかをその時に決める
- **Rust / WebAssembly**: 計算が重いツールを作るときに導入を検討する。導入時はこの文書に技術選定を追記する

## テスト戦略

### ユニットテスト
- **フレームワーク**: Vitest
- **対象**: 各ツールのドメインレイヤーとアプリケーションレイヤー（Node.js 上で実行。DOM は使わない）、サイトコンテンツの id の一意性
- **カバレッジ目標**: ドメインレイヤーとアプリケーションレイヤーで 90%（行）。計測の対象は `src/tools/*/{domain,application}/**/*.ts`（テストファイルを除く）に限り、`thresholds` で下回ったら失敗させ、CI で確かめる。UIレイヤーとインフラレイヤーは E2E テストで確認するので、計測しない

### 統合テスト
- **方法**: Vitest で、ドメインレイヤーとアプリケーションレイヤーを組み合わせて確認する
- **対象**: エリア定義JSONの往復（出力 → 解析 → 読み込み → 出力で完全に一致する）

### E2Eテスト
- **ツール**: Playwright（Chromium のみ）。本番ビルドを `pnpm preview` で配信して実行する
- **シナリオ**:
  - 画像を読み込み、エリアを2つ描いて、エリア定義JSONをダウンロードする
  - ダウンロードしたJSONを読み込み、エリアが復元される
  - 画像を読み込む直前から、JSONのダウンロードと読み込みを含む操作を終えるまで、http・https のリクエストが0件（配信元を含む。`networkidle` を待ってから `page.on("request")` で監視する。`blob:` と `data:` は数えない）
  - 全てのページ（トップ・ツール一覧・ツール）で、CSP の違反がコンソールに出ない
  - トップページ → ツール一覧 → ポリゴンエリア定義ツールと移動でき、ツール一覧の全てのリンク先が開ける

## 技術的制約

### 環境要件
- **利用者のブラウザ**: PC の Chrome・Edge の最新版。動作確認と E2E テストは Chrome（Chromium）で行う。Firefox・Safari は動けばよく、確認しない。スマホ・タブレットでのツールの操作は対象外（ページは表示できればよい）
- **開発環境**: macOS、mise、Node.js 24 LTS、pnpm 12
- **必要な外部依存**: なし（実行時に外部のサービスを使わない）

### パフォーマンス制約
- GitHub Pages はサーバー側の処理ができないため、全てビルド時かブラウザ内で処理する

### セキュリティ制約
- GitHub Pages ではHTTPレスポンスヘッダーを設定できない。CSP は HTML の `<meta>` で設定する（`frame-ancestors` など `<meta>` では効かない項目は使えない）

## 依存関係管理

| ライブラリ | 用途 | バージョン管理方針 |
|-----------|------|-------------------|
| Node.js | 実行環境 | `mise.toml` でメジャーバージョン（`24`）を指定する。`package.json` の `engines.node` も `>=24 <25` にする |
| pnpm | パッケージマネージャ | `mise.toml` と `package.json` の `packageManager` の両方に、同じ正確なバージョン（`12.11.2`）を書く（withastro/action が `packageManager` を読むため）。上げるときは両方を同時に変える |
| TypeScript | 型チェック | 正確なバージョンに固定する。typescript-eslint・@astrojs/check の対応範囲を確認してから上げる。7 系への移行条件は下記 |
| Astro、@astrojs/preact | サイト生成 | 正確なバージョンに固定する。マイナーバージョンでも挙動が変わることがあるため、上げるときはビルドと E2E テストで確認する |
| Preact | UI | 正確なバージョンに固定する。@astrojs/preact が 11 系に対応したら移行を検討する |
| 開発ツール（Vitest、Playwright、ESLint、Prettier、yaml、@types/node など） | テスト・lint・フォーマット | 正確なバージョンに固定する。フォーマットや lint の結果が勝手に変わらないようにするため |
| GitHub Actions の Action | CI・デプロイ | コミットの SHA で固定し、コメントにバージョンを書く（例: `actions/checkout@3d3c42e…  # v7.0.1`）。タグが付け替えられても、確かめていないコードが書き込み権限付きで動かないようにするため。更新は Dependabot の PR で行う |

- 全ての依存は `package.json` で正確なバージョンに固定し（`^` や `~` を付けない）、`pnpm-lock.yaml` をコミットする
- 依存の更新は、まとめて1つのPRで行い、必須チェックが全て通ることを確認してからマージする

### TypeScript 7 への移行

TypeScript 7 は Go で書き直され、型チェックが速くなる。ただし 2026-10-12 時点では、次の理由で 6.0 系を使う。

- TypeScript 7.0.2 には、これまでの JavaScript から呼び出すコンパイラ API（`ts.createProgram` など）がない（公開されているのは `unstable/*` のみ）
- typescript-eslint 8.71.1（canary の 8.71.2-alpha.4 も含む）の対応範囲は `>=4.8.4 <6.1.0`。型情報を使う lint が動かない
- @astrojs/check 0.9.10 の対応範囲は `^5.0.0 || ^6.0.0`。`.astro` ファイルの型チェックができない
- このプロジェクトの規模では、6.0 系でも型チェックは数秒で終わる見込みで、速くなる効果が小さい

**移行する条件**: typescript-eslint と @astrojs/check の両方が、正式版で TypeScript 7 を対応範囲に含めたら移行する。依存を更新するときに、両方の `peerDependencies` の `typescript` を確認する。

**移行するとき**: `typescript` を 7 系に上げ、この文書の技術選定の表を更新し、必須チェックが全て通ることを確認する。
