<div align="center">

# 🛰️ dsh-task-radar

**Cross-project task status radar & alerts for the DeepSeek Harness (DSH) web client**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform: DSH web](https://img.shields.io/badge/platform-DSH%20web-316fdb)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![Requires DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.0--rc.1-2ea043)](https://www.npmjs.com/package/@deepseek-ai/dsh)

[中文](./README.md) · [Changelog](./CHANGELOG.md) · [Issues](https://github.com/lhp609661060/dsh-task-radar/issues)

</div>

<!-- Screenshot: drop an image into docs/ and replace this block, e.g.
![Task Radar](docs/screenshot.png)
-->

When you run sessions across **multiple project directories** in DSH, their status
is scattered across conversations and you have to switch tabs to check it. Task
Radar aggregates every session into one **draggable radar button** and a message
rail: see at a glance who is waiting on you, who is running and who has finished,
click to jump straight there — and stay alerted via the tab title, favicon and OS
notifications even when the browser is on another tab.

## ✨ Features

### Browser-tab alerts

- **Title prefix**: red `(N)` while anything is waiting on you; green `✓ N ·` when
  there are only completions
- **Favicon badge**: red / green dot with the count — read the state without
  switching tabs
- **System notifications & sound** (opt-in, off by default): browser notifications
  while the tab is in the background, click one to jump to that session; an optional
  ping when something starts waiting

### Draggable radar button

- Drag it anywhere on screen; it **snaps to the nearest left / right edge** on
  release, and the position is remembered locally
- **Proportional conic fill** by session count for an instant progress read:

| Colour | Meaning |
| :---: | --- |
| 🟡 Pale yellow | Waiting (tool approval / question / plan review) |
| 🔵 Pale blue | Running |
| 🟢 Pale green | Done |

  - all done → solid pale green; all running → solid pale blue
  - mixed (e.g. half running, half done) → sectors proportional to counts, divided
    by thin gaps
  - any waiting session adds an amber pulse ring — highest priority, never drowned
    out
- A slow radar sweep animation; the corner badge shows the top-priority count
  (waiting > done > running)
- The message panel anchors to the button wherever it is docked (it flips to open
  downward near the top of the screen)

### Grouped message rail

- ⏳ **Waiting**: tool-permission approvals, `ask_user_question` prompts, plan
  reviews (from `useSessionStatus.pendingInteraction`)
- 🔵 **Running** (can be hidden in settings)
- 🟢 **Done** (`useSessionStatus.completionUnread`; a currently-selected session
  finishing in the background is tracked locally)
- Each row shows the session title, project directory (cwd basename) and a relative
  timestamp
- **Click any row to switch straight to that session** (`uiWorkspace.openSession`)

Nested subagent rows are hidden on purpose, so multi-agent teams never flood the
rail. All preferences and the button position live only in the browser's
localStorage — **nothing is collected or uploaded**.

## 📦 Requirements

- [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh)
  `@deepseek-ai/dsh` ≥ `0.2.0-rc.1` (0.2.0 line; plugin v0.1.0 targets DSH 0.1.x)
- The DSH **web client** (`dsh web`); desktop / CLI-only setups are not supported
- Node.js ≥ 20 (only needed when building from source)

## Install

### Option A — from GitHub (recommended)

The built bundles under `lib/` are committed to this repo, so a git install runs
**no build script** and never trips over pnpm's `allowBuilds` gate:

```bash
dsh plugin --profile web add github:lhp609661060/dsh-task-radar
```

Pin a tag to lock a version:

```bash
dsh plugin --profile web add github:lhp609661060/dsh-task-radar#v0.2.0
```

Then restart DSH or simply refresh the web page — the radar button appears
bottom-right.

### Option B — one-line scripts

```bash
# macOS / Linux / Windows (Git Bash)
bash scripts/install.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

### Option C — npm (once published)

```bash
dsh plugin --profile web add dsh-task-radar
```

### Option D — local development (link)

```bash
pnpm install
pnpm build
dsh plugin --profile web add link:/absolute/path/dsh-task-radar
```

> `dsh plugin add` reconciles the package into the profile's
> `dsh.profile.bundles` from the bundled `cordis.patch.yml` — no manual mount line
> is needed. During development, client HMR (`patchReload: live`) picks up rebuilds
> on page refresh.

**Uninstall:**

```bash
dsh plugin --profile web remove dsh-task-radar
```

## 🚀 Usage

1. Run sessions in two or more project directories; the radar button appears at the
   bottom-right.
2. The fill reflects the live status mix; a yellow sector or pulse means a session
   is blocked on you.
3. Click the button for the grouped rail; click any row to jump to that session.
4. The gear icon toggles system notifications, the waiting ping and the Running
   group.
5. Enabling system notifications triggers the browser permission prompt; if it was
   denied earlier, re-enable it in the browser's site settings.
6. To reset the button position, run
   `localStorage.removeItem('dsh-task-radar:fab-pos:v1')` in the page console and
   refresh.

## 🛠️ Development

```bash
pnpm install
pnpm dev        # tsdown watch, emits lib/
pnpm check      # typecheck + build + offline smoke test
```

The client bundle must stay pure (only `react` / `react/jsx-runtime` may be
required at runtime); host capabilities are reached via framework-injected global
standard hooks and cordis services, and `scripts/smoke.mjs` enforces this.

Always rebuild and commit `lib/` before tagging a release (git installs consume
the committed bundles directly):

```bash
pnpm build && git add lib && git commit -m "chore: build bundles"
```

## 🧩 Architecture

| File | Responsibility |
| --- | --- |
| `src/index.ts` | No-op Node plugin (client-only feature; fulfils the combo entry) |
| `src/client/index.tsx` | Registers `shell.overlay` (list / root); injects `slots`, `sessions`, `uiSession`, `uiWorkspace` |
| `src/client/derive.ts` | Pure derivation: session list + useSessionStatus snapshot → status groups (unit-testable) |
| `src/client/notifier.ts` | Title prefix / favicon badge / WebAudio ping / Notification |
| `src/client/App.tsx` | Edge detector, draggable proportional radar button, rail, toasts, settings |
| `src/client/styles.ts` | Injected namespaced stylesheet; colours follow host theme variables |
| `src/client/settings.ts` | localStorage prefs and button-position persistence |

**Data sources:**

- `useSessions` (`SessionListState`): every session and its project directory
- `useSessionStatus` (`SessionStatusSnapshot`): per-session `running` /
  `pendingInteraction` (unified approval / question / plan-review waiting signals) /
  `completionUnread`
- Current session id: the host's persisted selection (localStorage `dsh.sessions.current`)
- `uiWorkspace.openSession(id)`: switch conversation on click

## 📄 License

[MIT](./LICENSE)
