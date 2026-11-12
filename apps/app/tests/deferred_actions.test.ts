import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferredActions } from '@tracknow/core/utils/deferredActions'

afterEach(() => vi.useRealTimers())

describe('createDeferredActions (undo window)', () => {
  it('runs the action after the delay when it is not cancelled', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    const run = vi.fn()
    d.schedule('a', run, 1000)
    expect(d.has('a')).toBe(true)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(d.has('a')).toBe(false)
    expect(d.pending()).toBe(0)
  })

  it('cancel stops the action and reports that one was pending', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    const run = vi.fn()
    d.schedule('a', run, 1000)
    expect(d.cancel('a')).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(run).not.toHaveBeenCalled()
    expect(d.cancel('a')).toBe(false) // nothing pending any more
  })

  it('scheduling the same key again replaces the earlier action', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    const first = vi.fn()
    const second = vi.fn()
    d.schedule('a', first, 1000)
    d.schedule('a', second, 1000)
    vi.advanceTimersByTime(1000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('flushAll runs everything now (e.g. the screen unmounts mid-window)', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    const a = vi.fn()
    const b = vi.fn()
    d.schedule('a', a, 10000)
    d.schedule('b', b, 10000)
    d.flushAll()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(d.pending()).toBe(0)
  })

  it('cancelAll drops everything without running it', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    const a = vi.fn()
    d.schedule('a', a, 1000)
    d.cancelAll()
    vi.advanceTimersByTime(5000)
    expect(a).not.toHaveBeenCalled()
  })

  it('a throwing action never breaks the scheduler', () => {
    vi.useFakeTimers()
    const d = createDeferredActions()
    d.schedule('a', () => {
      throw new Error('boom')
    }, 100)
    expect(() => vi.advanceTimersByTime(100)).not.toThrow()
    expect(d.pending()).toBe(0)
  })
})
