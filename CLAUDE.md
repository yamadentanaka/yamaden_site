# プロジェクトメモリ

## スペック駆動開発

「何を作るか」を永続ドキュメント（`docs/`）で定義し、「今回何をするか」を作業単位のステアリングファイル（`.steering/`）で計画してから実装する。

`/setup-project` やユーザーの依頼で docs を先に作成・更新した場合は、その docs を前提に作業を計画する（docs → steering → 実装）。

作業を計画する時（steering スキルのモード1）は、docs への影響を次の3つから判定し、進め方を決める。

- **影響なし**: steering → 実装
- **仕様の変更**: steering → docs → 実装。docs を先に更新し、それを正として実装する
- **実装結果の反映のみ**: steering → 実装 → docs

## ルール

- **docs の作成**: `/setup-project` では、PRD を作成したらユーザーの承認を得る。残りの5ファイルは PRD を元に続けて作成し、最後にまとめて確認を求める。それ以外で docs を新規作成する場合は、1ファイルずつ承認を得る
- **実装前**: 関連する docs と、既存の類似実装を確認し、既存のパターンに合わせる
- **ステアリングファイル**: 作業計画・実装・振り返りでは steering スキルを使う。作業ごとに `.steering/[YYYYMMDD]-[タスク名]/`（例: `20250115-add-user-profile`）を作成し、`requirements.md` / `design.md` / `tasklist.md` を置く
- **コマンド**: テスト・lint・型チェックなどのコマンドは `docs/development-guidelines.md` に従う

## ディレクトリ

| パス | 役割 |
|---|---|
| `docs/ideas/` | 壁打ち・技術調査のメモ（自由形式）。`/setup-project` の入力になる |
| `docs/product-requirements.md` | プロダクト要求定義書 |
| `docs/functional-design.md` | 機能設計書 |
| `docs/architecture.md` | 技術仕様書 |
| `docs/repository-structure.md` | リポジトリ構造定義書 |
| `docs/development-guidelines.md` | 開発ガイドライン |
| `docs/glossary.md` | 用語集 |
| `.steering/` | 作業単位の計画と記録。作業ごとに新規作成し、履歴として残す |

`docs/` はプロジェクト全体の基本設計であり、頻繁には変更しない。
