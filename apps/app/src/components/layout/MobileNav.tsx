import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  Target,
} from 'lucide-react'
import { Button, Drawer } from '@/components/ui'
import { Sidebar } from './Sidebar'

interface MobileNavProps {
  drawerOpen: boolean
  onToggleDrawer: () => void
  onCloseDrawer: () => void
}

export function MobileNav({ drawerOpen, onToggleDrawer, onCloseDrawer }: MobileNavProps) {
  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tracks', label: 'Tracks', icon: Target },
    { to: '/today', label: 'Today', icon: Calendar },
    { to: '/reviews', label: 'Reviews', icon: CheckCircle2 },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ]

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            T
          </span>
          <span>Track.now</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon
          onClick={onToggleDrawer}
          aria-label="Open menu drawer"
        >
          <Menu size={20} />
        </Button>
      </header>

      <Drawer open={drawerOpen} onClose={onCloseDrawer} label="Navigation Menu">
        <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Sidebar onNavigate={onCloseDrawer} isDrawer />
        </div>
      </Drawer>

      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className="bottom-nav__link"
            >
              <Icon size={20} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
