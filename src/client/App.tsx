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
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type {
  PendingMap,
  SelectorHook,
  SessionListState,
  SessionId,
  TaskItem,
  TaskStatus,
} from './types.ts'
import { deriveRadar } from './derive.ts'
import { loadFabPos, loadPrefs, saveFabPos, savePrefs, type FabPos, type RadarPrefs } from './settings.ts'
import {
  FaviconBadge,
  TitleBadge,
  notificationPermission,
  notificationSupported,
  playPing,
  requestNotificationPermission,
  showOsNotification,
} from './notifier.ts'
import { injectStyles } from './styles.ts'

/* ---------------------------------- icons --------------------------------- */

function IconRadar(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" opacity="0.55" />
      <circle cx="12" cy="12" r="4.5" opacity="0.55" />
      <g className="tr-radar-sweep">
        <path d="M12 12 L12 3" strokeWidth="2" />
        <circle cx="12" cy="6.6" r="1.4" fill="currentColor" stroke="none" />
      </g>
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconSpinner(): ReactNode {
  return (
    <svg className="tr-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  )
}
function IconCheck(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
function IconClose(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function IconGear(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.78 1.04 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/* --------------------------------- labels --------------------------------- */

const STATUS_TEXT: Record<TaskStatus, string> = {
  attention: '等待确认',
  running: '进行中',
  done: '处理完成',
  idle: '空闲',
}

const WAITING_TEXT: Record<string, string> = {
  approval: '等待权限确认',
  question: '等待回答',
  'plan-review': '等待计划批准',
}

function timeLabel(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/* ------------------------------ FAB geometry ------------------------------ */

const FAB_SIZE = 42
const VIEWPORT_MARGIN = 12
const DRAG_THRESHOLD = 5

type PointerDown = React.PointerEvent<HTMLButtonElement>
type PointerMove = React.PointerEvent<HTMLButtonElement>

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

function defaultFabPos(vw: number, vh: number): FabPos {
  return { x: vw - VIEWPORT_MARGIN - FAB_SIZE, y: vh - VIEWPORT_MARGIN - FAB_SIZE }
}

function clampPos(x: number, y: number, vw: number, vh: number): FabPos {
  const maxX = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - FAB_SIZE)
  const maxY = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - FAB_SIZE)
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  }
}

/** Snap to the nearest horizontal edge on release. */
function snapPos(pos: FabPos, vw: number): FabPos {
  const leftDist = pos.x - VIEWPORT_MARGIN
  const rightDist = vw - VIEWPORT_MARGIN - FAB_SIZE - pos.x
  return rightDist < leftDist
    ? { x: vw - VIEWPORT_MARGIN - FAB_SIZE, y: pos.y }
    : { x: VIEWPORT_MARGIN, y: pos.y }
}

/* -------------------------- proportional FAB fill ------------------------- */

const FILL_VAR: Record<'attention' | 'running' | 'done', string> = {
  attention: 'var(--tr-fill-attention)',
  running: 'var(--tr-fill-running)',
  done: 'var(--tr-fill-done)',
}

/**
 * Conic gradient segmented by the proportion of sessions in each status.
 * Attention (waiting) is pale yellow, running is pale blue, done is pale green.
 * Thin base-colour gaps separate segments so adjacent colours stay readable.
 */
function fabBackground(counts: { attention: number; running: number; done: number }): string {
  const allSegments: ReadonlyArray<{ kind: 'attention' | 'running' | 'done'; n: number }> = [
    { kind: 'attention', n: counts.attention },
    { kind: 'running', n: counts.running },
    { kind: 'done', n: counts.done },
  ]
  const segments = allSegments.filter((s) => s.n > 0)
  const total = segments.reduce((a, s) => a + s.n, 0)
  if (total === 0) return 'var(--tr-surface)'
  if (segments.length === 1) return FILL_VAR[segments[0].kind]
  // Small angular gap between segments (2deg × 2 since each side loses 1deg).
  const gap = segments.length === 2 ? 3 : 2.2
  const usable = 360 - gap * segments.length
  const parts: string[] = []
  let cursor = 0
  for (const s of segments) {
    const span = (s.n / total) * usable
    parts.push(`${FILL_VAR[s.kind]} ${cursor.toFixed(2)}deg ${(cursor + span).toFixed(2)}deg`)
    cursor += span + gap
  }
  return `conic-gradient(from -90deg, ${parts.join(', ')})`
}

/* ---------------------------------- toast --------------------------------- */

interface Toast {
  id: number
  sessionId: SessionId
  status: TaskStatus
  title: string
  detail: string
}

/* --------------------------------- props ---------------------------------- */

export interface RadarProps {
  useSessions: SelectorHook<SessionListState>
  useSessionPendingInteraction: SelectorHook<PendingMap>
  /** Host navigation: switch the current conversation. */
  openSession: (id: SessionId) => void
}

/* --------------------------------- root ----------------------------------- */

export function RadarOverlay({ useSessions, useSessionPendingInteraction, openSession }: RadarProps) {
  const list = useSessions((s) => s)
  const pending = useSessionPendingInteraction((m) => m)

  const [prefs, setPrefs] = useState<RadarPrefs>(() => loadPrefs())
  const [panelOpen, setPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [localDone, setLocalDone] = useState<ReadonlySet<SessionId>>(() => new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [, forceTick] = useState(0)

  /* ------------------------------ FAB drag -------------------------------- */
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' || window.innerWidth === undefined
      ? { w: 1280, h: 800 }
      : { w: window.innerWidth, h: window.innerHeight },
  )
  const [fabPos, setFabPos] = useState<FabPos | null>(() =>
    typeof window === 'undefined' ? null : loadFabPos(),
  )
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const fabRef = useRef<HTMLButtonElement | null>(null)

  // Clamp after window resize / zoom; initialize the position on first mount.
  useEffect(() => {
    function onResize(): void {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setViewport({ w: vw, h: vh })
      setFabPos((p) => clampPos(p?.x ?? vw - VIEWPORT_MARGIN - FAB_SIZE, p?.y ?? vh - VIEWPORT_MARGIN - FAB_SIZE, vw, vh))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function onFabPointerDown(e: PointerDown): void {
    if (e.button !== 0) return
    suppressClickRef.current = false
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: fabPos?.x ?? defaultFabPos(viewport.w, viewport.h).x,
      originY: fabPos?.y ?? defaultFabPos(viewport.w, viewport.h).y,
      moved: false,
    }
  }

  function onFabPointerMove(e: PointerMove): void {
    const d = dragRef.current
    if (d === null || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
      try {
        fabRef.current?.setPointerCapture(e.pointerId)
      } catch {
        // Some browsers throw for mouse capture on detached nodes — harmless.
      }
    }
    setFabPos(clampPos(d.originX + dx, d.originY + dy, viewport.w, viewport.h))
  }

  function endDrag(e: React.PointerEvent<HTMLButtonElement>): void {
    const d = dragRef.current
    if (d === null || e.pointerId !== d.pointerId) return
    dragRef.current = null
    if (!d.moved) return
    try {
      fabRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    suppressClickRef.current = true
    setDragging(false)
    setFabPos((p) => {
      if (p === null) return p
      const snapped = snapPos(p, viewport.w)
      saveFabPos(snapped)
      return snapped
    })
  }

  function onFabClick(): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setPanelOpen((v) => !v)
    setSettingsOpen(false)
  }

  // Re-render once a minute to refresh relative times.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const radar = useMemo(() => deriveRadar(list, pending, localDone), [list, pending, localDone])

  // Current session id for clearing local completion markers.
  const currentId = list.current

  /* ---------------- external channel singletons (title/favicon) ---------- */
  const channels = useRef<{ title: TitleBadge; favicon: FaviconBadge } | undefined>(undefined)
  if (channels.current === undefined && typeof window !== 'undefined') {
    channels.current = { title: new TitleBadge(), favicon: new FaviconBadge() }
  }
  useEffect(() => {
    injectStyles()
    const c = channels.current
    c?.title.start()
    c?.favicon.start()
    return () => {
      c?.title.stop()
      c?.favicon.stop()
    }
  }, [])

  /* ---------------------------- edge detector ----------------------------- */
  // Per-session previous status, observed only AFTER first feed (no alert for
  // pre-existing states on page load).
  const prevStatus = useRef(new Map<SessionId, TaskStatus | 'idle'>())
  const prevCurrent = useRef<SessionId | undefined>(undefined)
  const toastSeq = useRef(0)
  const radarRef = useRef(radar)
  radarRef.current = radar
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => {
    // Build a status map over every visible top-level session, including idle.
    const statusOfId = new Map<SessionId, TaskStatus | 'idle'>()
    for (const id of list.ids) {
      const s = list.byId[id]
      if (s === undefined || s.blank || s.origin === 'subagent' || s.parentId !== undefined) continue
      const item = radar.items.find((it) => it.id === id)
      statusOfId.set(id, item?.status ?? 'idle')
    }

    const hidden = typeof document !== 'undefined' && document.hidden
    const nextLocalDone = new Set(localDone)
    let localDoneChanged = false
    const newToasts: Toast[] = []
    let fireAttention = false
    let fireDone = false

    for (const [id, status] of statusOfId) {
      // Clear local marker once the session is revisited or restarts.
      if (nextLocalDone.has(id) && (id === currentId || status === 'running' || status === 'attention')) {
        nextLocalDone.delete(id)
        localDoneChanged = true
      }

      const prev = prevStatus.current.get(id)
      if (prev === undefined) {
        prevStatus.current.set(id, status)
        continue
      }
      if (prev === status) continue
      prevStatus.current.set(id, status)

      if (status === 'attention') {
        // Blocked agents always deserve an OS-level nudge when the tab is in
        // the background; in the foreground a toast suffices.
        if (hidden) fireAttention = true
        newToasts.push(makeToast(id, status))
      } else if (status === 'done' && (hidden || id !== currentId)) {
        if (hidden) fireDone = true
        newToasts.push(makeToast(id, status))
        // A currently-selected session finishing while the tab is hidden
        // produces no host `completed` flag (the host only arms it for
        // non-selected sessions); remember it locally so the badge/rail still
        // surface it until the user returns to that session.
        if (hidden && id === currentId && !nextLocalDone.has(id)) {
          nextLocalDone.add(id)
          localDoneChanged = true
        }
      } else if (status === 'running' && nextLocalDone.has(id)) {
        nextLocalDone.delete(id)
        localDoneChanged = true
      }
    }

    // Prune statuses of removed sessions.
    for (const id of [...prevStatus.current.keys()]) {
      if (!statusOfId.has(id)) prevStatus.current.delete(id)
    }

    if (localDoneChanged) setLocalDone(nextLocalDone)

    if (newToasts.length > 0) {
      setToasts((old) => [...old, ...newToasts].slice(-4))
      for (const t of newToasts) scheduleToastDismiss(t.id)
    }

    if (hidden && fireAttention) {
      const item = radar.attention[radar.attention.length - 1]
      if (item !== undefined) {
        if (prefsRef.current.sound) playPing()
        if (prefsRef.current.systemNotifications) {
          showOsNotification({
            title: `等待确认 · ${item.title}`,
            body: item.project !== '' ? `${item.project} — ${WAITING_TEXT[item.waiting ?? ''] ?? STATUS_TEXT.attention}` : WAITING_TEXT[item.waiting ?? ''] ?? STATUS_TEXT.attention,
            onClick: () => openSession(item.id),
          })
        }
      }
    } else if (hidden && fireDone) {
      const item = radar.done[radar.done.length - 1]
      if (item !== undefined && prefsRef.current.systemNotifications) {
        showOsNotification({
          title: `处理完成 · ${item.title}`,
          body: item.project !== '' ? item.project : STATUS_TEXT.done,
          onClick: () => openSession(item.id),
        })
      }
    }

    prevCurrent.current = currentId

    function makeToast(id: SessionId, status: TaskStatus): Toast {
      const it = radarRef.current.items.find((x) => x.id === id)
      toastSeq.current += 1
      return {
        id: toastSeq.current,
        sessionId: id,
        status,
        title: it?.title ?? id.slice(0, 8),
        detail:
          status === 'attention'
            ? WAITING_TEXT[it?.waiting ?? ''] ?? STATUS_TEXT.attention
            : STATUS_TEXT.done,
      }
    }
    function scheduleToastDismiss(id: number) {
      setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 6000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radar, currentId])

  /* --------------------- title + favicon from live counts ----------------- */
  useEffect(() => {
    const c = channels.current
    c?.title.setCounts({ attention: radar.counts.attention, done: radar.counts.done })
    c?.favicon.setCounts({ attention: radar.counts.attention, done: radar.counts.done })
  }, [radar.counts.attention, radar.counts.done])

  /* ------------------------------ settings -------------------------------- */
  function updatePrefs(patch: Partial<RadarPrefs>): void {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      savePrefs(next)
      return next
    })
  }

  async function toggleSystemNotifications(enabled: boolean): Promise<void> {
    if (!enabled) {
      updatePrefs({ systemNotifications: false })
      return
    }
    const granted = await requestNotificationPermission()
    updatePrefs({ systemNotifications: granted })
  }

  /* ------------------------------- derived -------------------------------- */
  const counts = radar.counts
  const total = counts.attention + counts.done + counts.running
  const fabBadge =
    counts.attention > 0
      ? { kind: 'attention' as const, n: counts.attention }
      : counts.done > 0
        ? { kind: 'done' as const, n: counts.done }
        : counts.running > 0
          ? { kind: 'running' as const, n: counts.running }
          : undefined
  const now = Date.now()

  // Auto-open the panel on a fresh attention state? No — stay non-blocking.
  const visible = total > 0 || panelOpen

  const fabFill = fabBackground(counts)
  const effectivePos = fabPos ?? defaultFabPos(viewport.w, viewport.h)

  // Panel hugs the FAB: above it, flipped horizontally when the FAB docks left.
  const openUpward = effectivePos.y > 200
  const dockedLeft = effectivePos.x < viewport.w / 2
  const panelStyle: CSSProperties = openUpward
    ? { left: dockedLeft ? effectivePos.x : undefined, right: dockedLeft ? undefined : viewport.w - effectivePos.x - FAB_SIZE, bottom: viewport.h - effectivePos.y + 10 }
    : { left: dockedLeft ? effectivePos.x : undefined, right: dockedLeft ? undefined : viewport.w - effectivePos.x - FAB_SIZE, top: effectivePos.y + FAB_SIZE + 10 }

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="dsh-task-radar" data-open={panelOpen ? 'true' : 'false'}>
      {/* transient toasts stay anchored bottom-right */}
      {toasts.length > 0 && (
        <div className="tr-toast-stack">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tr-toast ${t.status === 'attention' ? '' : 'done'}`}
              onClick={() => {
                openSession(t.sessionId)
                setToasts((old) => old.filter((x) => x.id !== t.id))
              }}
            >
              <div className="tr-toast-title">
                {t.status === 'attention' ? '⏳ ' : '✅ '}
                {t.title}
              </div>
              <div className="tr-toast-sub">{t.detail}</div>
            </button>
          ))}
        </div>
      )}

      {panelOpen && (
        <div className="tr-panel" style={panelStyle} role="dialog" aria-label="任务雷达">
          <div className="tr-header">
            <span className="tr-title">任务雷达</span>
            <span className="tr-spacer" />
            <button
              type="button"
              className="tr-iconbtn"
              title="设置"
              aria-label="设置"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <IconGear />
            </button>
            <button
              type="button"
              className="tr-iconbtn"
              title="收起"
              aria-label="收起"
              onClick={() => setPanelOpen(false)}
            >
              <IconClose />
            </button>
          </div>

          {settingsOpen ? (
            <SettingsBody
              prefs={prefs}
              onToggleSound={(v) => updatePrefs({ sound: v })}
              onToggleSystem={toggleSystemNotifications}
              onToggleRunning={(v) => updatePrefs({ showRunning: v })}
            />
          ) : (
            <div className="tr-list">
              {total === 0 && <div className="tr-empty">所有工程都已空闲，没有待处理任务</div>}
              <TaskGroup
                label={`等待确认 · ${radar.attention.length}`}
                items={radar.attention}
                now={now}
                openSession={openSession}
              />
              {prefs.showRunning && (
                <TaskGroup
                  label={`进行中 · ${radar.running.length}`}
                  items={radar.running}
                  now={now}
                  openSession={openSession}
                />
              )}
              <TaskGroup
                label={`处理完成 · ${radar.done.length}`}
                items={radar.done}
                now={now}
                openSession={openSession}
              />
            </div>
          )}
        </div>
      )}

      {visible && (
        <div className="tr-fab-anchor" style={{ transform: `translate(${effectivePos.x}px, ${effectivePos.y}px)` }}>
          <button
            ref={fabRef}
            type="button"
            className={[
              'tr-fab',
              counts.attention > 0 ? 'has-attention' : '',
              total > 0 ? 'tinted' : '',
              dragging ? 'dragging' : '',
            ].filter(Boolean).join(' ')}
            style={total > 0 ? { background: fabFill } : undefined}
            title="任务雷达（可拖动）"
            aria-label={`任务雷达：${counts.attention} 个等待确认，${counts.running} 个进行中，${counts.done} 个已完成`}
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={onFabClick}
          >
            <IconRadar />
            {fabBadge !== undefined && (
              <span className={`tr-fab-badge ${fabBadge.kind}`}>
                {fabBadge.n > 99 ? '99+' : fabBadge.n}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

/* --------------------------------- pieces --------------------------------- */

function TaskGroup(props: {
  label: string
  items: TaskItem[]
  now: number
  openSession: (id: SessionId) => void
}): ReactNode {
  if (props.items.length === 0) return null
  return (
    <>
      <div className="tr-group-label">{props.label}</div>
      {props.items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="tr-item"
          onClick={() => props.openSession(it.id)}
          title={it.cwd ?? it.title}
        >
          <span className={`tr-dot ${it.status}`} />
          <span className="tr-item-main">
            <div className="tr-item-title">{it.title}</div>
            <div className="tr-item-meta">
              {it.project !== '' && <span className="tr-project">📁 {it.project}</span>}
              <span className={`tr-status-label ${it.status}`}>
                {it.status === 'attention'
                  ? WAITING_TEXT[it.waiting ?? ''] ?? STATUS_TEXT.attention
                  : STATUS_TEXT[it.status]}
              </span>
              <span>· {timeLabel(it.updatedAt, props.now)}</span>
            </div>
          </span>
          <span className="tr-iconbtn" aria-hidden style={{ pointerEvents: 'none' }}>
            {it.status === 'running' ? <IconSpinner /> : it.status === 'done' ? <IconCheck /> : null}
          </span>
        </button>
      ))}
    </>
  )
}

function SettingsBody(props: {
  prefs: RadarPrefs
  onToggleSound: (v: boolean) => void
  onToggleSystem: (v: boolean) => void
  onToggleRunning: (v: boolean) => void
}): ReactNode {
  const perm = notificationSupported() ? notificationPermission() : 'unsupported'
  return (
    <div className="tr-settings">
      <label className="tr-setting-row">
        <input
          type="checkbox"
          checked={props.prefs.systemNotifications}
          disabled={perm === 'unsupported' || perm === 'denied'}
          onChange={(e) => props.onToggleSystem(e.target.checked)}
        />
        系统通知（切到别的标签页时弹浏览器通知）
      </label>
      {perm === 'denied' && (
        <div className="tr-setting-hint">浏览器已拒绝通知权限，需要在站点设置里手动开启</div>
      )}
      <label className="tr-setting-row">
        <input
          type="checkbox"
          checked={props.prefs.sound}
          onChange={(e) => props.onToggleSound(e.target.checked)}
        />
        等待确认时播放提示音
      </label>
      <label className="tr-setting-row">
        <input
          type="checkbox"
          checked={props.prefs.showRunning}
          onChange={(e) => props.onToggleRunning(e.target.checked)}
        />
        在列表中显示「进行中」分组
      </label>
    </div>
  )
}
