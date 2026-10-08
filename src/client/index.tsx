/**
 * Client entry: registers the Task Radar floating panel into the host's
 * additive `shell.overlay` slot (root scope, so the component receives the
 * global `useSessions` / `useSessionStatus` standard hooks as props) and
 * wires click-to-navigate through `ctx.uiWorkspace.openSession`.
 *
 * DSH 0.2.0 adaptation:
 *  - `useSessionPendingInteraction` was replaced by the unified
 *    `useSessionStatus` standard hook;
 *  - session navigation moved from `ctx.sessions.open` to
 *    `ctx.uiWorkspace.openSession`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, SessionListState, SessionStatusSnapshot, SelectorHook } from './types.ts'
import { RadarOverlay, type RadarProps } from './App.tsx'

/** Cordis service ids (NOT package names): slots registry, sessions list,
 * session status, and the workspace navigation service. */
export const inject = ['slots', 'sessions', 'uiSession', 'uiWorkspace']

export function apply(ctx: Context): () => void {
  const openSession = (id: SessionId): void => {
    try {
      ;(ctx.uiWorkspace as { openSession: (id: SessionId) => void }).openSession(id)
      // Bring the browser tab to the foreground when navigated from an OS
      // notification; harmless when already focused.
      if (typeof window !== 'undefined') window.focus()
    } catch (err) {
      console.warn('[task-radar] failed to open session', id, err)
    }
  }

  let disposed = false
  let disposeRegistration: (() => void) | undefined

  // slots.inject waits until the slot name is DECLARED (a plugin bundle may
  // load before its owning UI package declares the key), then registers once.
  const stopWaiting = ctx.slots.inject('shell.overlay', () => {
    if (disposed) return () => {}
    disposeRegistration = ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'dsh-task-radar',
        order: 90,
        label: 'Task Radar',
      },
      // Root-scope standard hooks are framework-injected props; erase the
      // exact prop types at this seam.
      (props: object) => {
        const p = props as {
          useSessions: SelectorHook<SessionListState>
          useSessionStatus: SelectorHook<SessionStatusSnapshot>
        }
        const radarProps: RadarProps = {
          useSessions: p.useSessions,
          useSessionStatus: p.useSessionStatus,
          openSession,
        }
        return RadarOverlay(radarProps)
      },
    )
    return disposeRegistration
  })

  return () => {
    disposed = true
    stopWaiting?.()
    disposeRegistration?.()
  }
}
