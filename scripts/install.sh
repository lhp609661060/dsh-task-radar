#!/usr/bin/env bash
# =============================================================================
# dsh-task-radar 一键安装脚本（macOS / Linux / Windows Git Bash）
#
# 通过 DSH 官方插件命令从 GitHub 安装并自动挂载到 web profile：
#   dsh plugin --profile web add github:<owner>/<repo>
#
# 本仓库已提交构建产物 lib/，git 安装时无需执行 prepare 构建脚本，
# 不会触发 pnpm 的 allowBuilds 拦截。
#
# 用法：
#   bash scripts/install.sh                 # 装到 web profile
#   bash scripts/install.sh owner/repo      # 指定 GitHub 仓库
#   bash scripts/install.sh owner/repo#tag  # 指定 tag
#   PROFILE=foo bash scripts/install.sh     # 自定义 profile
#
# 环境变量：
#   REPO      默认见下方常量；运行脚本所在目录是 git clone 时会自动取 origin
#   PROFILE   目标 profile 名，缺省 web
#   DSH_CMD   dsh 可执行文件；缺省优先用 PATH 上的 dsh，否则回退 npx
#
# 卸载：dsh plugin --profile web remove dsh-task-radar
# =============================================================================
set -euo pipefail

# TODO: 仓库发布后把这里改成实际的 GitHub owner/repo
DEFAULT_REPO="lhp/dsh-task-radar"
PROFILE="${PROFILE:-web}"

resolve_repo() {
  local given="${1:-}"
  if [ -n "$given" ]; then
    echo "$given"
    return
  fi
  # 在 clone 出来的仓库里运行时，直接从 origin 推断 owner/repo
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local url
    url="$(git config --get remote.origin.url 2>/dev/null || true)"
    case "$url" in
      git@github.com:*/*) echo "${url#git@github.com:}" | sed 's/\.git$//' ; return ;;
      https://github.com/*/*) echo "${url#https://github.com/}" | sed 's/\.git$//' ; return ;;
    esac
  fi
  echo "$DEFAULT_REPO"
}

REPO="$(resolve_repo "${1:-}")"

if command -v dsh >/dev/null 2>&1; then
  DSH_BIN=(dsh)
elif [ -n "${DSH_CMD:-}" ]; then
  # shellcheck disable=SC2206
  DSH_BIN=($DSH_CMD)
else
  DSH_BIN=(npx -y @deepseek-ai/dsh)
fi

echo ">> 安装 dsh-task-radar (github:$REPO) 到 profile: $PROFILE"
"${DSH_BIN[@]}" plugin --profile "$PROFILE" add "github:$REPO"

cat <<EOF

✅ 安装完成。请重启 DSH（或刷新 web 页面），右下角会出现雷达按钮。
   卸载: dsh plugin --profile $PROFILE remove dsh-task-radar
EOF
