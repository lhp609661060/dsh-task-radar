/**
 * Local ambient shims for host packages the plugin never imports at runtime
 * (the browser module table only seeds react; see tsdown externals). We use
 * the Context type structurally. Keeping these out of devDependencies avoids
 * pulling the whole DSH stack into the local build.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    // Service bag accessed dynamically (slots / sessions / uiSession).
    [key: string]: unknown
    effect(fn: () => void | (() => void), label?: string): void
    slots: {
      inject(slotName: string, register: () => () => void): () => void
      register(options: Record<string, unknown>, component: unknown): () => void
    }
  }
  export type Service = unknown
}
