# dsh-task-radar · 任务雷达

[English](./README_EN.md) · [更新日志](./CHANGELOG.md)

DeepSeek Harness（DSH）web 客户端插件：当你同时让**多个工程目录**的会话并行干活时，
不用来回切换会话翻状态——任务雷达把所有会话聚合成一个可拖动的雷达按钮和消息栏，
并在浏览器标签页上直接提醒你「谁在等你、谁跑完了」。

## 功能

- **标签页提醒**
  - 标题前缀：存在等待确认时显示红色 `(N)`，仅有完成项时显示绿色 `✓ N ·`
  - favicon 角标：红 / 绿圆点 + 数量
  - 切到别的标签页时可开启浏览器系统通知（点击通知直达对应会话）和提示音
- **可拖动的雷达按钮**（`shell.overlay` 浮动层）
  - 按住可拖到屏幕任意位置，松手自动吸附最近的左 / 右边缘，位置记忆在 localStorage
  - 按任务状态**数量比例锥形着色**：淡黄 = 等待确认，淡蓝 = 进行中，淡绿 = 处理完成
    - 全部跑完 → 整圆淡绿；全部在跑 → 整圆淡蓝
    - 混合状态（如一半在跑、一半完成）→ 按比例分扇区，扇区之间有细缝分界
    - 存在等待确认时整圆琥珀色脉冲，优先级最高
  - 雷达扫描线缓慢旋转；角标显示最高优先级数量（等待 > 完成 > 进行中）
  - 点开后消息面板自动跟随按钮位置弹出（靠上时向下展开）
- **消息栏按状态分组**
  - ⏳ **等待确认**：工具权限审批 / `ask_user_question` 提问 / 计划批准（取自主机 pending-interaction）
  - 🔄 **进行中**（可在设置中隐藏）
  - ✅ **处理完成**（取自主机 completion reminder；当前会话在后台跑完时由插件补记）
  - 每条显示会话标题、所属工程目录（cwd 末级名）、相对时间
- **点击任意一条即切换到对应会话界面**（`sessions.open`）

非顶层会话（subagent 行）不占消息位，避免多智能体团队刷屏。所有偏好和按钮位置
保存在浏览器 localStorage，不上传任何数据。

## 环境要求

- DSH `@deepseek-ai/dsh` ≥ `0.1.5-rc.1`
- 使用 web 客户端（`dsh web`）
- Node.js ≥ 20（仅从 git 源码本地构建时需要；直接安装无需）

## 安装

> 把下方命令里的 `<your-name>/dsh-task-radar` 替换为本仓库实际的 GitHub 路径。

**方式一：从 GitHub 安装（推荐，无需本地构建）**

本仓库直接提交了构建产物 `lib/`，因此 git 安装不需要执行 prepare 构建脚本，
也不会触发 pnpm 的 `allowBuilds` 拦截：

```bash
dsh plugin --profile web add github:<your-name>/dsh-task-radar
```

如需锁定版本，可指定 tag：`github:<your-name>/dsh-task-radar#v0.1.0`。
安装后重启 DSH（或刷新 web 页面）即可，右下角会出现雷达按钮。

**方式二：一键脚本**

```bash
# macOS / Linux / Windows (Git Bash)
bash scripts/install.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

**方式三：npm（发布后）**

```bash
dsh plugin --profile web add dsh-task-radar
```

**方式四：本地开发（link）**

```bash
pnpm install
pnpm build
dsh plugin --profile web add link:/绝对路径/dsh-task-radar
```

`dsh.plugin.add` 会自动把本包写进 profile 的 `dsh.profile.bundles`（由
`cordis.patch.yml` 声明），无需手写挂载行。客户端 HMR（`patchReload: live`）
开启时，重新构建后刷新页面即可看到变化。

卸载：`dsh plugin --profile web remove dsh-task-radar`

## 使用

1. 让两个以上不同工程目录的会话同时运行，雷达按钮即出现在右下角。
2. 按钮配色实时反映各状态会话的比例；出现淡黄扇区 / 脉冲说明有会话在等你确认。
3. 点开按钮查看分组列表，点击任一条直接跳到该会话。
4. 在面板右上角齿轮中开启系统通知 / 提示音、设置是否显示「进行中」分组。
5. 首次开启系统通知时浏览器会请求 Notification 权限；若曾拒绝，需要在浏览器
   站点设置里手动放开。

## 开发

```bash
pnpm install
pnpm dev        # tsdown watch，输出 lib/
pnpm check      # typecheck + 构建 + 离线 smoke 测试
```

发布 / 打 tag 前务必重新构建并提交 `lib/`：

```bash
pnpm build && git add lib && git commit -m "chore: build bundles"
```

## 架构

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | Node 端空插件（纯客户端功能，仅为满足组合入口） |
| `src/client/index.tsx` | 注册 `shell.overlay`（list / root），注入 `slots`、`sessions`、`uiSession` |
| `src/client/derive.ts` | 会话列表 + pending-interaction → 任务分组的纯函数推导 |
| `src/client/notifier.ts` | 标题前缀 / favicon 角标 / WebAudio 提示音 / Notification |
| `src/client/App.tsx` | 边沿检测器 + 可拖动比例着色雷达按钮、消息栏、toast、设置 |
| `src/client/styles.ts` | 一次性注入的命名空间样式（颜色跟随宿主主题变量） |
| `src/client/settings.ts` | localStorage 偏好与按钮位置持久化 |

数据源：框架注入的全局标准 hook `useSessions`（`SessionListState`）与
`useSessionPendingInteraction`（approval / question / plan-review 统一等待信号）。
客户端 bundle 为自包含 CJS，运行时只 require `react` / `react/jsx-runtime`，
不跨包引用任何 `@deepseek-ai/*` 内部模块（宿主类型仅作结构化类型擦除）。

## License

[MIT](./LICENSE)
