/**
 * Browser-local preferences for Task Radar. The host offers a settings
 * persistence seam, but a client-only plugin talking to localStorage keeps the
 * package dependency-free; keys are namespaced and prefs are per-browser.
 */

const KEY = 'dsh-task-radar:prefs:v1'
const POS_KEY = 'dsh-task-radar:fab-pos:v1'

/** FAB position stored as its top-left corner in viewport CSS pixels. */
export interface FabPos {
  x: number
  y: number
}

export function loadFabPos(): FabPos | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw === null) return null
    const p = JSON.parse(raw) as Partial<FabPos>
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return null
    }
    return { x: p.x, y: p.y }
  } catch {
    return null
  }
}

export function saveFabPos(pos: FabPos): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos))
  } catch {
    // Storage disabled — position simply does not persist this session.
  }
}

export interface RadarPrefs {
  /** System (OS) Notification permission may be requested from the panel. */
  systemNotifications: boolean
  /** Short audible ping on a new "waiting for you" alert while the tab is hidden. */
  sound: boolean
  /** Show the "in progress" bucket in the rail (always counted in the tab badge). */
  showRunning: boolean
}

const DEFAULTS: RadarPrefs = {
  systemNotifications: false,
  sound: false,
  showRunning: true,
}

export function loadPrefs(): RadarPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<RadarPrefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(prefs: RadarPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Storage disabled — prefs simply do not persist this session.
  }
}
