// Offline smoke test for the built client bundle:
//  1. bundle speaks the window.__ModuleLoader__ factory protocol
//  2. only react-family externals are required
//  3. apply() registers one `shell.overlay` list entry with proper options
//  4. SSR of the registered component reflects derived counts (attention wins)
//  5. done-only feed shows the green badge; all-idle hides the FAB
// Run: node scripts/smoke.mjs
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToString } from 'react-dom/server'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const code = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
assert.ok(code.startsWith('window.__ModuleLoader__.load({'), 'factory banner missing')
assert.ok(code.trimEnd().endsWith('return module.exports; } });'), 'factory footer missing')

// Browser-ish globals used at module evaluation / render time.
globalThis.window = globalThis
const loader = {
  load({ id, factory }) {
    globalThis.__radarExports = factory((spec) => {
      if (spec === 'react') return require('react')
      if (spec === 'react/jsx-runtime') return require('react/jsx-runtime')
      throw new Error('non-seed external required: ' + spec)
    })
    assert.equal(id, 'dsh-task-radar')
  },
}
globalThis.window.__ModuleLoader__ = loader
globalThis.__ModuleLoader__ = loader
globalThis.document = {
  hidden: false,
  title: 'DSH',
  head: { appendChild() {}, querySelector() { return null } },
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, getContext: () => null, remove() {} }),
  querySelector: () => null,
}
globalThis.localStorage = { getItem: () => null, setItem() {} }
globalThis.Notification = undefined
globalThis.AudioContext = undefined
globalThis.MutationObserver = class { observe() {} disconnect() {} }

;(0, eval)(code)

const { apply, inject } = globalThis.__radarExports
assert.deepEqual(
  inject,
  ['slots', 'sessions', 'uiSession', 'uiWorkspace'],
  'inject = ' + JSON.stringify(inject),
)

let registered
const ctx = {
  slots: {
    inject(name, cb) {
      assert.equal(name, 'shell.overlay')
      return cb()
    },
    register(options, component) {
      registered = { options, component }
      return () => {}
    },
  },
  sessions: {},
  uiWorkspace: { openSession() {} },
}
apply(ctx)
assert.ok(registered, 'component not registered')
assert.equal(registered.options.name, 'shell.overlay')
assert.equal(registered.options.id, 'dsh-task-radar')

const now = Date.now()
const list = {
  ids: ['s1', 's2', 's3'],
  byId: {
    s1: { id: 's1', displayTitle: '修复订单接口', cwd: '/Users/me/ecms', running: false, blank: false, updatedAt: now },
    s2: { id: 's2', displayTitle: '跑数据迁移', cwd: '/Users/me/cas', running: true, blank: false, updatedAt: now },
    s3: { id: 's3', displayTitle: '写周报', cwd: '/Users/me/docs', running: false, blank: false, updatedAt: now },
  },
}
// Unified status snapshot (DSH 0.2.0 useSessionStatus).
const statuses = new Map([
  ['s1', { running: false, pendingInteraction: { key: 'k1', kind: 'approval', sessionId: 's1' }, completionUnread: false }],
  ['s2', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['s3', { running: false, pendingInteraction: undefined, completionUnread: true }],
])
const props = {
  useSessions: (sel) => sel(list),
  useSessionStatus: (sel) => sel(statuses),
}

const html = renderToString(React.createElement(registered.component, props))
assert.ok(html.includes('tr-fab has-attention'), 'attention FAB class')
assert.ok(html.includes('1 个等待确认，1 个进行中，1 个已完成'), 'aria counts')
assert.ok(html.includes('tr-fab-badge attention'), 'attention badge')
// Mixed statuses → proportional conic fill with all three pastel segments.
assert.ok(html.includes('conic-gradient'), 'conic fill when mixed')
assert.ok(html.includes('--tr-fill-attention'), 'yellow segment')
assert.ok(html.includes('--tr-fill-running'), 'blue segment')
assert.ok(html.includes('--tr-fill-done'), 'green segment')
assert.ok(html.includes('tr-fab-anchor'), 'draggable anchor wrapper')

// Done-only → solid pale green, no pulse.
const html2 = renderToString(
  React.createElement(registered.component, {
    useSessions: (sel) => sel({ ids: ['s3'], byId: { s3: list.byId.s3 } }),
    useSessionStatus: (sel) =>
      sel(new Map([['s3', { running: false, pendingInteraction: undefined, completionUnread: true }]])),
  }),
)
assert.ok(!html2.includes('has-attention'), 'no pulse when only done')
assert.ok(html2.includes('tr-fab-badge done'), 'done badge')
assert.ok(html2.includes('background:var(--tr-fill-done)') || html2.includes('background: var(--tr-fill-done)'), 'solid green fill')
assert.ok(!html2.includes('conic-gradient'), 'no conic when single status')

// Running-only → solid pale blue.
const html4 = renderToString(
  React.createElement(registered.component, {
    useSessions: (sel) => sel({ ids: ['s2'], byId: { s2: list.byId.s2 } }),
    useSessionStatus: (sel) =>
      sel(new Map([['s2', { running: true, pendingInteraction: undefined, completionUnread: false }]])),
  }),
)
assert.ok(html4.includes('tr-fab-badge running'), 'running badge')
assert.ok(html4.includes('--tr-fill-running'), 'solid blue fill')

// All idle → FAB hidden.
const html3 = renderToString(
  React.createElement(registered.component, {
    useSessions: (sel) =>
      sel({
        ids: ['x'],
        byId: { x: { id: 'x', displayTitle: 'idle', cwd: '/x', running: false, blank: false, updatedAt: now } },
      }),
    useSessionStatus: (sel) =>
      sel(new Map([['x', { running: false, pendingInteraction: undefined, completionUnread: false }]])),
  }),
)
assert.ok(!html3.includes('tr-fab'), 'FAB hidden when all idle')

assert.ok(code.includes('等待确认') && code.includes('处理完成') && code.includes('进行中'), 'group labels shipped')

console.log('SMOKE OK')
console.log('- factory protocol + seed-only externals + service inject')
console.log('- shell.overlay registration options')
console.log('- attention/done/idle FAB derivation and badge counts')
