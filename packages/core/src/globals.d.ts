// Globals that every Track.now runtime (browsers, React Native/Hermes, Node for tests) provides.
// The DOM lib is deliberately not loaded so browser-only APIs cannot leak into shared code.
declare const console: {
  log(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}
declare function setTimeout(handler: () => void, ms?: number): number
declare function clearTimeout(id: number | undefined): void
