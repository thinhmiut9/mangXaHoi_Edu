import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { disconnectSocket } from '@/socket/socketClient'

export default function AdminLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore API error; local cleanup still proceeds.
    } finally {
      disconnectSocket()
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/users', label: 'Qu?n lý User', icon: 'users' },
    { to: '/admin/reports', label: 'Báo cáo', icon: 'reports' },
  ] as const

  return (
    <div className="flex h-screen bg-[#f3f6fb] font-sans text-slate-800">
      <aside className="flex w-[270px] shrink-0 flex-col border-r border-slate-200/80 bg-white/95 px-4 py-5">
        <h2 className="text-[28px] font-bold tracking-tight text-blue-600">EduSocial Admin</h2>
        <div className="mt-6 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`
              }
            >
              {item.icon === 'dashboard' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              )}
              {item.icon === 'users' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="3" />
                  <path d="M20 8v6M23 11h-6" />
                </svg>
              )}
              {item.icon === 'reports' && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 12h8M8 8h8M8 16h5" />
                </svg>
              )}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <button
            onClick={() => void handleLogout()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span>Ðang xu?t</span>
          </button>
          <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-400">© 2026 EduSocial</div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-[1480px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
