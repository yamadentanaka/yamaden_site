---
name: development-guidelines
description: 開発ガイドライン（docs/development-guidelines.md）を作成・更新するためのガイドとテンプレート。開発ガイドラインの作成・更新時に使う。実装時のルールは作成された docs/development-guidelines.md を参照する。
---

# 開発ガイドラインスキル

このプロジェクトでのコマンド・コーディング規約・Git 運用・テスト方針を定義する。作成された `docs/development-guidelines.md` は、実装（add-feature）や検証（implementation-validator）が、コマンドと規約の根拠として読む。

## 入力と出力

- 入力: `docs/architecture.md`（技術スタック・開発ツール）、`docs/repository-structure.md`（配置ルール）
- 出力: `docs/development-guidelines.md`。構造は [template.md](template.md) に従い、該当しないセクションは削除する
- 既存のガイドラインがある場合は、その構造と内容を優先し、変更箇所だけを更新する

## 書くこと・書かないこと

- **書く**: このプロジェクトで答えが分かれる選択と、その理由。template.md の「言語ごとに決める項目」を、採用した言語について全て決める
- **書かない**: 言語やツールの一般的な慣習（PEP 8、Rust API Guidelines、各言語の標準的な命名規則など）。「[言語]の標準的な慣習に従う」と1行書けば足りる。慣習から外れる決め事だけを書く
- **コマンド**: テスト・lint・フォーマット確認・型チェック・ビルドのコマンドは、そのままコピーして実行できる形で書く。add-feature と implementation-validator はこの表をそのまま使う

## 特に指定がない場合の既定

ユーザーやアーキテクチャ設計書に指定がなければ、以下を採用する。

- ブランチ: `main` から `feature/<説明>` / `fix/<説明>` を切り、PR でマージする。`main` への直接コミットはしない
- コミットメッセージ: Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `test` / `chore` など）。本文は日本語
- カバレッジ目標: 全体 80%、ビジネスロジックの層は 90%。100% は目指さない
- テストは Given-When-Then の構造で、何を確認するかが名前から分かるように書く

## 品質基準

- [ ] コマンドの表が埋まっていて、全てそのまま実行できる
- [ ] 採用言語の「決める項目」が全て決まっている
- [ ] エラー処理の方針（どの層で捕捉し、ユーザーにどう伝えるか）が決まっている
- [ ] ブランチ・コミット・PR の運用が決まっている
- [ ] テストの種類・配置・カバレッジ目標が決まっている
