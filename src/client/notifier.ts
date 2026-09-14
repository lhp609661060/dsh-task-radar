/**
 * Browser attention channels: tab title, favicon badge, OS notifications and
 * a soft ping. Every channel degrades silently (unsupported / denied /
 * headless test page) so the rail itself always works.
 */

export interface RadarCounts {
  attention: number
  done: number
}

const BASE_TITLE_KEY = 'dsh-task-radar:base-title'

/* ------------------------------------------------------------------ */
/* Tab title                                                           */
/* ------------------------------------------------------------------ */

/**
 * Compose the document title. The host's DocumentTitle continuously writes
 * `<session> — <product>` (or the bare product title), so rather than fight
 * it we observe its writes through a title-patching layer: after each host
 * write we re-prefix while alerts exist. A MutationObserver catches writes
 * we did not originate.
 */
export class TitleBadge {
  private prefix = ''
  private observer: MutationObserver | undefined
  private lastWritten = ''

  start(): void {
    if (typeof document === 'undefined') return
    this.observer = new MutationObserver(() => {
      if (document.title !== this.lastWritten) this.apply()
    })
    this.observer.observe(document.querySelector('head') ?? document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    this.apply()
  }

  setCounts(counts: RadarCounts): void {
    const total = counts.attention + counts.done
    this.prefix = total === 0 ? '' : counts.attention > 0 ? `(${counts.attention}) ` : `✓ ${total} · `
    this.apply()
  }

  /** Strip our prefix off a title the host wrote. */
  private baseTitle(): string {
    let t = document.title
    t = t.replace(/^\(\d+\)\s*/, '')
    t = t.replace(/^✓ \d+ ·\s*/, '')
    return t
  }

  private apply(): void {
    if (typeof document === 'undefined') return
    const base = this.baseTitle()
    const next = this.prefix === '' ? base : this.prefix + base
    if (next !== document.title) {
      this.lastWritten = next
      document.title = next
    }
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.prefix = ''
    // Leave the host-written (unprefixed) title in place.
  }
}

/* ------------------------------------------------------------------ */
/* Favicon badge                                                      */
/* ------------------------------------------------------------------ */

/**
 * Draw a small coloured dot badge over the existing favicon by rendering the
 * favicon image onto a canvas and emitting a data URL. When the site has no
 * usable favicon, emit a standalone round badge.
 */
export class FaviconBadge {
  private originalHref: string | null = null
  private originalLink: HTMLLinkElement | null = null
  private link: HTMLLinkElement | null = null

  start(): void {
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    this.originalLink = existing
    this.originalHref = existing?.getAttribute('href') ?? null
  }

  setCounts(counts: RadarCounts): void {
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return
    const total = counts.attention + counts.done
    if (total === 0) {
      this.restore()
      return
    }
    const colour = counts.attention > 0 ? '#d83a3a' : '#2ea043'
    void this.render(colour, Math.min(total, 99)).catch(() => this.restore())
  }

  private ensureLink(): HTMLLinkElement {
    if (this.link !== null) return this.link
    const link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
    this.link = link
    return link
  }

  private async render(colour: string, n: number): Promise<void> {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    if (this.originalHref !== null) {
      try {
        const img = await loadImage(this.originalHref)
        ctx.drawImage(img, 0, 0, size, size)
      } catch {
        // No drawable original — badge-only rendering below.
      }
    }

    // Badge disc, bottom-right.
    const r = 20
    const cx = size - r - 4
    const cy = size - r - 4
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), cx, cy + 1)

    this.ensureLink().href = canvas.toDataURL('image/png')
  }

  private restore(): void {
    if (this.link !== null) {
      this.link.remove()
      this.link = null
    }
    if (this.originalLink !== null && this.originalHref !== null) {
      this.originalLink.setAttribute('href', this.originalHref)
    }
  }

  stop(): void {
    this.restore()
  }
}

function loadImage(href: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = href
  })
}

/* ------------------------------------------------------------------ */
/* Soft ping                                                          */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | undefined

function getAudio(): AudioContext | undefined {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (Ctor === undefined) return undefined
  if (audioCtx === undefined) {
    try {
      audioCtx = new Ctor()
    } catch {
      return undefined
    }
  }
  return audioCtx
}

/** A short, gentle two-note chime generated with the WebAudio API (no assets). */
export function playPing(): void {
  if (typeof window === 'undefined') return
  const ctx = getAudio()
  if (ctx === undefined) return
  void ctx.resume().then(() => {
    const now = ctx.currentTime
    const notes: Array<[number, number]> = [
      [880, now],
      [1174.7, now + 0.12],
    ]
    for (const [freq, start] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.08, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    }
  })
}

/* ------------------------------------------------------------------ */
/* OS notification                                                    */
/* ------------------------------------------------------------------ */

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export interface OsNotificationInput {
  title: string
  body: string
  /** Invoked when the user clicks the OS notification. */
  onClick: () => void
}

export function showOsNotification(input: OsNotificationInput): void {
  if (!notificationSupported() || Notification.permission !== 'granted') return
  let n: Notification
  try {
    n = new Notification(input.title, { body: input.body, tag: 'dsh-task-radar', silent: false })
  } catch {
    // Some browsers throw in edge cases (e.g. insecure context) — ignore.
    return
  }
  n.onclick = () => {
    window.focus()
    input.onClick()
    n.close()
  }
}
