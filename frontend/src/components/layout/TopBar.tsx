import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { authApi } from '@/api/auth'
import { disconnectSocket } from '@/socket/socketClient'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/utils/cn'

const mobileTabItems = [
  { to: '/', label: 'Trang chủ', icon: 'home' },
  { to: '/groups', label: 'Nhóm', icon: 'groups' },
  { to: '/friends', label: 'Bạn bè', icon: 'friends' },
  { to: '/notifications', label: 'Thông báo', icon: 'bell' },
]

function MobileTabIcon({ name }: { name: string }) {
  if (name === 'home') {
    return (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    )
  }
  if (name === 'groups') {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  }
  if (name === 'friends') {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11z" />
        <path d="M2 20v-1.5C2 16.01 4.24 14 7 14h2c2.76 0 5 2.01 5 4.5V20" />
        <path d="M14 20v-1.5c0-1.35-.42-2.58-1.13-3.53A4.96 4.96 0 0116 14h2c2.76 0 5 2.01 5 4.5V20" />
      </svg>
    )
  }
  return (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  )
}

export function TopBar() {
  const { user, clearAuth } = useAuthStore()
  const { unreadNotificationCount, unreadMessageCount } = useNotificationStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-mode')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem('theme-mode', themeMode)
  }, [themeMode])

  useEffect(() => {
    setShowMobileMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showMobileMenu) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [showMobileMenu])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      disconnectSocket()
      clearAuth()
      setShowUserMenu(false)
      setShowMobileMenu(false)
      navigate('/login')
    }
  }

  const closeMobileMenu = () => setShowMobileMenu(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  const mobileMenuLayer = typeof document !== 'undefined'
    ? createPortal(
        <>
          <div
            className={cn(
              'fixed inset-0 z-50 bg-black/35 transition-opacity duration-300',
              showMobileMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            )}
            onClick={closeMobileMenu}
            aria-hidden={!showMobileMenu}
          />
          <aside
            className={cn(
              'fixed right-0 top-0 z-[60] h-screen w-[290px] border-l border-border-light bg-white shadow-2xl transition-transform duration-300',
              showMobileMenu ? 'translate-x-0' : 'translate-x-full'
            )}
            aria-hidden={!showMobileMenu}
          >
            <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
              <p className="text-lg font-semibold text-text-primary">Menu</p>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-hover-bg"
                aria-label="Đóng menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="px-2 py-2">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  navigate('/groups')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 20v-1.5C2 16.01 4.24 14 7 14h2c2.76 0 5 2.01 5 4.5V20" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 20v-1.5c0-1.35-.42-2.58-1.13-3.53A4.96 4.96 0 0116 14h2c2.76 0 5 2.01 5 4.5V20" />
                </svg>
                <span>Nhóm</span>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1 1 0 011.35-.936l.547.182a8 8 0 104.58 4.58l.182.547a1 1 0 01-.936 1.35h-1.017a1 1 0 01-.992-.876l-.156-1.248a1 1 0 01.29-.867l.72-.72a6 6 0 11-6.873-1.4z" />
                </svg>
                <span>Cài đặt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  navigate(`/profile/${user?.id ?? ''}`)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="8" r="4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 20c1.5-3 4.2-5 7-5s5.5 2 7 5" />
                </svg>
                <span>Hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  navigate('/notifications')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
                <span>Thông báo</span>
              </button>
            </nav>

            <div className="mt-2 border-t border-border-light px-2 py-2">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-error-500 hover:bg-red-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 20H5a2 2 0 01-2-2V6a2 2 0 012-2h8" />
                </svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>
        </>,
        document.body
      )
    : null

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-border-light bg-white/90 backdrop-blur-md shadow-sm">
      <div className="md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${user?.id ?? ''}`}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover-bg"
              aria-label="Trang cá nhân"
            >
              <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
            </Link>
            <Link to="/" className="text-3xl font-extrabold leading-none text-primary-500" aria-label="EduSocial">
              edusocial
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover-bg"
              aria-label="Tìm kiếm"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <Link to="/chat" className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover-bg" aria-label="Tin nhắn">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M5 20l1.5-3H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {unreadMessageCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover-bg"
              aria-label="Mở menu"
              aria-expanded={showMobileMenu}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {!isChatPage && (
          <div className="grid h-12 grid-cols-5 border-t border-border-light px-1">
            {mobileTabItems.map(item => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              const badge = item.to === '/notifications' ? unreadNotificationCount : 0
              return (
                <Link
                  key={`m-tab-${item.to}`}
                  to={item.to}
                  className={cn('relative flex items-center justify-center text-text-muted', isActive && 'text-primary-500')}
                  aria-label={item.label}
                >
                  <MobileTabIcon name={item.icon} />
                  {badge > 0 && (
                    <span className="absolute right-3 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {isActive && <span className="absolute bottom-0 left-1/2 h-[3px] w-16 -translate-x-1/2 rounded-full bg-primary-500" />}
                </Link>
              )
            })}
            <Link
              to={`/profile/${user?.id ?? ''}`}
              className={cn('relative flex items-center justify-center text-text-muted', location.pathname.startsWith('/profile') && 'text-primary-500')}
              aria-label="Trang cá nhân"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20c1.5-3 4.2-5 7-5s5.5 2 7 5" />
              </svg>
              {location.pathname.startsWith('/profile') && <span className="absolute bottom-0 left-1/2 h-[3px] w-16 -translate-x-1/2 rounded-full bg-primary-500" />}
            </Link>
          </div>
        )}

        {mobileMenuLayer}
      </div>

      <div className="hidden h-14 grid-cols-[minmax(0,1fr)_minmax(0,520px)_minmax(0,1fr)] items-center gap-3 px-4 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5" aria-label="EduSocial - Trang chủ">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-primary-600">EduSocial</span>
          </Link>
        </div>

        <form onSubmit={handleSearch} className="mx-auto w-full max-w-[520px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Tìm kiếm EduSocial..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-app-bg pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Tìm kiếm"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-2">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(m => !m)}
              className="flex items-center rounded-full p-0.5 transition-colors hover:bg-hover-bg focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Menu tài khoản"
              aria-expanded={showUserMenu}
            >
              <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-border-light bg-white py-1 shadow-lg">
                <Link to={`/profile/${user?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hover-bg" onClick={() => setShowUserMenu(false)}>
                  <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{user?.displayName}</p>
                    <p className="text-xs text-text-secondary">Xem trang cá nhân</p>
                  </div>
                </Link>
                <button
                  onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-text-primary hover:bg-hover-bg"
                >
                  <span>{themeMode === 'light' ? 'Ban đêm' : 'Ban ngày'}</span>
                  <span aria-hidden="true">{themeMode === 'light' ? '🌙' : '☀️'}</span>
                </button>
                <hr className="my-1 border-border-light" />
                <button
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-error-500 hover:bg-hover-bg"
                >
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
