---
description: 初回セットアップ: 6つの永続ドキュメントを対話的に作成する
---

# 初回プロジェクトセットアップ

`docs/` に6つの永続ドキュメントを作成する。各ドキュメントは対応するスキルの入力・決め事・品質基準に従う。

## 手順

1. `docs/ideas/` の Markdown を全て読む（`sample.md` は無関係なサンプルなので読まない）。何もなければ、PRD 作成時に対話で要件を確認する
2. **PRD**: prd-writing スキルで `docs/product-requirements.md` を作成し、**ユーザーの承認を得るまで待つ**
3. 承認後、以下を順に作成する。各ドキュメントは、それまでに作成したドキュメントを入力にする
   1. functional-design スキル → `docs/functional-design.md`
   2. architecture-design スキル → `docs/architecture.md`
   3. repository-structure スキル → `docs/repository-structure.md`
   4. development-guidelines スキル → `docs/development-guidelines.md`
   5. glossary-creation スキル → `docs/glossary.md`
4. 5つを作成したら、ドキュメント間の整合（用語、レイヤー名、コマンド）を確認し、まとめてユーザーに確認を求める。PRD に書かれていない前提を置いた箇所は明示する

## 完了時

作成したドキュメントの一覧と、次の使い方を短く伝える。

- docs の編集は会話で依頼できる
- 機能の追加は `/add-feature [機能名]`
- ドキュメントのレビューは `/review-docs [パス]`
