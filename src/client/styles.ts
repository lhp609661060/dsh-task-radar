/**
 * Plugin styles injected once as a scoped stylesheet. Everything is namespaced
 * under `.dsh-task-radar` so selectors can never collide with the host.
 * Colours follow the host theme variables with safe fallbacks.
 */
export const CSS = `
.dsh-task-radar {
  /* Status colours follow the host theme (light + dark) with safe fallbacks. */
  --tr-attention: var(--dsw-alias-state-error-primary, #d83a3a);
  --tr-running: var(--dsw-alias-state-business-primary, #316fdb);
  --tr-done: var(--dsw-alias-state-success-primary, #2ea043);
  /* Elevated surface: white in light theme, dark bluish in dark theme. */
  --tr-surface: var(--dsw-alias-bg-layer-2, #ffffff);
  --tr-border: var(--dsw-alias-border-l3, rgba(0,0,0,0.12));
  --tr-text: var(--dsw-alias-label-primary, #1f2329);
  --tr-text-dim: var(--dsw-alias-label-secondary, #646a73);
  --tr-text-faint: var(--dsw-alias-label-tertiary, #8f959e);
  --tr-shadow: 0 8px 28px rgba(0,0,0,0.16);
  /* Pastel FAB fills, shared by light + dark themes (dark icons on top). */
  --tr-fill-attention: #fdebb3;
  --tr-fill-running: #cfe0fb;
  --tr-fill-done: #cdeccf;
  position: static;
  z-index: 40;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: var(--tr-text);
}
.dsh-task-radar * { box-sizing: border-box; }

/* Toast stack stays anchored bottom-right even when the FAB is dragged away. */
.tr-toast-stack {
  position: fixed;
  right: 16px;
  /* Sit above the FAB's default dock so they never overlap. */
  bottom: 70px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

/* Draggable FAB: top-left corner is the persisted coordinate. */
.tr-fab-anchor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 41;
  pointer-events: none;
}
.tr-fab {
  pointer-events: auto;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--tr-border);
  background: var(--tr-surface);
  color: var(--tr-text);
  box-shadow: var(--tr-shadow);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: transform .12s ease, box-shadow .2s ease;
}
.tr-fab:hover { transform: translateY(-1px); }
.tr-fab:active { cursor: grabbing; }
.tr-fab.dragging {
  cursor: grabbing;
  transition: none;
  transform: scale(1.06);
  box-shadow: 0 12px 32px rgba(0,0,0,0.28);
}
.tr-fab.dragging, .tr-fab.dragging.has-attention { animation: none; }
.tr-fab.tinted { color: #374151; border-color: rgba(0,0,0,0.10); }
.tr-fab svg { width: 22px; height: 22px; }
.tr-radar-sweep {
  transform-box: fill-box;
  transform-origin: center;
  animation: tr-sweep 3.2s linear infinite;
}
@keyframes tr-sweep { to { transform: rotate(360deg); } }
.tr-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  color: #fff;
  border: 2px solid #fff;
  pointer-events: none;
}
.tr-fab-badge.attention { background: #b45309; }
.tr-fab-badge.running { background: #2563c9; }
.tr-fab-badge.done { background: #15803d; }
@keyframes tr-pulse {
  0% { box-shadow: 0 0 0 0 rgba(217,160,0,.5); }
  70% { box-shadow: 0 0 0 9px rgba(217,160,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(217,160,0,0); }
}
.tr-fab.has-attention { animation: tr-pulse 1.8s ease-out infinite; }

.tr-panel {
  position: fixed;
  z-index: 42;
  /* Fallback (before mount measurement); JS sets top/left/right next. */
  right: 16px;
  bottom: 70px;
  pointer-events: auto;
  width: 320px;
  max-height: min(460px, 60vh);
  display: flex;
  flex-direction: column;
  background: var(--tr-surface);
  border: 1px solid var(--tr-border);
  border-radius: 12px;
  box-shadow: var(--tr-shadow);
  overflow: hidden;
}
.tr-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--tr-border);
  flex: none;
}
.tr-title { font-size: 13px; font-weight: 600; }
.tr-spacer { flex: 1; }
.tr-iconbtn {
  border: none; background: transparent; color: var(--tr-text-dim);
  width: 26px; height: 26px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.tr-iconbtn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08)); color: var(--tr-text); }
.tr-iconbtn svg { width: 15px; height: 15px; }
.tr-list { overflow-y: auto; padding: 4px 0; flex: 1; min-height: 0; }
.tr-group-label {
  padding: 8px 12px 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .03em;
  color: var(--tr-text-faint);
  text-transform: uppercase;
}
.tr-item {
  width: 100%;
  display: flex; align-items: flex-start; gap: 9px;
  padding: 7px 12px;
  border: none; background: transparent; text-align: left;
  cursor: pointer; color: inherit;
}
.tr-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.07)); }
.tr-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; flex: none; }
.tr-dot.attention { background: var(--tr-attention); }
.tr-dot.done { background: var(--tr-done); }
.tr-dot.running { background: var(--tr-running); }
.tr-item-main { min-width: 0; flex: 1; }
.tr-item-title {
  font-size: 13px; line-height: 1.35;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tr-item-meta {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--tr-text-dim); margin-top: 2px;
}
.tr-project {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 150px;
}
.tr-status-label { flex: none; font-weight: 600; }
.tr-status-label.attention { color: var(--tr-attention); }
.tr-status-label.done { color: var(--tr-done); }
.tr-status-label.running { color: var(--tr-running); }
.tr-spin { animation: tr-rotate 1s linear infinite; }
@keyframes tr-rotate { to { transform: rotate(360deg); } }
.tr-empty { padding: 22px 14px; text-align: center; font-size: 12px; color: var(--tr-text-faint); }

.tr-settings {
  border-top: 1px solid var(--tr-border);
  padding: 6px 12px 8px;
  flex: none;
}
.tr-setting-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0; font-size: 12px; color: var(--tr-text-dim);
  cursor: pointer;
}
.tr-setting-row input { accent-color: var(--tr-running); cursor: pointer; }
.tr-setting-hint { font-size: 11px; color: var(--tr-text-faint); padding: 2px 0 4px; }
.tr-toast {
  pointer-events: auto;
  background: var(--tr-surface);
  border: 1px solid var(--tr-border);
  border-left: 3px solid var(--tr-attention);
  border-radius: 10px;
  box-shadow: var(--tr-shadow);
  padding: 9px 13px;
  width: 320px;
  font-size: 12.5px;
  cursor: pointer;
}
.tr-toast.done { border-left-color: var(--tr-done); }
.tr-toast-title { font-weight: 600; font-size: 12.5px; margin-bottom: 2px; }
.tr-toast-sub { color: var(--tr-text-dim); font-size: 11.5px; }
`

const STYLE_TAG_ID = 'dsh-task-radar-styles'

let injected = false

export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return
  if (document.getElementById(STYLE_TAG_ID) !== null) {
    injected = true
    return
  }
  const tag = document.createElement('style')
  tag.id = STYLE_TAG_ID
  tag.dataset.plugin = 'dsh-task-radar'
  tag.textContent = CSS
  document.head.appendChild(tag)
  injected = true
}
