import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPanel } from './RightPanel'
import { FloatingChat } from './FloatingChat'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { connectSocket, disconnectSocket, emitCallReject } from '@/socket/socketClient'
import { useNotificationStore } from '@/store/notificationStore'
import { authApi } from '@/api/auth'
import { Notification, notificationsApi } from '@/api/index'
import { friendsApi } from '@/api/users'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { cn } from '@/utils/cn'

const PENDING_INCOMING_CALL_KEY = 'pendingIncomingCall'

interface IncomingCallPopupState {
  fromUserId: string
  fromEmail?: string
  conversationId: string
  offer: RTCSessionDescriptionInit
}

export default function UserLayout() {
  const { token, updateUser, clearAuth } = useAuthStore()
  const { addNotification, setUnreadSummary, setFriendRequestCount } = useNotificationStore()
  const queryClient = useQueryClient()
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')
  const isGroupsPage = location.pathname.startsWith('/groups')
  const isFeedPage = location.pathname === '/'
  const isProfilePage = location.pathname.startsWith('/profile')
  const isNotificationsPage = location.pathname.startsWith('/notifications')
  const isFriendsPage = location.pathname.startsWith('/friends')
  const isSearchPage = location.pathname.startsWith('/search')
  const isDocumentsPage = location.pathname.startsWith('/documents')
  const isUnifiedWidePage =
    isGroupsPage || isFeedPage || isProfilePage || isNotificationsPage || isFriendsPage || isDocumentsPage
  const shouldShowRightPanel = !isChatPage && !isGroupsPage && !isProfilePage && !isSearchPage && !isDocumentsPage
  const topPaddingClass = isChatPage ? 'pt-[56px]' : 'pt-[var(--topbar-height)]'
  const toast = useToast()
  const navigate = useNavigate()
  const [isXlUp, setIsXlUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : false
  )
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  )
  // Dùng ref để tránh đưa location.pathname vào dependency array của socket effect
  const pathnameRef = useRef(location.pathname)
  const lastUnreadRefetchAtRef = useRef(0)
  const [incomingCallPopup, setIncomingCallPopup] = useState<IncomingCallPopupState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const { data: unreadSummary, refetch: refetchUnreadSummary } = useQuery({
    queryKey: ['unread-summary'],
    queryFn: notificationsApi.getUnreadSummary,
    enabled: !!token,
    refetchOnWindowFocus: false,
  })

  const { data: friendReqCount } = useQuery({
    queryKey: ['friend-request-count'],
    queryFn: friendsApi.getRequestCount,
    enabled: !!token,
    refetchInterval: 30_000, // check every 30s
    staleTime: 20_000,
  })

  useEffect(() => {
    if (!unreadSummary) return
    setUnreadSummary(unreadSummary)
  }, [unreadSummary, setUnreadSummary])

  useEffect(() => {
    setFriendRequestCount(friendReqCount ?? 0)
  }, [friendReqCount, setFriendRequestCount])

  useEffect(() => {
    const mediaXl = window.matchMedia('(min-width: 1280px)')
    const mediaLg = window.matchMedia('(min-width: 1024px)')
    const onXlChange = (e: MediaQueryListEvent) => setIsXlUp(e.matches)
    const onLgChange = (e: MediaQueryListEvent) => setIsLgUp(e.matches)
    setIsXlUp(mediaXl.matches)
    setIsLgUp(mediaLg.matches)
    mediaXl.addEventListener('change', onXlChange)
    mediaLg.addEventListener('change', onLgChange)
    return () => {
      mediaXl.removeEventListener('change', onXlChange)
      mediaLg.removeEventListener('change', onLgChange)
    }
  }, [])

  // Cập nhật ref mỗi khi pathname thay đổi mà không trigger socket effect
  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)
    const refetchUnreadSummaryThrottled = () => {
      const now = Date.now()
      if (now - lastUnreadRefetchAtRef.current < 2500) return
      lastUnreadRefetchAtRef.current = now
      refetchUnreadSummary()
    }

    const handleNewNotification = (notification: Notification) => {
      addNotification(notification)
      refetchUnreadSummaryThrottled()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    const handleNewMessage = () => {
      refetchUnreadSummaryThrottled()
    }

    const handleConnect = () => {
      refetchUnreadSummaryThrottled()
    }

    const handleIncomingCall = (payload: IncomingCallPopupState) => {
      // Dùng ref thay vì location.pathname để không cần re-register listener khi navigate
      if (pathnameRef.current.startsWith('/chat')) return
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
  }, [token, addNotification, refetchUnreadSummary, queryClient, toast, clearAuth, navigate])

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

  useEffect(() => {
    const handleOpenSettingsModal = () => setSettingsOpen(true)
    window.addEventListener('open-settings-modal', handleOpenSettingsModal)
    return () => window.removeEventListener('open-settings-modal', handleOpenSettingsModal)
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  return (
    <div className="min-h-screen overflow-x-hidden bg-app-bg">
      <TopBar />
      <div className={`flex ${topPaddingClass}`}>
        {/* Left Sidebar — width-transitions in sync with main content */}
        <aside
          className="hidden lg:block fixed left-0 top-[var(--topbar-height)] bottom-0 overflow-y-auto overflow-x-hidden border-r border-border-light bg-white/95 backdrop-blur-xl transition-[width] duration-300 ease-in-out z-30"
          style={{ width: sidebarExpanded ? 240 : 68 }}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <LeftSidebar />
        </aside>

        {/* Main Content — padding-left is synced with sidebar via inline style on inner div */}
        <main
          className={cn(
            'w-full min-w-0',
            'pb-16 lg:pb-0',
            shouldShowRightPanel && !isChatPage && !isGroupsPage ? 'xl:pr-[320px]' : ''
          )}
        >
          {/* Inner wrapper: smoothly shifts right when sidebar expands */}
          <div
            style={{
              paddingLeft: isLgUp ? `${sidebarExpanded ? 240 : 68}px` : 0,
              transition: 'padding-left 300ms ease-in-out'
            }}
          >
            <div
              className={
                isChatPage
                  ? 'h-[calc(100vh-56px)]'
                  : isSearchPage
                    ? 'w-full px-0 sm:px-4 xl:px-8 py-2 sm:py-4'
                  : isProfilePage
                    ? 'max-w-[1500px] mx-auto px-0 sm:px-4 xl:px-5 py-2 sm:py-4'
                    : isUnifiedWidePage
                      ? 'max-w-[1280px] mx-auto px-0 sm:px-5 xl:px-7 py-2 sm:py-4'
                      : 'max-w-3xl mx-auto px-0 sm:px-4 py-2 sm:py-4'
              }
            >
              <Outlet />
            </div>
          </div>
        </main>

        {/* Right Panel */}
        {shouldShowRightPanel && isXlUp && (
          <aside className="flex flex-col fixed right-0 top-[var(--topbar-height)] bottom-0 w-[320px] overflow-y-auto p-3 border-l border-border-light bg-white/85 backdrop-blur-xl">
            <RightPanel />
          </aside>
        )}
      </div>

      {/* Floating chat button — Instagram style, bottom-right */}
      <FloatingChat />
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          settingsOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!settingsOpen}
      >
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => setSettingsOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full bg-white border-l border-border-light shadow-2xl transition-transform duration-300 ease-out overflow-y-auto ${
            settingsOpen ? 'translate-x-0' : 'translate-x-full'
          } w-full max-w-full sm:w-[78vw] sm:max-w-[78vw] lg:w-[25vw] lg:max-w-[25vw]`}
          role="dialog"
          aria-modal="true"
          aria-label="Cài đặt"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-gradient-to-b from-primary-50 to-white px-4 py-3">
            <h2 className="text-lg font-semibold text-text-primary">Cài đặt</h2>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-hover-bg"
              aria-label="Đóng cài đặt"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <SettingsPanel inModal />
          </div>
        </aside>
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
