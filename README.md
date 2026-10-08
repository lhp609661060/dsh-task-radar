<div align="center">

# 🛰️ dsh-task-radar · 任务雷达

**DeepSeek Harness（DSH）多工程任务状态总览与提醒插件（web 客户端）**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform: DSH web](https://img.shields.io/badge/platform-DSH%20web-316fdb)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![Requires DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.0--rc.1-2ea043)](https://www.npmjs.com/package/@deepseek-ai/dsh)

[English](./README_EN.md) · [更新日志](./CHANGELOG.md) · [问题反馈](https://github.com/lhp609661060/dsh-task-radar/issues)

</div>

<!-- 截图：发布时把界面截图放到 docs/ 后替换本段，例如
![任务雷达](docs/screenshot.png)
-->

当你在 DSH 里同时让**多个工程目录**的会话并行干活时，状态散落在各个会话里，
只能手动来回切换查看。任务雷达把所有会话聚合成一个**可拖动的雷达按钮**和消息栏：
谁在等你确认、谁正在跑、谁跑完了，一眼可见，点击直达对应会话；
哪怕浏览器切到了别的标签页，也能通过标题、favicon 和系统通知提醒你。

## ✨ 功能一览

### 浏览器标签页提醒

- **标题前缀**：存在等待确认时显示红色 `(N)`；仅有完成项时显示绿色 `✓ N ·`
- **favicon 角标**：红 / 绿圆点加数量，不切标签页也能扫到状态
- **系统通知与提示音**（可选，默认关闭）：切到其他标签页时弹浏览器通知，
  点击通知直接跳到对应会话；等待确认时可播放提示音

### 可拖动的雷达按钮

- 按住可拖到屏幕任意位置，**松手自动吸附最近的左 / 右边缘**，位置记忆在浏览器本地
- 按各状态会话的**数量比例锥形着色**，一眼看出整体进度：

| 颜色 | 含义 |
| :---: | --- |
| 🟡 淡黄 | 等待确认（工具审批 / 提问 / 计划批准） |
| 🔵 淡蓝 | 进行中 |
| 🟢 淡绿 | 处理完成 |

  - 全部跑完 → 整圆淡绿；全部在跑 → 整圆淡蓝
  - 混合状态（例如一半在跑、一半完成）→ 按比例分扇区，扇区之间有细缝分界
  - 只要存在等待确认，整圆即有琥珀色脉冲呼吸，优先级最高不会被淹没
- 雷达扫描线缓慢旋转；角标显示最高优先级数量（等待 > 完成 > 进行中）
- 点击展开的消息面板会跟随按钮位置弹出（靠近屏幕顶部时自动改为向下展开）

### 消息栏分组

- ⏳ **等待确认**：工具权限审批、`ask_user_question` 提问、计划批准
  （取自主机 `useSessionStatus` 的 `pendingInteraction`）
- 🔄 **进行中**（可在设置中隐藏）
- ✅ **处理完成**（`useSessionStatus.completionUnread`；当前会话在后台跑完的情况由插件补记）
- 每条显示会话标题、所属工程目录（cwd 末级名）和相对时间
- **点击任意一条即切换到对应会话**（`uiWorkspace.openSession`）

子智能体（subagent）会话不占消息位，避免多智能体团队刷屏。
所有偏好与按钮位置仅保存在浏览器 localStorage，**不收集、不上传任何数据**。

## 📦 环境要求

- [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) `@deepseek-ai/dsh` ≥ `0.2.0-rc.1`（0.2.0 版本线；本插件 v0.1.0 对应 DSH 0.1.x）
- DSH **web 客户端**（`dsh web`）；桌面 / CLI 场景不适用
- Node.js ≥ 20（仅从源码本地构建时需要，直接安装无需）

## 安装

### 方式一：从 GitHub 安装（推荐）

本仓库直接提交了构建产物 `lib/`，git 安装时**无需执行构建脚本**，
不会触发 pnpm 的 `allowBuilds` 拦截：

```bash
dsh plugin --profile web add github:lhp609661060/dsh-task-radar
```

锁定版本可指定 tag：

```bash
dsh plugin --profile web add github:lhp609661060/dsh-task-radar#v0.2.0
```

安装后重启 DSH 或直接刷新 web 页面，右下角即出现雷达按钮。

### 方式二：一键脚本

```bash
# macOS / Linux / Windows（Git Bash）
bash scripts/install.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

### 方式三：npm（发布到 npm 后）

```bash
dsh plugin --profile web add dsh-task-radar
```

### 方式四：本地开发（link）

```bash
pnpm install
pnpm build
dsh plugin --profile web add link:/绝对路径/dsh-task-radar
```

> `dsh plugin add` 会依据包内的 `cordis.patch.yml` 自动把本包注册进 profile 的
> `dsh.profile.bundles`，无需手写挂载行。开发时客户端 HMR（`patchReload: live`）
> 生效，重新构建后刷新页面即可看到变化。

**卸载：**

```bash
dsh plugin --profile web remove dsh-task-radar
```

## 🚀 使用

1. 让两个以上不同工程目录的会话同时运行，雷达按钮出现在右下角。
2. 按钮配色实时反映各状态会话的比例；淡黄扇区或脉冲意味着有会话在等你操作。
3. 点击按钮展开分组列表，点击任意一条直接跳到该会话。
4. 面板右上角齿轮可开关：系统通知、等待确认提示音、「进行中」分组显示。
5. 首次开启系统通知时浏览器会请求 Notification 权限；若此前拒绝过，
   需要在浏览器站点设置中手动放开。
6. 想重置按钮位置：在该页面的浏览器控制台执行
   `localStorage.removeItem('dsh-task-radar:fab-pos:v1')` 后刷新。

## 🛠️ 开发

```bash
pnpm install
pnpm dev        # tsdown watch 构建到 lib/
pnpm check      # typecheck + 构建 + 离线 smoke 测试
```

客户端 bundle 必须保持纯净（运行时只可 require `react` / `react/jsx-runtime`），
宿主能力通过框架注入的全局标准 hook 和 cordis 服务获取，
`scripts/smoke.mjs` 会校验这一点。

发布 tag 前务必重新构建并提交 `lib/`（git 安装直接消费仓库内产物）：

```bash
pnpm build && git add lib && git commit -m "chore: build bundles"
```

## 🧩 架构

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | Node 端空插件（纯客户端功能，仅为满足组合入口） |
| `src/client/index.tsx` | 注册 `shell.overlay`（list / root）；注入 `slots`、`sessions`、`uiSession`、`uiWorkspace` |
| `src/client/derive.ts` | 会话列表 + useSessionStatus 状态快照 → 任务分组的纯函数推导（可单测） |
| `src/client/notifier.ts` | 标题前缀 / favicon 角标 / WebAudio 提示音 / Notification |
| `src/client/App.tsx` | 边沿检测器、可拖动比例着色雷达按钮、消息栏、toast、设置 |
| `src/client/styles.ts` | 一次性注入的命名空间样式，颜色跟随宿主主题变量 |
| `src/client/settings.ts` | localStorage 偏好与按钮位置持久化 |

**数据来源：**

- `useSessions`（`SessionListState`）：全部会话与工程目录
- `useSessionStatus`（`SessionStatusSnapshot`）：每会话 `running` / `pendingInteraction`（approval / question / plan-review 统一等待信号）/ `completionUnread`
- 当前会话 id：宿主持久化选择（localStorage `dsh.sessions.current`）
- `uiWorkspace.openSession(id)`：点击消息后切换会话

## 📄 License

[MIT](./LICENSE)
