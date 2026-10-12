---
description: pr-fixで対応した変更をコミット・pushし、対応したインラインコメントに返信する
---

# レビュー対応の反映（pr-fix-push）

`/pr-fix` で GitHub の PR フィードバックに対応した変更を **コミット・push** し、
対応した **インラインコメントへの返信・スレッド解決** を行います。引数で渡された
PR の URL を対象に、以下の手順を **順番に** 実行してください。

**このコマンドは、対象PRのリポジトリ内（カレントリポジトリ自身のPR）で実行することを
前提とします。** 他リポジトリのPRをcloneして解析する用途には対応していません。

## 入力

- 第1引数: **PR の URL**（必須）。例: `https://github.com/acme/web-app/pull/123`

引数が渡されていない場合は、PR の URL を尋ねてから開始してください。

## 前提

- 事前に `/pr-fix <PRのURL>` を実行し、このリポジトリ内でコードの修正が
  完了していること（未実施の場合は先に `/pr-fix <PRのURL>` の実行を促して停止する）。
- `gh` CLI が認証済みであること（`gh auth status` で確認可能）。
- ターミナルコマンドはワークスペースルート（このリポジトリ）で実行する。
- カレントディレクトリが対象PRのリポジトリであること。

## 手順

### 1. URL をパース
PR の URL から `owner` / `repo` / `pull_number` を抽出する。

### 2. 未コミットの変更を確認する
```bash
git status
git diff
```
変更が無ければ、「コミットする変更がありません。先に `/pr-fix <PRのURL>` を実行してください」
と案内して停止する。

### 3. 対応内容を特定する
- この会話の直前に `/pr-fix` を実行済みであれば、そこで確認した
  「対応した指摘一覧（path:line・レベル・対応内容）」「スキップした指摘（理由）」を
  そのまま利用する。
- 会話に対応内容の情報が無い場合（新しいセッションでの実行等）は、`/pr-fix` の手順3と
  同様に PR に投稿済みのフィードバックを取得し直し（`gh api .../pulls/<pull_number>/comments`
  等）、`git diff` の変更ファイル・行と突き合わせて、対応済みと
  推測されるコメントを特定する。推測した対応関係はユーザーに提示し、誤りがないか確認する。

### 4. コミット前の確認
- 変更内容のサマリ（変更ファイル一覧・対応した指摘一覧）とコミットメッセージ案を提示する。
- 手順5で `git add -A` を使うため、**`git status --short` の全出力をそのまま提示** し、
  レビュー対応と無関係な変更（作業中のファイル・一時ファイル等）が混ざっていないかを
  ユーザーに明示的に確認する。無関係な変更がある場合は、**stash・中断のどちらか** を
  選ばせる（手順5は `git add -A` 固定のため、コミット対象から外すには作業ツリーから
  退避する必要がある）。
  - stash を選んだ場合は、対象を指定して退避してから手順5に進む。
    ```bash
    git stash push -u -m "pr-fix-push: レビュー対応と無関係な変更を退避" -- <除外するファイル>...
    ```
    退避した変更は対応完了後に `git stash pop` で戻せる旨をユーザーに伝える。
  - 中断を選んだ場合は、作業ツリーを整理してから再実行するよう案内して停止する。
- コミットメッセージには対応した指摘の要約を含める
  （例: `レビュー指摘対応: pyproject.tomlのoverride-dependencies復元 他2件`）。
- **ユーザーに承認を取ってから** 次に進む。

### 5. コミットする
```bash
git add -A
git commit -m "<日本語のコミットメッセージ>"
```

### 6. push する（要確認）
GitHub への push は不可逆操作のため、**実行前に必ずユーザーに確認を取る**。
承認が得られてから以下を実行する。

```bash
git push
```

### 7. 対応済みコメントへの返信・スレッド解決（要確認）
push が完了したら、対応した各インラインコメントへの返信・スレッド解決を提案する。
**これも書き込み操作のため、実行前に必ずユーザーに確認を取る。**

- スレッドの node id が未取得の場合は GraphQL で取得する。
  ```bash
  gh api graphql -f query='
    query($owner:String!,$repo:String!,$number:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$number){
          reviewThreads(first:100){
            nodes{
              id
              isResolved
              comments(first:10){ nodes{ databaseId path line body } }
            }
          }
        }
      }
    }' -f owner=<owner> -f repo=<repo> -F number=<pull_number>
  ```
- コメントへの返信:
  ```bash
  gh api --method POST \
    repos/<owner>/<repo>/pulls/<pull_number>/comments/<comment_id>/replies \
    -f body="対応しました: <対応内容の要約>"
  ```
- スレッドを解決済みにする（上記で取得した `reviewThreads[].id` を使用）:
  ```bash
  gh api graphql -f query='
    mutation($id:ID!){
      resolveReviewThread(input:{threadId:$id}){ thread { isResolved } }
    }' -f id=<thread_node_id>
  ```

### 8. 対応レポートを出力する
`reviews/PR-<pull_number>-<YYYYMMDD-HHMM>.address.md` をこのリポジトリ直下の
`reviews/` ディレクトリ配下に作成する（`<YYYYMMDD-HHMM>` は作成時刻）。
`reviews/` は一時的な作業ログのため `.gitignore` 済みであり、コミット対象に含めない。

```markdown
# レビュー対応: <PRタイトル>

- **PR**: <PRのURL>
- **対応日時**: <YYYY-MM-DD HH:MM>
- **コミット**: <コミットSHA>（push: 済み/未実施）

## 対応した指摘

| path:line | レベル | 対応内容 |
| --- | --- | --- |
| `path/to/file.ext:123` | 🚫 ブロッカー | <実施した変更の要約> |

## スキップした指摘

| path:line | レベル | 理由 |
| --- | --- | --- |
| `path/to/file.ext:45` | 🤔 要検討 | <対応しなかった理由> |

## スレッド返信・解決状況

| コメント | 返信 | スレッド解決 |
| --- | --- | --- |
| `path/to/file.ext:123` | 済み/未実施 | 済み/未実施 |
```

### 9. 完了報告
- コミット SHA と push の実施有無を明示する。
- コメント返信・スレッド解決を実施したか（未実施なら理由）を明示する。
- 出力したレポートファイルのパスを示す。
- 手順4で stash した変更がある場合は、`git stash list` の該当エントリと
  `git stash pop` で復元できる旨を完了報告に明示する（処理が続くうちに埋もれて
  戻し忘れることを防ぐため）。

## 注意

- このコマンドはカレントリポジトリ自身のPRを対象とする。他リポジトリのPRを
  cloneして解析する用途には対応していない。
- `git push`・コメント返信・スレッド解決は **不可逆な書き込み操作** のため、必ず事前に
  ユーザーの確認を取ってから実行する。承認が得られるまで実行しない。
- 二重投稿・二重pushを避けるため、同じ PR に対して連続実行しないよう注意喚起する。
- 対応レポート・コミットメッセージ・返信コメントはすべて **日本語** で書く。
- `gh` が未認証・PR が見つからない・スレッド取得に失敗する等のエラー時は、
  原因と対処を提示して停止する。
