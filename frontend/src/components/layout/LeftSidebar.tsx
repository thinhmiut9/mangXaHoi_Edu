import { Link, useLocation } from 'react-router-dom'
import type { MouseEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/utils/cn'

type Item = {
  to: string
  label: string
  icon: JSX.Element
  badge?: number
}

const iconClass = 'h-[22px] w-[22px] flex-shrink-0'

const items: Item[] = [
  {
    to: '/',
    label: 'Trang chủ',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M3 10.5 12 3l9 7.5v9.5a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z' />
      </svg>
    ),
  },
  {
    to: '/friends',
    label: 'Bạn bè',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' />
        <path d='M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' />
        <path d='M2.5 19.5c.7-2.6 3.2-4.5 6-4.5s5.3 1.9 6 4.5' />
        <path d='M14.5 19.5c.5-1.9 2.4-3.3 4.5-3.3 1.2 0 2.2.3 3 .9' />
      </svg>
    ),
  },
  {
    to: '/groups',
    label: 'Nhóm',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </svg>
    ),
  },
  {
    to: '/saved',
    label: 'Đã lưu',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' />
      </svg>
    ),
  },
  {
    to: '/documents',
    label: 'Kho tài liệu',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z' />
        <path d='M15 3v5h5' />
        <path d='M8 13h8' />
        <path d='M8 17h6' />
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'Tin nhắn',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.6-.3-3.7-.8L3 21l1.3-5.2A8.5 8.5 0 1 1 21 12Z' />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'Thông báo',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='M14.5 20a2.5 2.5 0 0 1-5 0' />
        <path d='M4 17h16l-2.2-2.5V10a5.8 5.8 0 0 0-11.6 0v4.5L4 17Z' />
      </svg>
    ),
  },
]

// ─── Mobile bottom nav: only show the 5 most important items ───
const mobileItems = ['/', '/friends', '/chat', '/notifications', '/groups']

export function LeftSidebar() {
  const { user } = useAuthStore()
  const { unreadNotificationCount, unreadMessageCount, friendRequestCount } = useNotificationStore()
  const location = useLocation()
  const queryClient = useQueryClient()

  const navItems = items.map((item) => ({
    ...item,
    badge:
      item.to === '/chat'
        ? unreadMessageCount
        : item.to === '/notifications'
          ? unreadNotificationCount
          : item.to === '/friends'
            ? friendRequestCount
            : undefined,
  }))

  const isItemActive = (to: string) =>
    to === '/'
      ? location.pathname === '/'
      : to === '/documents'
        ? location.pathname.startsWith('/documents')
        : location.pathname.startsWith(to)

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    if (isItemActive(to)) {
      event.preventDefault()
      queryClient.invalidateQueries()
      queryClient.refetchQueries({ type: 'active' })
    }
  }

  return (
    <>
      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR — icon-only → hover to expand
          Width collapses to 68px, expands to 240px on group-hover
          ══════════════════════════════════════════ */}
      <nav className='group flex h-full flex-col gap-1 py-3 overflow-hidden'>
        {/* User avatar card — shrinks to just the avatar when collapsed */}
        <Link
          to={`/profile/${user?.id}`}
          className='flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-1 hover:bg-slate-100 transition-all duration-200'
        >
          <Avatar src={user?.avatar} name={user?.displayName ?? ''} size='md' />
          {/* Label fades in on hover */}
          <div className='min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden'>
            <p className='truncate text-sm font-semibold text-slate-800 leading-tight'>{user?.displayName}</p>
            <p className='truncate text-xs text-slate-400'>{user?.bio?.trim() || 'Thành viên EduSocial'}</p>
          </div>
        </Link>

        <hr className='mb-1 border-border-light mx-2' />

        <div className='flex-1 space-y-0.5'>
          {navItems.map((item) => {
            const isActive = isItemActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={(event) => handleNavClick(event, item.to)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 overflow-hidden',
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full' />
                )}

                <span className='relative flex-shrink-0'>{item.icon}</span>

                {/* Label: hidden when sidebar collapsed, visible on hover */}
                <span className='text-[15px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                  {item.label}
                </span>

                {/* Badge */}
                {!!item.badge && (
                  <span
                    className={cn(
                      'ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white flex-shrink-0',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Badge dot — visible even when collapsed */}
                {!!item.badge && (
                  <span className='absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 group-hover:hidden' />
                )}
              </Link>
            )
          })}
        </div>

        <div className='mt-auto'>
          <hr className='border-border-light mx-2 mb-2' />
          <p className='px-3 text-[11px] text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
            © 2024 EduSocial
          </p>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAVIGATION BAR
          Shown only on mobile (< lg), fixed at bottom
          ══════════════════════════════════════════ */}
      <nav
        className='lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-white border-t border-border-light px-2 py-1 safe-area-inset-bottom'
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        {navItems
          .filter(item => mobileItems.includes(item.to))
          .map((item) => {
            const isActive = isItemActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={(event) => handleNavClick(event, item.to)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-xl p-2 min-w-[44px] transition-colors',
                  isActive ? 'text-primary-600' : 'text-slate-500'
                )}
              >
                {item.icon}
                <span className='text-[10px] font-medium'>{item.label}</span>
                {!!item.badge && (
                  <span className='absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white'>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            )
          })}
      </nav>
    </>
  )
}
