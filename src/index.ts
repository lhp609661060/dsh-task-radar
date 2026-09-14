/**
 * dsh-task-radar — Node half.
 *
 * Task Radar is a browser-only plugin: the entire feature (cross-workspace
 * task status aggregation, tab-title/Notification alerts, side message rail)
 * lives in the client half. The Node half exists solely to satisfy the
 * cordis entry contract (`dsh.bundle.patch` inserts this package by name).
 */
import type { Context } from '@deepseek-ai/cordis'

export const inject: string[] = []

export function apply(_ctx: Context): void {
  // No host-side behavior.
}
