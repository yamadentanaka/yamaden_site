#!/bin/bash
# Stop hook: 自律実行中の steering 作業（.steering/.active）に未完了タスクが残っていれば、1回だけ停止をブロックする。
input=$(cat)

# ブロック後の再停止は通す（ユーザーの判断が必要な場面で止まれなくなるのを防ぐ）
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
marker="$root/.steering/.active"
[ -f "$marker" ] || exit 0

dir=$(head -n 1 "$marker" | tr -d '\r')
case "$dir" in
  /*) ;;
  *) dir="$root/$dir" ;;
esac
tasklist="$dir/tasklist.md"
[ -f "$tasklist" ] || exit 0

# マーカーと tasklist.md がどちらも24時間以上更新されていなければ、中断された作業の残骸とみなして無視する
if [ -z "$(find "$marker" "$tasklist" -mmin -1440 2>/dev/null)" ]; then
  exit 0
fi

# 「実装後の振り返り」より前にある未完了タスクを抽出する
remaining=$(awk '/^##[[:space:]]+実装後の振り返り/ { exit } /^[[:space:]]*- \[ \]/ { print }' "$tasklist")
[ -z "$remaining" ] && exit 0

{
  echo "${tasklist#"$root"/} に未完了のタスクが残っています:"
  echo "$remaining"
  echo
  echo "実装を続けてください。大きすぎるタスクは分割し、技術的に不要になったタスクは理由を付けて完了扱いにしてください。"
  echo "ユーザーの判断が必要で進められない場合は、その理由を説明して停止してください。"
  echo "この作業が現在の依頼と無関係な場合（中断された作業の残りなど）は、実装を再開せず、${marker#"$root"/} を削除して停止してください。"
} >&2
exit 2
