# dsh-task-radar

[中文](./README.md) · [Changelog](./CHANGELOG.md)

A DeepSeek Harness (DSH) web client plugin. When you run sessions across **multiple
project directories** in parallel, stop cycling through tabs to check who is waiting
or finished — Task Radar aggregates every top-level session into one draggable radar
button and message rail, and alerts you directly from the browser tab.

## Features

- **Tab alerts**
  - Title prefix: red `(N)` while anything is waiting on you; green `✓ N ·` when
    there are only completions
  - Favicon badge: red / green dot with the count
  - Optional browser system notifications (click a notification to jump to that
    session) and a short audible ping while the tab is in the background
- **A draggable radar button** in the `shell.overlay` layer
  - Drag it anywhere; it snaps to the nearest left / right edge on release, and the
    position is remembered in localStorage
  - **Proportional conic colour fill** by session count: pale yellow = waiting,
    pale blue = running, pale green = done
    - all done → solid pale green; all running → solid pale blue
    - mixed (e.g. half running, half done) → sectors proportional to the counts,
      separated by thin gaps
    - any waiting session triggers an amber pulse ring (highest priority)
  - A slow radar sweep animation; the corner badge shows the top-priority count
    (waiting > done > running)
  - The message panel pops out next to the button wherever it is docked (opens
    downward near the top of the screen)
- **Grouped message rail**
  - ⏳ **Waiting**: tool-permission approval / `ask_user_question` / plan review
    (from the host pending-interaction map)
  - 🔄 **Running** (can be hidden in settings)
  - ✅ **Done** (from the host completion reminder; a current session finishing in
    the background is tracked locally)
  - Each row shows the session title, project directory (cwd basename) and a
    relative timestamp
- **Click any row to switch straight to that session** (`sessions.open`)

Nested subagent rows are intentionally hidden so multi-agent teams do not flood the
rail. All preferences and the button position live in the browser's localStorage;
nothing is uploaded anywhere.

## Requirements

- DSH `@deepseek-ai/dsh` ≥ `0.1.5-rc.1`
- The web client (`dsh web`)
- Node.js ≥ 20 (only needed when building from source)

## Install

> Replace `<your-name>/dsh-task-radar` with the actual GitHub path.

**Option A — from GitHub (recommended, no build step)**

The built bundles under `lib/` are committed to the repo, so a git install runs no
prepare script and never trips over pnpm's `allowBuilds` gate:

```bash
dsh plugin --profile web add github:<your-name>/dsh-task-radar
```

Pin a tag if you like: `github:<your-name>/dsh-task-radar#v0.1.0`.
Then restart DSH (or refresh the web page) — the radar button appears at the
bottom-right.

**Option B — one-line scripts**

```bash
# macOS / Linux / Windows (Git Bash)
bash scripts/install.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

**Option C — npm (once published)**

```bash
dsh plugin --profile web add dsh-task-radar
```

**Option D — local development (link)**

```bash
pnpm install
pnpm build
dsh plugin --profile web add link:/absolute/path/dsh-task-radar
```

`dsh plugin add` reconciles the package into the profile's `dsh.profile.bundles`
(declared via `cordis.patch.yml`) — no manual mount line is needed. With client HMR
(`patchReload: live`), rebuild and refresh the page to see changes.

Uninstall: `dsh plugin --profile web remove dsh-task-radar`

## Usage

1. Run sessions in two or more project directories; the radar button appears
   bottom-right.
2. The fill reflects the live status mix. A yellow sector / pulse means a session is
   blocked on you.
3. Open the button for the grouped rail; click any row to jump to that session.
4. Use the gear icon to enable system notifications / sound and toggle the Running
   group.
5. Enabling system notifications triggers the browser permission prompt; if it was
   previously denied, re-enable it in the browser's site settings.

## Development

```bash
pnpm install
pnpm dev        # tsdown watch, emits lib/
pnpm check      # typecheck + build + offline smoke test
```

Always rebuild and commit `lib/` before publishing or tagging:

```bash
pnpm build && git add lib && git commit -m "chore: build bundles"
```

## Architecture

| File | Responsibility |
| --- | --- |
| `src/index.ts` | No-op Node plugin (client-only feature; fulfils the combo entry) |
| `src/client/index.tsx` | Registers `shell.overlay` (list / root); injects `slots`, `sessions`, `uiSession` |
| `src/client/derive.ts` | Pure derivation: session list + pending-interaction map → status groups |
| `src/client/notifier.ts` | Title prefix / favicon badge / WebAudio ping / Notification |
| `src/client/App.tsx` | Edge detector, draggable proportional radar button, rail, toasts, settings |
| `src/client/styles.ts` | Injected namespaced stylesheet (colours follow host theme variables) |
| `src/client/settings.ts` | localStorage prefs and button-position persistence |

Data comes from framework-injected global standard hooks: `useSessions`
(`SessionListState`) and `useSessionPendingInteraction` (unified
approval / question / plan-review signals). The client bundle is self-contained CJS
that only requires `react` / `react/jsx-runtime` at runtime — no cross-package
`@deepseek-ai/*` imports (host types are used structurally and erased).

## License

[MIT](./LICENSE)
