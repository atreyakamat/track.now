import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <MobileNav
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
