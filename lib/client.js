window.__ModuleLoader__.load({ id: "dsh-task-radar", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");

//#region src/client/derive.ts
/** Visible pending kinds (host may later add other kinds — ignore unknown). */
const VISIBLE_KINDS = /* @__PURE__ */ new Set([
	"approval",
	"question",
	"plan-review"
]);
function basename(path) {
	const parts = path.split(/[/\\]/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}
/**
* Effective status of one session.
* Precedence matches the host's own sessionStatuses(): a blocked agent
* (waiting on the user) outranks everything, then live activity, then the
* completion reminder, then idle.
*/
function statusOf(summary, pendingKind) {
	if (pendingKind !== void 0 && VISIBLE_KINDS.has(pendingKind)) return "attention";
	if (summary.running) return "running";
	if (summary.completed === true) return "done";
	return "idle";
}
/**
* Build the radar view. Blank sessions (never-used New Session drafts),
* subagent rows and idle sessions are excluded from the rail; aggregate
* counts include only the displayed rows.
*
* @param extraDoneIds - client-local completion set. The host only sets
* `summary.completed` for sessions that finished WHILE non-selected; a session
* the user is currently running and switches away from mid-turn goes idle
* without a host reminder, so the controller records it locally.
*/
function deriveRadar(list, pending, extraDoneIds) {
	const attention = [];
	const done = [];
	const running = [];
	const items = [];
	for (const id of list.ids) {
		const s = list.byId[id];
		if (s === void 0) continue;
		if (s.blank) continue;
		if (s.origin === "subagent" || s.parentId !== void 0) continue;
		const interaction = pending.get(id);
		const waiting = interaction !== void 0 && VISIBLE_KINDS.has(interaction.kind) ? interaction.kind : void 0;
		const status = statusOf(s, waiting) === "idle" && extraDoneIds !== void 0 && extraDoneIds.has(id) ? "done" : statusOf(s, waiting);
		if (status === "idle") continue;
		const item = {
			id,
			title: s.displayTitle || s.title || id.slice(0, 8),
			project: s.cwd !== void 0 && s.cwd !== "" ? basename(s.cwd) : "",
			cwd: s.cwd,
			status,
			waiting,
			current: list.current === id,
			updatedAt: s.updatedAt
		};
		items.push(item);
		if (status === "attention") attention.push(item);
		else if (status === "done") done.push(item);
		else running.push(item);
	}
	const byTime = (a, b) => b.updatedAt - a.updatedAt;
	attention.sort(byTime);
	done.sort(byTime);
	running.sort(byTime);
	return {
		items,
		attention,
		done,
		running,
		counts: {
			attention: attention.length,
			done: done.length,
			running: running.length
		},
		current: list.current
	};
}

//#endregion
//#region src/client/settings.ts
/**
* Browser-local preferences for Task Radar. The host offers a settings
* persistence seam, but a client-only plugin talking to localStorage keeps the
* package dependency-free; keys are namespaced and prefs are per-browser.
*/
const KEY = "dsh-task-radar:prefs:v1";
const POS_KEY = "dsh-task-radar:fab-pos:v1";
function loadFabPos() {
	try {
		const raw = localStorage.getItem(POS_KEY);
		if (raw === null) return null;
		const p = JSON.parse(raw);
		if (typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
		return {
			x: p.x,
			y: p.y
		};
	} catch {
		return null;
	}
}
function saveFabPos(pos) {
	try {
		localStorage.setItem(POS_KEY, JSON.stringify(pos));
	} catch {}
}
const DEFAULTS = {
	systemNotifications: false,
	sound: false,
	showRunning: true
};
function loadPrefs() {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === null) return { ...DEFAULTS };
		return {
			...DEFAULTS,
			...JSON.parse(raw)
		};
	} catch {
		return { ...DEFAULTS };
	}
}
function savePrefs(prefs) {
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {}
}

//#endregion
//#region src/client/notifier.ts
/**
* Compose the document title. The host's DocumentTitle continuously writes
* `<session> — <product>` (or the bare product title), so rather than fight
* it we observe its writes through a title-patching layer: after each host
* write we re-prefix while alerts exist. A MutationObserver catches writes
* we did not originate.
*/
var TitleBadge = class {
	prefix = "";
	observer;
	lastWritten = "";
	start() {
		if (typeof document === "undefined") return;
		this.observer = new MutationObserver(() => {
			if (document.title !== this.lastWritten) this.apply();
		});
		this.observer.observe(document.querySelector("head") ?? document.head, {
			subtree: true,
			childList: true,
			characterData: true
		});
		this.apply();
	}
	setCounts(counts) {
		const total = counts.attention + counts.done;
		this.prefix = total === 0 ? "" : counts.attention > 0 ? `(${counts.attention}) ` : `✓ ${total} · `;
		this.apply();
	}
	/** Strip our prefix off a title the host wrote. */
	baseTitle() {
		let t = document.title;
		t = t.replace(/^\(\d+\)\s*/, "");
		t = t.replace(/^✓ \d+ ·\s*/, "");
		return t;
	}
	apply() {
		if (typeof document === "undefined") return;
		const base = this.baseTitle();
		const next = this.prefix === "" ? base : this.prefix + base;
		if (next !== document.title) {
			this.lastWritten = next;
			document.title = next;
		}
	}
	stop() {
		this.observer?.disconnect();
		this.observer = void 0;
		this.prefix = "";
	}
};
/**
* Draw a small coloured dot badge over the existing favicon by rendering the
* favicon image onto a canvas and emitting a data URL. When the site has no
* usable favicon, emit a standalone round badge.
*/
var FaviconBadge = class {
	originalHref = null;
	originalLink = null;
	link = null;
	start() {
		if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") return;
		const existing = document.querySelector("link[rel~=\"icon\"]");
		this.originalLink = existing;
		this.originalHref = existing?.getAttribute("href") ?? null;
	}
	setCounts(counts) {
		if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") return;
		const total = counts.attention + counts.done;
		if (total === 0) {
			this.restore();
			return;
		}
		const colour = counts.attention > 0 ? "#d83a3a" : "#2ea043";
		this.render(colour, Math.min(total, 99)).catch(() => this.restore());
	}
	ensureLink() {
		if (this.link !== null) return this.link;
		const link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
		this.link = link;
		return link;
	}
	async render(colour, n) {
		const size = 64;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (ctx === null) return;
		if (this.originalHref !== null) try {
			const img = await loadImage(this.originalHref);
			ctx.drawImage(img, 0, 0, size, size);
		} catch {}
		const r = 20;
		const cx = size - r - 4;
		const cy = size - r - 4;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fillStyle = colour;
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.strokeStyle = "#ffffff";
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 24px -apple-system, system-ui, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(n), cx, 41);
		this.ensureLink().href = canvas.toDataURL("image/png");
	}
	restore() {
		if (this.link !== null) {
			this.link.remove();
			this.link = null;
		}
		if (this.originalLink !== null && this.originalHref !== null) this.originalLink.setAttribute("href", this.originalHref);
	}
	stop() {
		this.restore();
	}
};
function loadImage(href) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = href;
	});
}
let audioCtx;
function getAudio() {
	const Ctor = window.AudioContext ?? window.webkitAudioContext;
	if (Ctor === void 0) return void 0;
	if (audioCtx === void 0) try {
		audioCtx = new Ctor();
	} catch {
		return;
	}
	return audioCtx;
}
/** A short, gentle two-note chime generated with the WebAudio API (no assets). */
function playPing() {
	if (typeof window === "undefined") return;
	const ctx = getAudio();
	if (ctx === void 0) return;
	ctx.resume().then(() => {
		const now = ctx.currentTime;
		const notes = [[880, now], [1174.7, now + .12]];
		for (const [freq, start] of notes) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(.08, start + .015);
			gain.gain.exponentialRampToValueAtTime(1e-4, start + .22);
			osc.connect(gain).connect(ctx.destination);
			osc.start(start);
			osc.stop(start + .24);
		}
	});
}
function notificationSupported() {
	return typeof window !== "undefined" && "Notification" in window;
}
function notificationPermission() {
	if (!notificationSupported()) return "unsupported";
	return Notification.permission;
}
async function requestNotificationPermission() {
	if (!notificationSupported()) return false;
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;
	return await Notification.requestPermission() === "granted";
}
function showOsNotification(input) {
	if (!notificationSupported() || Notification.permission !== "granted") return;
	let n;
	try {
		n = new Notification(input.title, {
			body: input.body,
			tag: "dsh-task-radar",
			silent: false
		});
	} catch {
		return;
	}
	n.onclick = () => {
		window.focus();
		input.onClick();
		n.close();
	};
}

