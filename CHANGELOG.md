# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 0.2.0

适配 DSH 0.2.0 运行时。DSH 0.2.0 重构了会话状态与导航相关的客户端契约，旧接口被移除，因此本版本**不兼容 DSH 0.1.x**；需要在 DSH 0.2.0 及以上版本中使用（0.1.x 运行时请继续使用 0.1.0）。

### Changed（Breaking · 随 DSH 0.2.0 内核迁移）

- 状态数据源：`useSessionPendingInteraction`（独立的待办 map）→ **`useSessionStatus`** 统一状态快照（`ReadonlyMap<SessionId, SessionStatus>`），等待确认/进行中/完成状态均从该快照推导
- 完成标记：`SessionSummary.completed` → **`SessionStatus.completionUnread`**
- 会话导航：`ctx.sessions.open(id)` → **`ctx.uiWorkspace.openSession(id)`**
- 当前会话：`SessionListState.current` 字段被移除，改读宿主持久化选择（localStorage `dsh.sessions.current`），并以轻量轮询保持当前会话标记同步
- 服务依赖列表新增 `uiWorkspace`

### 说明

- 功能与交互保持不变：跨工程三组消息栏（等待确认 / 进行中 / 处理完成）、标签标题与 favicon 角标、可选系统通知与提示音、可拖动吸附、状态比例锥形着色、明暗主题跟随
- 已通过 TypeScript 类型检查、tsdown 构建与离线冒烟测试（`node scripts/smoke.mjs`）

## 0.1.0

首个公开版本。

- 跨工程会话状态聚合：等待确认 / 进行中 / 处理完成三组消息栏，点击直达对应会话
- 浏览器标签页标题前缀与与 favicon 角标提醒
- 可选项：系统通知（点击通知切换会话）、等待确认提示音
- 可拖动、松手自动吸附左右边缘的雷达按钮，按状态数量比例锥形着色（淡黄/淡蓝/淡绿），位置本地记忆
- 面板样式跟随宿主明暗主题；subagent 会话默认折叠不占位
