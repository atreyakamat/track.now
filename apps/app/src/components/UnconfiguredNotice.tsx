import { AlertCircle, Terminal } from 'lucide-react'

export function UnconfiguredNotice() {
  return (
    <div className="auth">
      <div className="auth__card" style={{ width: 'min(540px, 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            className="brand__mark"
            style={{
              width: '40px',
              height: '40px',
              margin: '0 auto var(--space-3)',
              fontSize: '20px',
            }}
            aria-hidden="true"
          >
            T
          </div>
          <h1 className="t-h1">Supabase Configuration Required</h1>
          <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
            Track.now runs on Supabase for PostgreSQL, Auth, and Storage.
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="alert alert--info" style={{ display: 'flex', gap: '10px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Missing environment variables</strong>
              <p style={{ marginTop: '4px', fontSize: 'var(--text-caption)' }}>
                Please create a <code>.env.local</code> file in the repository root and supply your Supabase credentials:
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface-muted)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              overflowX: 'auto',
            }}
          >
            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
          </div>

          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
            <div className="row" style={{ alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              <Terminal size={14} /> Quick Setup:
            </div>
            <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
              <li>Insert your project URL and public anon key from your Supabase dashboard.</li>
              <li>Run the SQL migration in <code>supabase/migrations/20261005000000_init_schema.sql</code> in the Supabase SQL editor.</li>
              <li>Restart the Vite dev server.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
