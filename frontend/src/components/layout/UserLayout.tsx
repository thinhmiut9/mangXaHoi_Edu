import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPanel } from './RightPanel'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { connectSocket, disconnectSocket, emitCallReject } from '@/socket/socketClient'
import { useNotificationStore } from '@/store/notificationStore'
import { authApi } from '@/api/auth'
import { Notification, notificationsApi } from '@/api/index'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const PENDING_INCOMING_CALL_KEY = 'pendingIncomingCall'

interface IncomingCallPopupState {
  fromUserId: string
  fromEmail?: string
  conversationId: string
  offer: RTCSessionDescriptionInit
}

export default function UserLayout() {
  const { token, updateUser, clearAuth } = useAuthStore()
  const { addNotification, setUnreadSummary } = useNotificationStore()
  const queryClient = useQueryClient()
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')
  const isGroupsPage = location.pathname.startsWith('/groups')
  const isFeedPage = location.pathname === '/'
  const isProfilePage = location.pathname.startsWith('/profile')
  const isNotificationsPage = location.pathname.startsWith('/notifications')
  const isFriendsPage = location.pathname.startsWith('/friends')
  const isUnifiedWidePage = isGroupsPage || isFeedPage || isProfilePage || isNotificationsPage || isFriendsPage
  const topPaddingClass = isChatPage ? 'pt-[56px]' : 'pt-[var(--topbar-height)]'
  const toast = useToast()
  const navigate = useNavigate()
  const [incomingCallPopup, setIncomingCallPopup] = useState<IncomingCallPopupState | null>(null)

  const { data: unreadSummary, refetch: refetchUnreadSummary } = useQuery({
    queryKey: ['unread-summary'],
    queryFn: notificationsApi.getUnreadSummary,
    enabled: !!token,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!unreadSummary) return
    setUnreadSummary(unreadSummary)
  }, [unreadSummary, setUnreadSummary])

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)

    const handleNewNotification = (notification: Notification) => {
      addNotification(notification)
      refetchUnreadSummary()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    const handleNewMessage = () => {
      refetchUnreadSummary()
    }

    const handleConnect = () => {
      refetchUnreadSummary()
    }

    const handleIncomingCall = (payload: IncomingCallPopupState) => {
      if (location.pathname.startsWith('/chat')) return
      setIncomingCallPopup(payload)
      try {
        sessionStorage.setItem(PENDING_INCOMING_CALL_KEY, JSON.stringify(payload))
      } catch {
        // ignore storage failures
      }
    }

    const handleAccountBlocked = (payload?: { blockedUntil?: string }) => {
      disconnectSocket()
      clearAuth()
      const suffix = payload?.blockedUntil ? ` đến ${new Date(payload.blockedUntil).toLocaleString('vi-VN')}` : ''
      toast.error(`Tài khoản của bạn đã bị khóa${suffix}`)
      navigate('/login', { replace: true })
    }

    socket.on('new-notification', handleNewNotification)
    socket.on('new-message', handleNewMessage)
    socket.on('connect', handleConnect)
    socket.on('call:offer', handleIncomingCall)
    socket.on('account-blocked', handleAccountBlocked)

    return () => {
      socket.off('new-notification', handleNewNotification)
      socket.off('new-message', handleNewMessage)
      socket.off('connect', handleConnect)
      socket.off('call:offer', handleIncomingCall)
      socket.off('account-blocked', handleAccountBlocked)
    }
  }, [token, addNotification, refetchUnreadSummary, queryClient, location.pathname, toast, clearAuth, navigate])

  const handleCloseIncomingCallPopup = () => {
    if (incomingCallPopup?.fromUserId && incomingCallPopup?.conversationId) {
      emitCallReject({
        toUserId: incomingCallPopup.fromUserId,
        conversationId: incomingCallPopup.conversationId,
      })
    }
    try {
      sessionStorage.removeItem(PENDING_INCOMING_CALL_KEY)
    } catch {
      // ignore
    }
    setIncomingCallPopup(null)
  }

  const handleOpenIncomingCallChat = () => {
    if (!incomingCallPopup?.conversationId) return
    navigate(`/chat/${incomingCallPopup.conversationId}`)
    setIncomingCallPopup(null)
    toast.info('Đã mở cuộc trò chuyện để bạn nhận cuộc gọi')
  }

  useEffect(() => {
    if (!token) return
    authApi.me()
      .then(freshUser => updateUser(freshUser))
      .catch(() => {
        // Global interceptor already handles auth failures.
      })
  }, [token, updateUser])

  return (
    <div className="min-h-screen bg-app-bg">
      <TopBar />
      <div className={`flex ${topPaddingClass}`}>
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-[var(--topbar-height)] bottom-0 w-[280px] overflow-y-auto p-2 border-r border-border-light bg-white">
          <LeftSidebar />
        </aside>

        {/* Main Content */}
        <main className={isChatPage || isGroupsPage ? "flex-1 lg:ml-[280px] min-w-0" : "flex-1 lg:ml-[280px] xl:mr-[320px] min-w-0"}>
          <div
            className={
              isChatPage
                ? "h-[calc(100vh-56px)]"
                : isUnifiedWidePage
                  ? "max-w-[1280px] mx-auto px-5 xl:px-7 py-4"
                  : "max-w-3xl mx-auto px-4 py-4"
            }
          >
            <Outlet />
          </div>
        </main>

        {/* Right Panel */}
        {!isChatPage && !isGroupsPage && (
          <aside className="hidden xl:flex flex-col fixed right-0 top-[var(--topbar-height)] bottom-0 w-[320px] overflow-y-auto p-3 border-l border-border-light bg-white">
            <RightPanel />
          </aside>
        )}
      </div>
      <Modal
        open={!!incomingCallPopup}
        onClose={handleCloseIncomingCallPopup}
        title="Cuộc gọi đến"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseIncomingCallPopup}>
              Từ chối
            </Button>
            <Button onClick={handleOpenIncomingCallChat}>
              Nhận cuộc gọi
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[15px] text-gray-700">
            {incomingCallPopup?.fromEmail ?? 'Một người dùng'} đang gọi thoại cho bạn.
          </p>
          <p className="text-[13px] text-gray-500">
            Bấm "Nhận cuộc gọi" để mở khung chat và kết nối ngay.
          </p>
        </div>
      </Modal>
    </div>
  )
}
