/**
 * Task Radar build: two bundles.
 *
 *  - Node half (lib/index.js): ordinary ESM cordis plugin, the no-op host
 *    entry that makes the package resolvable by the profile loader.
 *  - Client half (lib/client.js): one CJS factory script wrapped in the
 *    `window.__ModuleLoader__.load({id, factory})` registration protocol the
 *    DSH web module table requires. Every non-seed import must stay external;
 *    cross-plugin imports are forbidden, so @deepseek-ai/* (types-only here)
 *    and react are answered by the module table at runtime.
 */
import type { UserConfig } from 'tsdown'

const ID = 'dsh-task-radar'

/** Module-table seed words the browser bundle may require at runtime. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom/client']

const nodeConfig: UserConfig = {
  name: `${ID}/node`,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  dts: false,
  sourcemap: false,
  clean: true,
  deps: {
    neverBundle: CLIENT_EXTERNALS,
  },
  outputOptions: {
    entryFileNames: '[name].js',
  },
}

const clientConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  minify: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: CLIENT_EXTERNALS,
    // @deepseek-ai/cordis is imported for the Context TYPE only; the type
    // import is erased, but keep it external defensively.
    alwaysBundle: (id: string) =>
      !CLIENT_EXTERNALS.includes(id) && !id.startsWith('@deepseek-ai/'),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeConfig, clientConfig]
