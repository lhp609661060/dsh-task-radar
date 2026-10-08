/**
 * Pure derivation: sessions list + per-session status snapshot → Task Radar
 * rows. No React, no DOM — unit-testable and reused by the rail, tab title
 * and notification edge detector so every surface reports one identical
 * status.
 *
 * DSH 0.2.0 adaptation: the old standalone pending-interaction map was
 * unified with running/completion facts into `useSessionStatus`
 * (`ReadonlyMap<SessionId, SessionStatus>`).
 */
import type {
  PendingKind,
  SessionId,
  SessionListState,
  SessionStatus,
  SessionStatusSnapshot,
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
 * Precedence matches the host's own status merge: a blocked agent (waiting
 * on the user) outranks everything, then live activity, then the completion
 * reminder, then idle.
 */
export function statusOf(status: SessionStatus | undefined): TaskStatus {
  const kind = status?.pendingInteraction?.kind
  if (kind !== undefined && VISIBLE_KINDS.has(kind)) return 'attention'
  if (status?.running === true) return 'running'
  if (status?.completionUnread === true) return 'done'
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
 * @param currentId - the currently open session id, used only to mark rows.
 * @param extraDoneIds - client-local completion set. When a selected session
 * finishes while the tab is hidden, the host's `completionUnread` is not
 * armed for the selected session; the controller remembers it locally so
 * the badge/rail still surface it until the user returns.
 */
export function deriveRadar(
  list: SessionListState,
  statuses: SessionStatusSnapshot,
  currentId: SessionId | undefined,
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

    const sessionStatus = statuses.get(id)
    const interaction = sessionStatus?.pendingInteraction
    const waiting =
      interaction !== undefined && VISIBLE_KINDS.has(interaction.kind)
        ? (interaction.kind as PendingKind)
        : undefined

    // Local completion marker applies when the host reports neither activity
    // nor its own completion reminder.
    const localDone =
      statusOf(sessionStatus) === 'idle' && extraDoneIds !== undefined && extraDoneIds.has(id)
    const status = localDone ? 'done' : statusOf(sessionStatus)
    if (status === 'idle') continue

    const item: TaskItem = {
      id,
      title: s.displayTitle || s.title || id.slice(0, 8),
      project: s.cwd !== undefined && s.cwd !== '' ? basename(s.cwd) : '',
      cwd: s.cwd,
      status,
      waiting,
      current: currentId === id,
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
    current: currentId,
  }
}
