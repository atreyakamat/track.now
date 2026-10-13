import { describe, expect, it, vi } from 'vitest'

/**
 * The browser client must use the PKCE auth flow. With the implicit flow, any app URL
 * carrying `#access_token=…&refresh_token=…` silently signs the browser into the account
 * those tokens belong to (login CSRF / session fixation).
 */
const createClient = vi.hoisted(() =>
  vi.fn(() => ({ auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } })),
)
vi.mock('@supabase/supabase-js', () => ({ createClient }))

describe('supabase client configuration', () => {
  it('uses PKCE, persists the session and detects auth links', async () => {
    await import('@/lib/supabase/client')
    expect(createClient).toHaveBeenCalledTimes(1)
    const [url, key, options] = createClient.mock.calls[0] as unknown as [string, string, { auth: Record<string, unknown> }]
    // vitest.config points the unit suite at an unroutable loopback URL, never a real project.
    expect(url).toBe('http://127.0.0.1:9')
    expect(key).toMatch(/^test-only/)
    expect(options.auth).toMatchObject({ flowType: 'pkce', persistSession: true, detectSessionInUrl: true })
  })
})
