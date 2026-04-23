import { create } from 'zustand'
import { Notification } from '@/api/index'

interface NotificationState {
  unreadCount: number
  unreadNotificationCount: number
  unreadMessageCount: number
  friendRequestCount: number
  notifications: Notification[]
  setUnreadCount: (count: number) => void
  setUnreadSummary: (summary: { notificationCount: number; messageCount: number }) => void
  setFriendRequestCount: (count: number) => void
  addNotification: (n: Notification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  setNotifications: (ns: Notification[]) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  unreadNotificationCount: 0,
  unreadMessageCount: 0,
  friendRequestCount: 0,
  notifications: [],
  setUnreadCount: (count) => set({ unreadCount: count, unreadNotificationCount: count }),
  setUnreadSummary: (summary) => set({
    unreadNotificationCount: summary.notificationCount,
    unreadMessageCount: summary.messageCount,
    unreadCount: summary.notificationCount,
  }),
  setFriendRequestCount: (count) => set({ friendRequestCount: count }),
  addNotification: (n) => set(state => ({
    notifications: [n, ...state.notifications],
    unreadNotificationCount: n.type === 'MESSAGE'
      ? state.unreadNotificationCount
      : state.unreadNotificationCount + 1,
    unreadMessageCount: n.type === 'MESSAGE'
      ? state.unreadMessageCount + 1
      : state.unreadMessageCount,
    unreadCount: n.type === 'MESSAGE'
      ? state.unreadCount
      : state.unreadCount + 1,
    friendRequestCount: n.type === 'FRIEND_REQUEST'
      ? state.friendRequestCount + 1
      : state.friendRequestCount,
  })),
  markRead: (id) => set(state => {
    const target = state.notifications.find(n => n.id === id)
    const wasUnread = !!target && !target.isRead
    const isMessage = target?.type === 'MESSAGE'
    return {
      notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
      unreadNotificationCount: wasUnread && !isMessage
        ? Math.max(0, state.unreadNotificationCount - 1)
        : state.unreadNotificationCount,
      unreadMessageCount: wasUnread && isMessage
        ? Math.max(0, state.unreadMessageCount - 1)
        : state.unreadMessageCount,
      unreadCount: wasUnread && !isMessage
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }
  }),
  markAllRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0,
    unreadNotificationCount: 0,
    unreadMessageCount: 0,
  })),
  setNotifications: (ns) => set({ notifications: ns }),
}))