//#endregion
//#region src/client/styles.ts
/**
* Plugin styles injected once as a scoped stylesheet. Everything is namespaced
* under `.dsh-task-radar` so selectors can never collide with the host.
* Colours follow the host theme variables with safe fallbacks.
*/
const CSS = `
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
`;
const STYLE_TAG_ID = "dsh-task-radar-styles";
let injected = false;
function injectStyles() {
	if (injected || typeof document === "undefined") return;
	if (document.getElementById(STYLE_TAG_ID) !== null) {
		injected = true;
		return;
	}
	const tag = document.createElement("style");
	tag.id = STYLE_TAG_ID;
	tag.dataset.plugin = "dsh-task-radar";
	tag.textContent = CSS;
	document.head.appendChild(tag);
	injected = true;
}

//#endregion
//#region src/client/App.tsx
/**
* Task Radar root UI, mounted once in the host's `shell.overlay` slot.
*
* A root-scope slot component receives the framework's global standard hooks
* as props (`useSessions`, `useSessionPendingInteraction`) — see
* dsh-client-ui-session's GlobalStandardProps merge. The component:
*  - derives one cross-workspace task view (deriveRadar),
*  - runs the edge detector that fires OS notifications / pings / toasts when
*    a session starts waiting or finishes while the tab is hidden,
*  - drives the tab title prefix and favicon badge,
*  - renders the bell FAB, the message rail (等待确认 / 进行中 / 处理完成) and
*    transient in-page toasts.
*/
function IconRadar() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "9",
				opacity: "0.55"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "4.5",
				opacity: "0.55"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
				className: "tr-radar-sweep",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M12 12 L12 3",
					strokeWidth: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "6.6",
					r: "1.4",
					fill: "currentColor",
					stroke: "none"
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "1.2",
				fill: "currentColor",
				stroke: "none"
			})
		]
	});
}
function IconSpinner() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		className: "tr-spin",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2.5",
		strokeLinecap: "round",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-6.2-8.56" })
	});
}
function IconCheck() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2.5",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" })
	});
}
function IconClose() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18M6 6l12 12" })
	});
}
function IconGear() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": true,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "12",
			r: "3"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.78 1.04 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })]
	});
}
const STATUS_TEXT = {
	attention: "等待确认",
	running: "进行中",
	done: "处理完成",
	idle: "空闲"
};
const WAITING_TEXT = {
	approval: "等待权限确认",
	question: "等待回答",
	"plan-review": "等待计划批准"
};
function timeLabel(ts, now) {
	const diff = Math.max(0, now - ts);
	const m = Math.floor(diff / 6e4);
	if (m < 1) return "刚刚";
	if (m < 60) return `${m} 分钟前`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} 小时前`;
	return `${Math.floor(h / 24)} 天前`;
}
const FAB_SIZE = 42;
const VIEWPORT_MARGIN = 12;
const DRAG_THRESHOLD = 5;
function defaultFabPos(vw, vh) {
	return {
		x: vw - VIEWPORT_MARGIN - FAB_SIZE,
		y: vh - VIEWPORT_MARGIN - FAB_SIZE
	};
}
function clampPos(x, y, vw, vh) {
	const maxX = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - FAB_SIZE);
	const maxY = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - FAB_SIZE);
	return {
		x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
		y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY)
	};
}
/** Snap to the nearest horizontal edge on release. */
function snapPos(pos, vw) {
	const leftDist = pos.x - VIEWPORT_MARGIN;
	return vw - VIEWPORT_MARGIN - FAB_SIZE - pos.x < leftDist ? {
		x: vw - VIEWPORT_MARGIN - FAB_SIZE,
		y: pos.y
	} : {
		x: VIEWPORT_MARGIN,
		y: pos.y
	};
}
const FILL_VAR = {
	attention: "var(--tr-fill-attention)",
	running: "var(--tr-fill-running)",
	done: "var(--tr-fill-done)"
};
/**
* Conic gradient segmented by the proportion of sessions in each status.
* Attention (waiting) is pale yellow, running is pale blue, done is pale green.
* Thin base-colour gaps separate segments so adjacent colours stay readable.
*/
function fabBackground(counts) {
	const segments = [
		{
			kind: "attention",
			n: counts.attention
		},
		{
			kind: "running",
			n: counts.running
		},
		{
			kind: "done",
			n: counts.done
		}
	].filter((s) => s.n > 0);
	const total = segments.reduce((a, s) => a + s.n, 0);
	if (total === 0) return "var(--tr-surface)";
	if (segments.length === 1) return FILL_VAR[segments[0].kind];
	const gap = segments.length === 2 ? 3 : 2.2;
	const usable = 360 - gap * segments.length;
	const parts = [];
	let cursor = 0;
	for (const s of segments) {
		const span = s.n / total * usable;
		parts.push(`${FILL_VAR[s.kind]} ${cursor.toFixed(2)}deg ${(cursor + span).toFixed(2)}deg`);
		cursor += span + gap;
	}
	return `conic-gradient(from -90deg, ${parts.join(", ")})`;
}
function RadarOverlay({ useSessions, useSessionPendingInteraction, openSession }) {
	const list = useSessions((s) => s);
	const pending = useSessionPendingInteraction((m) => m);
	const [prefs, setPrefs] = (0, react.useState)(() => loadPrefs());
	const [panelOpen, setPanelOpen] = (0, react.useState)(false);
	const [settingsOpen, setSettingsOpen] = (0, react.useState)(false);
	const [localDone, setLocalDone] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	const [toasts, setToasts] = (0, react.useState)([]);
	const [, forceTick] = (0, react.useState)(0);
	const [viewport, setViewport] = (0, react.useState)(() => typeof window === "undefined" || window.innerWidth === void 0 ? {
		w: 1280,
		h: 800
	} : {
		w: window.innerWidth,
		h: window.innerHeight
	});
	const [fabPos, setFabPos] = (0, react.useState)(() => typeof window === "undefined" ? null : loadFabPos());
	const [dragging, setDragging] = (0, react.useState)(false);
	const dragRef = (0, react.useRef)(null);
	const suppressClickRef = (0, react.useRef)(false);
	const fabRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		function onResize() {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			setViewport({
				w: vw,
				h: vh
			});
			setFabPos((p) => clampPos(p?.x ?? vw - VIEWPORT_MARGIN - FAB_SIZE, p?.y ?? vh - VIEWPORT_MARGIN - FAB_SIZE, vw, vh));
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	function onFabPointerDown(e) {
		if (e.button !== 0) return;
		suppressClickRef.current = false;
		dragRef.current = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			originX: fabPos?.x ?? defaultFabPos(viewport.w, viewport.h).x,
			originY: fabPos?.y ?? defaultFabPos(viewport.w, viewport.h).y,
			moved: false
		};
	}
	function onFabPointerMove(e) {
		const d = dragRef.current;
		if (d === null || e.pointerId !== d.pointerId) return;
		const dx = e.clientX - d.startX;
		const dy = e.clientY - d.startY;
		if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		if (!d.moved) {
			d.moved = true;
			setDragging(true);
			try {
				fabRef.current?.setPointerCapture(e.pointerId);
			} catch {}
		}
		setFabPos(clampPos(d.originX + dx, d.originY + dy, viewport.w, viewport.h));
	}
	function endDrag(e) {
		const d = dragRef.current;
		if (d === null || e.pointerId !== d.pointerId) return;
		dragRef.current = null;
		if (!d.moved) return;
		try {
			fabRef.current?.releasePointerCapture(e.pointerId);
		} catch {}
		suppressClickRef.current = true;
		setDragging(false);
		setFabPos((p) => {
			if (p === null) return p;
			const snapped = snapPos(p, viewport.w);
			saveFabPos(snapped);
			return snapped;
		});
	}
	function onFabClick() {
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}
		setPanelOpen((v) => !v);
		setSettingsOpen(false);
	}
	(0, react.useEffect)(() => {
		const t = setInterval(() => forceTick((n) => n + 1), 6e4);
		return () => clearInterval(t);
	}, []);
	const radar = (0, react.useMemo)(() => deriveRadar(list, pending, localDone), [
		list,
		pending,
		localDone
	]);
	const currentId = list.current;
	const channels = (0, react.useRef)(void 0);
	if (channels.current === void 0 && typeof window !== "undefined") channels.current = {
		title: new TitleBadge(),
		favicon: new FaviconBadge()
	};
	(0, react.useEffect)(() => {
		injectStyles();
		const c = channels.current;
		c?.title.start();
		c?.favicon.start();
		return () => {
			c?.title.stop();
			c?.favicon.stop();
		};
	}, []);
	const prevStatus = (0, react.useRef)(/* @__PURE__ */ new Map());
	const prevCurrent = (0, react.useRef)(void 0);
	const toastSeq = (0, react.useRef)(0);
	const radarRef = (0, react.useRef)(radar);
	radarRef.current = radar;
	const prefsRef = (0, react.useRef)(prefs);
	prefsRef.current = prefs;
	(0, react.useEffect)(() => {
		const statusOfId = /* @__PURE__ */ new Map();
		for (const id of list.ids) {
			const s = list.byId[id];
			if (s === void 0 || s.blank || s.origin === "subagent" || s.parentId !== void 0) continue;
			const item = radar.items.find((it) => it.id === id);
			statusOfId.set(id, item?.status ?? "idle");
		}
		const hidden = typeof document !== "undefined" && document.hidden;
		const nextLocalDone = new Set(localDone);
		let localDoneChanged = false;
		const newToasts = [];
		let fireAttention = false;
		let fireDone = false;
		for (const [id, status] of statusOfId) {
			if (nextLocalDone.has(id) && (id === currentId || status === "running" || status === "attention")) {
				nextLocalDone.delete(id);
				localDoneChanged = true;
			}
			const prev = prevStatus.current.get(id);
			if (prev === void 0) {
				prevStatus.current.set(id, status);
				continue;
			}
			if (prev === status) continue;
			prevStatus.current.set(id, status);
			if (status === "attention") {
				if (hidden) fireAttention = true;
				newToasts.push(makeToast(id, status));
			} else if (status === "done" && (hidden || id !== currentId)) {
				if (hidden) fireDone = true;
				newToasts.push(makeToast(id, status));
				if (hidden && id === currentId && !nextLocalDone.has(id)) {
					nextLocalDone.add(id);
					localDoneChanged = true;
				}
			} else if (status === "running" && nextLocalDone.has(id)) {
				nextLocalDone.delete(id);
				localDoneChanged = true;
			}
		}
		for (const id of [...prevStatus.current.keys()]) if (!statusOfId.has(id)) prevStatus.current.delete(id);
		if (localDoneChanged) setLocalDone(nextLocalDone);
		if (newToasts.length > 0) {
			setToasts((old) => [...old, ...newToasts].slice(-4));
			for (const t of newToasts) scheduleToastDismiss(t.id);
		}
		if (hidden && fireAttention) {
			const item = radar.attention[radar.attention.length - 1];
			if (item !== void 0) {
				if (prefsRef.current.sound) playPing();
				if (prefsRef.current.systemNotifications) showOsNotification({
					title: `等待确认 · ${item.title}`,
					body: item.project !== "" ? `${item.project} — ${WAITING_TEXT[item.waiting ?? ""] ?? STATUS_TEXT.attention}` : WAITING_TEXT[item.waiting ?? ""] ?? STATUS_TEXT.attention,
					onClick: () => openSession(item.id)
				});
			}
		} else if (hidden && fireDone) {
			const item = radar.done[radar.done.length - 1];
			if (item !== void 0 && prefsRef.current.systemNotifications) showOsNotification({
				title: `处理完成 · ${item.title}`,
				body: item.project !== "" ? item.project : STATUS_TEXT.done,
				onClick: () => openSession(item.id)
			});
		}
		prevCurrent.current = currentId;
		function makeToast(id, status) {
			const it = radarRef.current.items.find((x) => x.id === id);
			toastSeq.current += 1;
			return {
				id: toastSeq.current,
				sessionId: id,
				status,
				title: it?.title ?? id.slice(0, 8),
				detail: status === "attention" ? WAITING_TEXT[it?.waiting ?? ""] ?? STATUS_TEXT.attention : STATUS_TEXT.done
			};
		}
		function scheduleToastDismiss(id) {
			setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 6e3);
		}
	}, [radar, currentId]);
	(0, react.useEffect)(() => {
		const c = channels.current;
		c?.title.setCounts({
			attention: radar.counts.attention,
			done: radar.counts.done
		});
		c?.favicon.setCounts({
			attention: radar.counts.attention,
			done: radar.counts.done
		});
	}, [radar.counts.attention, radar.counts.done]);
	function updatePrefs(patch) {
		setPrefs((p) => {
			const next = {
				...p,
				...patch
			};
			savePrefs(next);
			return next;
		});
	}
	async function toggleSystemNotifications(enabled) {
		if (!enabled) {
			updatePrefs({ systemNotifications: false });
			return;
		}
		updatePrefs({ systemNotifications: await requestNotificationPermission() });
	}
	const counts = radar.counts;
	const total = counts.attention + counts.done + counts.running;
	const fabBadge = counts.attention > 0 ? {
		kind: "attention",
		n: counts.attention
	} : counts.done > 0 ? {
		kind: "done",
		n: counts.done
	} : counts.running > 0 ? {
		kind: "running",
		n: counts.running
	} : void 0;
	const now = Date.now();
	const visible = total > 0 || panelOpen;
	const fabFill = fabBackground(counts);
	const effectivePos = fabPos ?? defaultFabPos(viewport.w, viewport.h);
	const openUpward = effectivePos.y > 200;
	const dockedLeft = effectivePos.x < viewport.w / 2;
	const panelStyle = openUpward ? {
		left: dockedLeft ? effectivePos.x : void 0,
		right: dockedLeft ? void 0 : viewport.w - effectivePos.x - FAB_SIZE,
		bottom: viewport.h - effectivePos.y + 10
	} : {
		left: dockedLeft ? effectivePos.x : void 0,
		right: dockedLeft ? void 0 : viewport.w - effectivePos.x - FAB_SIZE,
		top: effectivePos.y + FAB_SIZE + 10
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsh-task-radar",
		"data-open": panelOpen ? "true" : "false",
		children: [
			toasts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "tr-toast-stack",
				children: toasts.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `tr-toast ${t.status === "attention" ? "" : "done"}`,
					onClick: () => {
						openSession(t.sessionId);
						setToasts((old) => old.filter((x) => x.id !== t.id));
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "tr-toast-title",
						children: [t.status === "attention" ? "⏳ " : "✅ ", t.title]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "tr-toast-sub",
						children: t.detail
					})]
				}, t.id))
			}),
			panelOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "tr-panel",
				style: panelStyle,
				role: "dialog",
				"aria-label": "任务雷达",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "tr-header",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "tr-title",
							children: "任务雷达"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "tr-spacer" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "tr-iconbtn",
							title: "设置",
							"aria-label": "设置",
							onClick: () => setSettingsOpen((v) => !v),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGear, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "tr-iconbtn",
							title: "收起",
							"aria-label": "收起",
							onClick: () => setPanelOpen(false),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, {})
						})
					]
				}), settingsOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsBody, {
					prefs,
					onToggleSound: (v) => updatePrefs({ sound: v }),
					onToggleSystem: toggleSystemNotifications,
					onToggleRunning: (v) => updatePrefs({ showRunning: v })
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "tr-list",
					children: [
						total === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "tr-empty",
							children: "所有工程都已空闲，没有待处理任务"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskGroup, {
							label: `等待确认 · ${radar.attention.length}`,
							items: radar.attention,
							now,
							openSession
						}),
						prefs.showRunning && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskGroup, {
							label: `进行中 · ${radar.running.length}`,
							items: radar.running,
							now,
							openSession
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskGroup, {
							label: `处理完成 · ${radar.done.length}`,
							items: radar.done,
							now,
							openSession
						})
					]
				})]
			}),
			visible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "tr-fab-anchor",
				style: { transform: `translate(${effectivePos.x}px, ${effectivePos.y}px)` },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: fabRef,
					type: "button",
					className: [
						"tr-fab",
						counts.attention > 0 ? "has-attention" : "",
						total > 0 ? "tinted" : "",
						dragging ? "dragging" : ""
					].filter(Boolean).join(" "),
					style: total > 0 ? { background: fabFill } : void 0,
					title: "任务雷达（可拖动）",
					"aria-label": `任务雷达：${counts.attention} 个等待确认，${counts.running} 个进行中，${counts.done} 个已完成`,
					onPointerDown: onFabPointerDown,
					onPointerMove: onFabPointerMove,
					onPointerUp: endDrag,
					onPointerCancel: endDrag,
					onClick: onFabClick,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRadar, {}), fabBadge !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `tr-fab-badge ${fabBadge.kind}`,
						children: fabBadge.n > 99 ? "99+" : fabBadge.n
					})]
				})
			})
		]
	});
}
function TaskGroup(props) {
	if (props.items.length === 0) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "tr-group-label",
		children: props.label
	}), props.items.map((it) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "tr-item",
		onClick: () => props.openSession(it.id),
		title: it.cwd ?? it.title,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `tr-dot ${it.status}` }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "tr-item-main",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "tr-item-title",
					children: it.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "tr-item-meta",
					children: [
						it.project !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "tr-project",
							children: ["📁 ", it.project]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `tr-status-label ${it.status}`,
							children: it.status === "attention" ? WAITING_TEXT[it.waiting ?? ""] ?? STATUS_TEXT.attention : STATUS_TEXT[it.status]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["· ", timeLabel(it.updatedAt, props.now)] })
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "tr-iconbtn",
				"aria-hidden": true,
				style: { pointerEvents: "none" },
				children: it.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSpinner, {}) : it.status === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, {}) : null
			})
		]
	}, it.id))] });
}
function SettingsBody(props) {
	const perm = notificationSupported() ? notificationPermission() : "unsupported";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "tr-settings",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "tr-setting-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: props.prefs.systemNotifications,
					disabled: perm === "unsupported" || perm === "denied",
					onChange: (e) => props.onToggleSystem(e.target.checked)
				}), "系统通知（切到别的标签页时弹浏览器通知）"]
			}),
			perm === "denied" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "tr-setting-hint",
				children: "浏览器已拒绝通知权限，需要在站点设置里手动开启"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "tr-setting-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: props.prefs.sound,
					onChange: (e) => props.onToggleSound(e.target.checked)
				}), "等待确认时播放提示音"]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "tr-setting-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: props.prefs.showRunning,
					onChange: (e) => props.onToggleRunning(e.target.checked)
				}), "在列表中显示「进行中」分组"]
			})
		]
	});
}

//#endregion
//#region src/client/index.tsx
/** Cordis service ids (NOT package names): slots registry, sessions list,
* and the pending-interaction domain service. */
const inject = [
	"slots",
	"sessions",
	"uiSession"
];
function apply(ctx) {
	const openSession = (id) => {
		try {
			ctx.sessions.open(id);
			if (typeof window !== "undefined") window.focus();
		} catch (err) {
			console.warn("[task-radar] failed to open session", id, err);
		}
	};
	let disposed = false;
	let disposeRegistration;
	const stopWaiting = ctx.slots.inject("shell.overlay", () => {
		if (disposed) return () => {};
		disposeRegistration = ctx.slots.register({
			name: "shell.overlay",
			id: "dsh-task-radar",
			order: 90,
			label: "Task Radar"
		}, (props) => {
			const p = props;
			return RadarOverlay({
				useSessions: p.useSessions,
				useSessionPendingInteraction: p.useSessionPendingInteraction,
				openSession
			});
		});
		return disposeRegistration;
	});
	return () => {
		disposed = true;
		stopWaiting?.();
		disposeRegistration?.();
	};
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });