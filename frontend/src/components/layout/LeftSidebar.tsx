import { Link, useLocation } from 'react-router-dom'
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

const iconClass = 'h-[22px] w-[22px]'

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
        <path d='M3 10.5 12 3l9 7.5v9.5a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z' />
      </svg>
    ),
  },
  {
    to: '/saved',
    label: 'Đã lưu',
    icon: (
      <svg className={iconClass} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
        <path d='m9 3 11 11-8 8L1 11l8-8Z' />
        <circle cx='7.5' cy='7.5' r='1' />
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

export function LeftSidebar() {
  const { user } = useAuthStore()
  const { unreadNotificationCount, unreadMessageCount } = useNotificationStore()
  const location = useLocation()

  const navItems = items.map((item) => ({
    ...item,
    badge:
      item.to === '/chat'
        ? unreadMessageCount
        : item.to === '/notifications'
          ? unreadNotificationCount
          : undefined,
  }))

  return (
    <nav className='flex h-full flex-col gap-2 py-2'>
      <Link
        to={`/profile/${user?.id}`}
        className='rounded-3xl border border-border-light bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition hover:border-primary-200'
      >
        <div className='flex items-center gap-3'>
          <Avatar src={user?.avatar} name={user?.displayName ?? ''} size='md' />
          <div className='min-w-0'>
            <p className='truncate text-lg font-semibold text-slate-800'>{user?.displayName}</p>
            <p className='truncate text-sm text-slate-500'>{user?.bio?.trim() || 'Thành viên EduSocial'}</p>
          </div>
        </div>
      </Link>

      <hr className='my-1 border-border-light' />

      <div className='space-y-1'>
        {navItems.map((item) => {
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[17px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary-50 text-primary-600 shadow-[0_8px_16px_rgba(37,99,235,0.15)]'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <span className='text-current'>{item.icon}</span>
              <span className='flex-1'>{item.label}</span>
              {!!item.badge && (
                <span className='flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white'>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div className='mt-auto space-y-2'>
        <hr className='border-border-light' />
        <p className='px-2 text-sm text-slate-400'>© 2024 EduSocial</p>
      </div>
    </nav>
  )
}
