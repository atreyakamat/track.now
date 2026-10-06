import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  Target,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { initials } from '@/utils/format'

interface SidebarProps {
  onNavigate?: () => void
  isDrawer?: boolean
}

export function Sidebar({ onNavigate, isDrawer }: SidebarProps) {
  const { displayName, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tracks', label: 'Tracks', icon: Target },
    { to: '/today', label: 'Today', icon: Calendar },
    { to: '/reviews', label: 'Reviews', icon: CheckCircle2 },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  return (
    <aside className={`sidebar ${isDrawer ? 'sidebar--drawer' : ''}`}>
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          T
        </span>
        <span>Track.now</span>
      </div>

      <nav className="nav" aria-label="Main Navigation">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className="nav__link"
              onClick={onNavigate}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div style={{ padding: '0 var(--space-2)' }}>
        <NavLink
          to="/tracks/new"
          className="btn btn--secondary btn--sm btn--block"
          onClick={onNavigate}
          style={{ textDecoration: 'none', justifyContent: 'flex-start' }}
        >
          <Plus size={16} />
          <span>New Track</span>
        </NavLink>
      </div>

      <div className="profile">
        <div className="profile__avatar" aria-hidden="true">
          {initials(displayName)}
        </div>
        <div className="profile__meta">
          <div className="profile__name" title={displayName}>
            {displayName}
          </div>
          <div className="row" style={{ gap: '4px', marginTop: '4px' }}>
            <NavLink
              to="/settings"
              className="btn btn--ghost btn--sm btn--icon"
              title="Settings"
              aria-label="Settings"
              onClick={onNavigate}
            >
              <Settings size={15} />
            </NavLink>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--icon"
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
