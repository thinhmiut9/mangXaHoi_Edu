import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi, notificationsApi } from '@/api/index'
import { postsApi } from '@/api/posts'
import { useNotificationStore } from '@/store/notificationStore'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/utils/cn'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator'

type ActiveFilter = 'ALL' | 'UNREAD' | 'SYSTEM' | 'INTERACTION' | 'MESSAGE'
type SortMode = 'NEWEST' | 'OLDEST'

interface NotificationGroup {
  label: string
  key: string
  items: ReturnType<typeof mapNotification>[number][]
}

function isToday(date: Date) {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function isYesterday(date: Date) {
  const now = new Date()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  return date.getFullYear() === y.getFullYear() && date.getMonth() === y.getMonth() && date.getDate() === y.getDate()
}

function mapNotificationType(type: string) {
  if (type.includes('MESSAGE')) return 'MESSAGE'
  if (type.includes('FRIEND') || type.includes('GROUP') || type.includes('ADMIN')) return 'SYSTEM'
  return 'INTERACTION' // POST_REACT, POST_COMMENT, NEW_POST, MENTION
}

function mapNotification(notifications: any[]) {
  return (notifications ?? []).map((n) => {
    const created = new Date(n.createdAt)
    const diffDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
    return {
      ...n,
      category: mapNotificationType(n.type || ''),
      created,
      isValidDate: !Number.isNaN(created.getTime()),
      timeText: !Number.isNaN(created.getTime()) ? created.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      dayBucket: !Number.isNaN(created.getTime())
        ? isToday(created)
          ? 'today'
          : isYesterday(created)
            ? 'yesterday'
            : diffDays <= 7
              ? 'last7days'
              : 'older'
        : 'older',
    }
  })
}

function groupNotifications(items: ReturnType<typeof mapNotification>): NotificationGroup[] {
  const map: Record<string, NotificationGroup> = {
    today: { key: 'today', label: 'Hôm nay', items: [] },
    yesterday: { key: 'yesterday', label: 'Hôm qua', items: [] },
    last7days: { key: 'last7days', label: '7 ngày trước', items: [] },
    older: { key: 'older', label: 'Cũ hơn', items: [] },
  }
  items.forEach((item) => map[item.dayBucket]?.items.push(item))
  return [map.today, map.yesterday, map.last7days, map.older].filter((g) => g.items.length > 0)
}

function getTypeBadge(category: string) {
  if (category === 'MESSAGE') return { dot: 'bg-sky-500', label: 'Tin nhắn' }
  if (category === 'SYSTEM') return { dot: 'bg-amber-500', label: 'Hệ thống' }
  return { dot: 'bg-rose-500', label: 'Tương tác' }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { markAllRead, markRead, setUnreadSummary } = useNotificationStore()

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('ALL')
  const [sortMode, setSortMode] = useState<SortMode>('NEWEST')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: async (_data, id) => {
      markRead(id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      const summary = await notificationsApi.getUnreadSummary()
      setUnreadSummary(summary)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      markAllRead()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      notificationsApi.getUnreadSummary().then(setUnreadSummary).catch(() => {})
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      const summary = await notificationsApi.getUnreadSummary()
      setUnreadSummary(summary)
      toast.success('Đã xóa thông báo')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const mapped = useMemo(() => mapNotification(notifications ?? []), [notifications])
  const unreadCount = mapped.filter((n) => !n.isRead).length
  const unreadMessageCount = mapped.filter((n) => !n.isRead && n.category === 'MESSAGE').length

  const filtered = useMemo(() => {
    let next = mapped
    if (activeFilter === 'UNREAD') next = next.filter((n) => !n.isRead)
    if (activeFilter === 'SYSTEM') next = next.filter((n) => n.category === 'SYSTEM')
    if (activeFilter === 'INTERACTION') next = next.filter((n) => n.category === 'INTERACTION')
    if (activeFilter === 'MESSAGE') next = next.filter((n) => n.category === 'MESSAGE')

    next = [...next].sort((a, b) => {
      const av = a.created.getTime()
      const bv = b.created.getTime()
      return sortMode === 'NEWEST' ? bv - av : av - bv
    })
    return next
  }, [mapped, activeFilter, sortMode])

  const grouped = useMemo(() => groupNotifications(filtered), [filtered])
  const refreshPage = useCallback(async () => {
    await refetch()
  }, [refetch])
  const { pullDistance, isRefreshing } = usePullToRefresh(refreshPage)

  const markSingleRead = async (id: string, isRead: boolean) => {
    if (isRead) return
    await markReadMutation.mutateAsync(id)
  }

  const navigateByNotification = async (notif: ReturnType<typeof mapNotification>[number]) => {
    const entityType = String(notif.entityType || '').toUpperCase()
    const entityId = notif.entityId

    if (notif.type === 'MENTION' && entityType === 'POST' && entityId) {
      navigate(`/posts/${entityId}`)
      return
    }
    // Fallback cho thông báo cũ có entityType là COMMENT
    if (entityType === 'COMMENT' && entityId) {
      try {
        const postId = await postsApi.getPostIdByComment(entityId)
        if (postId) {
          navigate(`/posts/${postId}`)
          return
        }
      } catch (error) {
        console.error('Không thể lấy postId từ comment:', error)
      }
    }
    if (entityType === 'POST' && entityId) {
      navigate(`/posts/${entityId}`)
      return
    }
    if (notif.type === 'GROUP_REQUEST') {
      navigate('/groups?action=requests')
      return
    }
    if (entityType === 'GROUP' && entityId) {
      navigate(`/groups/${entityId}`)
      return
    }
    if (entityType === 'USER' && entityId) {
      navigate(`/profile/${entityId}`)
      return
    }
    if (entityType === 'CONVERSATION' && entityId) {
      navigate(`/chat/${entityId}`)
      return
    }
    if (notif.type?.includes('MESSAGE') && notif.senderId) {
      const conversation = await chatApi.getOrCreateConversation(notif.senderId)
      navigate(`/chat/${conversation.id}`)
      return
    }
    if (notif.type?.includes('FRIEND') && notif.senderId) {
      navigate(`/profile/${notif.senderId}`)
      return
    }
    if (notif.type?.includes('POST') && entityId) {
      navigate(`/posts/${entityId}`)
      return
    }
    if (notif.type?.includes('MESSAGE')) {
      navigate('/chat')
      return
    }
    navigate('/')
  }

  const handleNotificationClick = async (notif: ReturnType<typeof mapNotification>[number]) => {
    try {
      await markSingleRead(notif.id, notif.isRead)
      await navigateByNotification(notif)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  return (
    <div className='relative'>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 160ms ease-out' : undefined,
        }}
      >
      <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[38px] font-extrabold leading-none text-slate-900">Thông báo</h1>
            <p className="mt-2 text-sm text-slate-500">Theo dõi hoạt động mới nhất liên quan đến tài khoản của bạn</p>
          </div>
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
              onClick={() => setOpenMenuId((prev) => (prev === '__global__' ? null : '__global__'))}
            >
              Đánh dấu tất cả đã đọc
              <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path d="M5.25 7.5L10 12.25L14.75 7.5" /></svg>
            </button>
            {openMenuId === '__global__' && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    markAllMutation.mutate()
                    setOpenMenuId(null)
                  }}
                  disabled={markAllMutation.isPending || unreadCount === 0}
                >
                  Đánh dấu tất cả đã đọc
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'UNREAD', label: `Chưa đọc ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
            { key: 'SYSTEM', label: 'Hệ thống' },
            { key: 'INTERACTION', label: 'Tương tác' },
            { key: 'MESSAGE', label: `Tin nhắn ${unreadMessageCount > 0 ? `(${unreadMessageCount})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as ActiveFilter)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                activeFilter === tab.key ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {tab.label}
            </button>
          ))}

          <div className="ml-auto">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            title="Không có thông báo"
            description="Khi có hoạt động mới, thông báo sẽ xuất hiện ở đây."
            icon={<span className="text-3xl">🔔</span>}
          />
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 text-sm font-bold text-slate-500">{group.label}</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  {group.items.map((notif) => {
                    const badge = getTypeBadge(notif.category)
                    const isDeleting = deleteNotificationMutation.isPending && deleteNotificationMutation.variables === notif.id
                    return (
                      <div
                        key={notif.id}
                        className={cn(
                          'group relative flex items-start gap-3 border-b border-slate-100 bg-white px-4 py-3 last:border-b-0',
                          !notif.isRead && 'bg-blue-50/40'
                        )}
                      >
                        <div className="relative mt-0.5">
                          <Avatar src={notif.sender?.avatar} name={notif.sender?.displayName ?? 'U'} size="md" />
                          <span className={cn('absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white', badge.dot)} />
                        </div>

                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleNotificationClick(notif)}>
                          <p className="truncate text-[15px] leading-5 text-slate-800">
                            <span className="font-bold">{notif.sender?.displayName || 'Hệ thống'}</span>{' '}
                            {notif.message}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span>{notif.timeText}</span>
                            <span>•</span>
                            <span className="text-blue-600 hover:underline">Xem chi tiết</span>
                          </div>
                        </div>

                        <div className="relative">
                          <button
                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            onClick={() => setOpenMenuId((prev) => (prev === notif.id ? null : notif.id))}
                          >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                            </svg>
                          </button>

                          {openMenuId === notif.id && (
                            <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={async () => {
                                  await markSingleRead(notif.id, notif.isRead)
                                  setOpenMenuId(null)
                                }}
                              >
                                Đánh dấu đã đọc
                              </button>
                              <button
                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:text-rose-300"
                                disabled={isDeleting}
                                onClick={() => {
                                  deleteNotificationMutation.mutate(notif.id)
                                  setOpenMenuId(null)
                                }}
                              >
                                {isDeleting ? 'Đang xóa...' : 'Xóa thông báo'}
                              </button>
                            </div>
                          )}
                        </div>

                        {!notif.isRead && <span className="absolute right-4 top-3 h-2.5 w-2.5 rounded-full bg-blue-500" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
      </div>
    </div>
  )
}
