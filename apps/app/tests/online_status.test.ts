import { describe, expect, it } from 'vitest'
import { createOnlineStore } from '@/hooks/useOnlineStatus'

/** A fake event target so the store can be driven without a browser. */
function fakeTarget() {
  const listeners: Record<string, Set<() => void>> = { online: new Set(), offline: new Set() }
  return {
    target: {
      addEventListener: (t: string, l: () => void) => listeners[t]?.add(l),
      removeEventListener: (t: string, l: () => void) => listeners[t]?.delete(l),
    },
    fire: (t: 'online' | 'offline') => listeners[t].forEach((l) => l()),
    counts: () => ({ online: listeners.online.size, offline: listeners.offline.size }),
  }
}

describe('createOnlineStore', () => {
  it('reports the current online state and updates when events fire', () => {
    const t = fakeTarget()
    let online = true
    const store = createOnlineStore(t.target, () => online)
    const seen: boolean[] = []
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()))

    expect(store.getSnapshot()).toBe(true)
    online = false
    t.fire('offline')
    online = true
    t.fire('online')
    expect(seen).toEqual([false, true])

    unsubscribe()
    expect(t.counts()).toEqual({ online: 0, offline: 0 })
  })

  it('assumes online when the reader throws, so a glitch never traps the user behind a banner', () => {
    const store = createOnlineStore(fakeTarget().target, () => {
      throw new Error('navigator exploded')
    })
    expect(store.getSnapshot()).toBe(true)
  })

  it('without an event target it is inert but still readable (server render)', () => {
    const store = createOnlineStore(undefined, () => false)
    expect(store.getSnapshot()).toBe(false)
    expect(store.subscribe(() => undefined)()).toBeUndefined()
  })
})
