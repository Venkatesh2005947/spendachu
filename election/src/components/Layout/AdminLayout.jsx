import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Users, UserCheck, BarChart3,
  Settings, LogOut, Menu, X, Vote
} from 'lucide-react'
import { adminSignOut } from '../../services/adminService'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/voters', icon: Users, label: 'Voters' },
  { to: '/admin/candidates', icon: UserCheck, label: 'Candidates' },
  { to: '/admin/results', icon: BarChart3, label: 'Results' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await adminSignOut()
    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#061510' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 admin-sidebar z-40
        transition-transform duration-300 flex flex-col
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-emerald-500/15">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Vote size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">VoteSecure</div>
            <div className="text-emerald-400/60 text-xs">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1" role="navigation">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <div className="px-3 py-4 border-t border-emerald-500/15">
          <button
            id="admin-signout-btn"
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl
              text-sm font-medium text-gray-400 hover:text-red-400
              hover:bg-red-500/10 transition-all duration-150 border border-transparent"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-4
          border-b border-emerald-500/15 sticky top-0 z-20"
          style={{ background: 'rgba(6, 21, 16, 0.95)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Vote size={14} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm">VoteSecure Admin</span>
          </div>
          <button
            id="admin-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
          >
            {sidebarOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
