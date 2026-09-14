/**
 * Pure derivation: sessions list + pending-interaction map → Task Radar rows.
 * No React, no DOM — unit-testable and reused by the rail, tab title and
 * notification edge detector so every surface reports one identical status.
 */
import type {
  PendingKind,
  PendingMap,
  SessionId,
  SessionListState,
  TaskItem,
  TaskStatus,
} from './types.ts'

/** Visible pending kinds (host may later add other kinds — ignore unknown). */
const VISIBLE_KINDS = new Set<string>(['approval', 'question', 'plan-review'])

function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/**
 * Effective status of one session.
 * Precedence matches the host's own sessionStatuses(): a blocked agent
 * (waiting on the user) outranks everything, then live activity, then the
 * completion reminder, then idle.
 */
export function statusOf(
  summary: { running: boolean; completed?: boolean },
  pendingKind: string | undefined,
): TaskStatus {
  if (pendingKind !== undefined && VISIBLE_KINDS.has(pendingKind)) return 'attention'
  if (summary.running) return 'running'
  if (summary.completed === true) return 'done'
  return 'idle'
}

export interface RadarSummary {
  items: TaskItem[]
  attention: TaskItem[]
  done: TaskItem[]
  running: TaskItem[]
  /** Counts across ALL sessions (including the current one) for the tab badge. */
  counts: { attention: number; done: number; running: number }
  current: SessionId | undefined
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
export function deriveRadar(
  list: SessionListState,
  pending: PendingMap,
  extraDoneIds?: ReadonlySet<SessionId>,
): RadarSummary {
  const attention: TaskItem[] = []
  const done: TaskItem[] = []
  const running: TaskItem[] = []
  const items: TaskItem[] = []

  for (const id of list.ids) {
    const s = list.byId[id]
    if (s === undefined) continue
    if (s.blank) continue
    // Subagents belong to their parent's task surface; skip nested rows so a
    // multi-agent team does not flood the rail. Top-level sessions only.
    if (s.origin === 'subagent' || s.parentId !== undefined) continue

    const interaction = pending.get(id)
    const waiting =
      interaction !== undefined && VISIBLE_KINDS.has(interaction.kind)
        ? (interaction.kind as PendingKind)
        : undefined
    // Local completion marker only applies while the host has not marked the
    // row itself and the session is no longer running / not blocked.
    const localDone =
      statusOf(s, waiting) === 'idle' && extraDoneIds !== undefined && extraDoneIds.has(id)
    const status = localDone ? 'done' : statusOf(s, waiting)
    if (status === 'idle') continue

    const item: TaskItem = {
      id,
      title: s.displayTitle || s.title || id.slice(0, 8),
      project: s.cwd !== undefined && s.cwd !== '' ? basename(s.cwd) : '',
      cwd: s.cwd,
      status,
      waiting,
      current: list.current === id,
      updatedAt: s.updatedAt,
    }
    items.push(item)
    if (status === 'attention') attention.push(item)
    else if (status === 'done') done.push(item)
    else running.push(item)
  }

  // Newest first inside each bucket.
  const byTime = (a: TaskItem, b: TaskItem) => b.updatedAt - a.updatedAt
  attention.sort(byTime)
  done.sort(byTime)
  running.sort(byTime)

  return {
    items,
    attention,
    done,
    running,
    counts: { attention: attention.length, done: done.length, running: running.length },
    current: list.current,
  }
}
