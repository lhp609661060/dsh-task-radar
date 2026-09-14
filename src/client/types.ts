/**
 * Structural types for the live feeds Task Radar consumes. We intentionally do
 * NOT import from `@deepseek-ai/*` packages: a client bundle may only request
 * the handful of module-table words the runtime seeds (react family), and
 * cross-plugin value/type imports are rejected by the module table at load.
 * These shapes mirror 0.1.5-rc.1 contracts exactly (verified against
 * dsh-api-session-controller client types); they are structural, so a future
 * host with additive fields keeps working.
 */

/** Branded session id — structurally a string. */
export type SessionId = string

/** One row of the sessions list feed (`useSessions(s => ...)`). */
export interface SessionSummary {
  id: SessionId
  title?: string
  displayTitle: string
  cwd?: string
  parentId?: SessionId
  origin?: 'subagent'
  running: boolean
  /** Finished while not selected and not yet opened — host's completion reminder. */
  completed?: boolean
  blank: boolean
  updatedAt: number
}

/** The sessions list snapshot. */
export interface SessionListState {
  ids: SessionId[]
  byId: Record<SessionId, SessionSummary>
  current: SessionId | undefined
}

/** Discriminator of a pending user interaction the host UI is presenting. */
export type PendingKind = 'approval' | 'question' | 'plan-review'

/** A pending interaction projected by the host (approval / question / plan). */
export interface PendingInteraction {
  kind: PendingKind | string
  sessionId: SessionId
}

/** Read-only pending-interaction feed (`sessionId → interaction`). */
export type PendingMap = ReadonlyMap<SessionId, PendingInteraction>

/**
 * Effective attention status of one session for Task Radar.
 * - `attention` — agent is blocked on the user (tool approval / question / plan)
 * - `done`      — a turn just finished on a non-selected session
 * - `running`   — agent is working
 * - `idle`      — nothing happening
 */
export type TaskStatus = 'attention' | 'done' | 'running' | 'idle'

export interface TaskItem {
  id: SessionId
  title: string
  /** Project/directory label derived from cwd basename. */
  project: string
  cwd: string | undefined
  status: TaskStatus
  /** What the agent is waiting for, when status === 'attention'. */
  waiting: PendingKind | undefined
  /** Whether this is the currently open session (never notified for itself). */
  current: boolean
  updatedAt: number
}

/** Selector-hook shape injected by the framework into root-scope slot components. */
export type SelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S
