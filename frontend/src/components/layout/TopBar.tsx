import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { authApi } from '@/api/auth'
import { disconnectSocket } from '@/socket/socketClient'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const queryClient = useQueryClient()
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')
  const isSearchPage = location.pathname.startsWith('/search')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-mode')
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > 20 : false
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem('theme-mode', themeMode)
  }, [themeMode])

  useEffect(() => {
    setShowMobileMenu(false)
    setShowUserMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showUserMenu) return

    const closeOnOutside = (event: Event) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserMenu(false)
    }
    const closeOnScroll = () => setShowUserMenu(false)

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', closeOnScroll, { passive: true })

    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', closeOnScroll)
    }
  }, [showUserMenu])

  useEffect(() => {
    if (!showMobileMenu) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [showMobileMenu])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      disconnectSocket()
      clearAuth()
      setConfirmLogoutOpen(false)
      setShowUserMenu(false)
      setShowMobileMenu(false)
      navigate('/login')
    }
  }

  const closeMobileMenu = () => setShowMobileMenu(false)
  const isRouteActive = (to: string) =>
    to === '/'
      ? location.pathname === '/'
      : to === '/documents'
        ? location.pathname.startsWith('/documents')
        : to.startsWith('/profile')
          ? location.pathname.startsWith('/profile')
          : location.pathname.startsWith(to)

  const refreshCurrentView = () => {
    queryClient.invalidateQueries()
    queryClient.refetchQueries({ type: 'active' })
  }

  const handleNavigation = (to: string, options?: { closeMenu?: boolean }) => {
    if (options?.closeMenu) closeMobileMenu()
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    if (isRouteActive(to)) {
      refreshCurrentView()
      return
    }
    navigate(to)
  }

  const handleLinkNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    to: string,
    options?: { closeMenu?: boolean }
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }
    event.preventDefault()
    handleNavigation(to, options)
  }

  const openSettingsModal = () => {
    window.dispatchEvent(new Event('open-settings-modal'))
    setShowUserMenu(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  const actionButtonClass =
    'relative overflow-hidden flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-all duration-300 hover:text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 before:absolute before:inset-0 before:rounded-full before:bg-primary-500/12 before:opacity-0 before:scale-75 before:transition-all before:duration-300 hover:before:opacity-100 hover:before:scale-100'

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
                  handleNavigation('/groups', { closeMenu: true })
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
                onClick={() => {
                  handleNavigation('/documents', { closeMenu: true })
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h4" />
                </svg>
                <span>Kho tài liệu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  openSettingsModal()
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 0 1 19.79 19.71L19.77 19.73A2 2 0 0 1 16.94 19.73L16.88 19.67A1.65 1.65 0 0 0 15.06 19.34A1.65 1.65 0 0 0 14.06 20.85V20.94A2 2 0 0 1 12.06 22.94H11.94A2 2 0 0 1 9.94 20.94V20.85A1.65 1.65 0 0 0 8.94 19.34A1.65 1.65 0 0 0 7.12 19.67L7.06 19.73A2 2 0 0 1 4.23 19.73L4.21 19.71A2 2 0 0 1 4.21 16.88L4.27 16.82A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.09 14H3A2 2 0 0 1 1 12V12A2 2 0 0 1 3 10H3.09A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L4.21 7.12A2 2 0 0 1 4.21 4.29L4.23 4.27A2 2 0 0 1 7.06 4.27L7.12 4.33A1.65 1.65 0 0 0 8.94 4.66H8.94A1.65 1.65 0 0 0 9.94 3.15V3.06A2 2 0 0 1 11.94 1.06H12.06A2 2 0 0 1 14.06 3.06V3.15A1.65 1.65 0 0 0 15.06 4.66H15.06A1.65 1.65 0 0 0 16.88 4.33L16.94 4.27A2 2 0 0 1 19.77 4.27L19.79 4.29A2 2 0 0 1 19.79 7.12L19.73 7.18A1.65 1.65 0 0 0 19.4 9V9A1.65 1.65 0 0 0 20.91 10H21A2 2 0 0 1 23 12V12A2 2 0 0 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z" />
                </svg>
                <span>Cài đặt</span>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-text-primary hover:bg-hover-bg"
              >
                <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1 1 0 011.35-.936l.547.182a8 8 0 104.58 4.58l.182.547a1 1 0 01-.936 1.35h-1.017a1 1 0 01-.992-.876l-.156-1.248a1 1 0 01.29-.867l.72-.72a6 6 0 11-6.873-1.4z" />
                </svg>
                <span>{themeMode === 'light' ? 'Ban đêm' : 'Ban ngày'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleNavigation(`/profile/${user?.id ?? ''}`, { closeMenu: true })
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
                  handleNavigation('/notifications', { closeMenu: true })
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
                onClick={() => {
                  setShowMobileMenu(false)
                  setConfirmLogoutOpen(true)
                }}
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
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-40 border-b border-border-light transition-all duration-300 ease-out',
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
          : 'bg-white/90 backdrop-blur-md shadow-sm'
      )}
    >
      <div className="md:hidden">
        <div className={cn(
          'flex items-center justify-between px-3 transition-all duration-300 ease-out',
          scrolled ? 'h-12' : 'h-14'
        )}>
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${user?.id ?? ''}`}
              onClick={(event) => handleLinkNavigation(event, `/profile/${user?.id ?? ''}`)}
              className={actionButtonClass}
              aria-label="Trang cá nhân"
            >
              <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
            </Link>
            <Link
              to="/"
              onClick={(event) => handleLinkNavigation(event, '/')}
              className={cn(
                'text-3xl font-extrabold leading-none text-primary-500 transition-opacity duration-300',
                scrolled ? 'opacity-80' : 'opacity-100'
              )}
              aria-label="EduSocial"
            >
              edusocial
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className={actionButtonClass}
              aria-label="Tìm kiếm"
            >
              <svg className="relative z-10 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <Link
              to="/chat"
              onClick={(event) => handleLinkNavigation(event, '/chat')}
              className={cn(actionButtonClass, 'relative')}
              aria-label="Tin nhắn"
            >
              <svg className="relative z-10 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              className={actionButtonClass}
              aria-label="Mở menu"
              aria-expanded={showMobileMenu}
            >
              <svg className="relative z-10 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  onClick={(event) => handleLinkNavigation(event, item.to)}
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
              onClick={(event) => handleLinkNavigation(event, `/profile/${user?.id ?? ''}`)}
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

      <div
        className={cn(
          'hidden grid-cols-[minmax(0,1fr)_minmax(0,520px)_minmax(0,1fr)] items-center gap-3 px-4 transition-all duration-300 ease-out md:grid',
          scrolled ? 'h-12' : 'h-14'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5" aria-label="EduSocial - Trang chủ">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-blue-600 shadow-[0_8px_18px_rgba(24,119,242,0.35)]">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <span
              className={cn(
                'text-xl font-bold text-primary-600 transition-opacity duration-300',
                scrolled ? 'opacity-70' : 'opacity-100'
              )}
            >
              EduSocial
            </span>
          </Link>
        </div>

        {!isSearchPage && <form onSubmit={handleSearch} className="mx-auto w-full max-w-[520px]">
          <div className="relative transition-all duration-300 focus-within:scale-[1.01]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Tìm kiếm EduSocial..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-app-bg pl-10 pr-4 text-sm transition-all duration-300 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Tìm kiếm"
            />
          </div>
        </form>}

        <div className="flex items-center justify-end gap-2">
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(m => !m)}
              className="relative overflow-hidden flex items-center rounded-full p-0.5 transition-all duration-300 hover:text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 before:absolute before:inset-0 before:rounded-full before:bg-primary-500/12 before:opacity-0 before:scale-75 before:transition-all before:duration-300 hover:before:opacity-100 hover:before:scale-100"
              aria-label="Menu tài khoản"
              aria-expanded={showUserMenu}
            >
              <span className="relative z-10">
                <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 z-50 w-56 origin-top-right rounded-lg border border-border-light bg-white/90 py-1 shadow-lg backdrop-blur-md animate-[scaleIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)]">
                <Link to={`/profile/${user?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hover-bg" onClick={() => setShowUserMenu(false)}>
                  <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{user?.displayName}</p>
                    <p className="text-xs text-text-secondary">Xem trang cá nhân</p>
                  </div>
                </Link>
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-hover-bg"
                  onClick={openSettingsModal}
                >
                  Cài đặt tài khoản
                </button>
                <button
                  onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-text-primary hover:bg-hover-bg"
                >
                  <span>{themeMode === 'light' ? 'Ban đêm' : 'Ban ngày'}</span>
                  <span aria-hidden="true">{themeMode === 'light' ? '🌙' : '☀️'}</span>
                </button>
                <hr className="my-1 border-border-light" />
                <button
                  onClick={() => setConfirmLogoutOpen(true)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-error-500 hover:bg-hover-bg"
                >
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
        title="Xác nhận đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản hiện tại?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        tone="warning"
      />
    </header>
  )
}
