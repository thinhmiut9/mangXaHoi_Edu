import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, Conversation, Message } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/utils/format'
import { cn } from '@/utils/cn'
import {
  connectSocket,
  joinConversation,
  leaveConversation,
  emitTyping,
  emitStopTyping,
  emitCallOffer,
  emitCallAnswer,
  emitCallIceCandidate,
  emitCallReject,
  emitCallHangup,
} from '@/socket/socketClient'
import { notificationsApi } from '@/api/index'
import { useNotificationStore } from '@/store/notificationStore'
import { friendsApi } from '@/api/users'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'in-call'

interface IncomingCallState {
  fromUserId: string
  fromEmail?: string
  conversationId: string
  offer: RTCSessionDescriptionInit
}

const PENDING_INCOMING_CALL_KEY = 'pendingIncomingCall'

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId)
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()
  const { setUnreadSummary } = useNotificationStore()
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [menuConvId, setMenuConvId] = useState<string | null>(null)
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<{ id: string; name: string } | null>(null)
  const [listTab, setListTab] = useState<'all' | 'unread' | 'group'>('all')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [sortMode, setSortMode] = useState<'recent' | 'unread' | 'name'>('recent')
  const [mutedConversationIds, setMutedConversationIds] = useState<Record<string, boolean>>({})
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [callPeerUserId, setCallPeerUserId] = useState<string | null>(null)
  const [callConversationId, setCallConversationId] = useState<string | null>(null)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const toast = useToast()

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
  })

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => chatApi.getMessages(activeConvId!),
    enabled: !!activeConvId,
  })

  const sendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(activeConvId!, message),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const { data: friends } = useQuery({
    queryKey: ['friends'],
    queryFn: friendsApi.getFriends,
  })

  const startChatMutation = useMutation({
    mutationFn: (friendId: string) => chatApi.getOrCreateConversation(friendId),
    onSuccess: (conv) => {
      setActiveConvId(conv.id)
      setNewChatOpen(false)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const openDirectConversation = (friendId: string) => {
    if (!friendId) return
    const existingConversation = conversations?.find(
      (conv) => !conv.isGroup && conv.participants.some((participant) => participant.id === friendId)
    )

    if (existingConversation) {
      setActiveConvId(existingConversation.id)
      setNewChatOpen(false)
      return
    }

    startChatMutation.mutate(friendId)
  }

  const markReadMutation = useMutation({
    mutationFn: (convId: string) => chatApi.markConversationRead(convId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      const summary = await notificationsApi.getUnreadSummary()
      setUnreadSummary(summary)
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: (convId: string) => chatApi.deleteConversation(convId),
    onSuccess: (_, convId) => {
      if (activeConvId === convId) setActiveConvId(undefined)
      setMenuConvId(null)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.removeQueries({ queryKey: ['messages', convId] })
      toast.success('Da xoa cuoc tro chuyen o phia ban')
    },
    onError: (err) => {
      toast.error(extractError(err))
    },
  })

  const releaseCallResources = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null
      peerConnectionRef.current.ontrack = null
      peerConnectionRef.current.onconnectionstatechange = null
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    pendingIceCandidatesRef.current = []
  }

  const resetCallState = () => {
    releaseCallResources()
    setCallStatus('idle')
    setIncomingCall(null)
    setCallPeerUserId(null)
    setCallConversationId(null)
    setIsMicMuted(false)
  }

  const setupPeerConnection = (peerUserId: string, conversationRef: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      emitCallIceCandidate({
        toUserId: peerUserId,
        conversationId: conversationRef,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream || !remoteAudioRef.current) return
      remoteAudioRef.current.srcObject = stream
      void remoteAudioRef.current.play().catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('in-call')
        return
      }

      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        const wasInCall = callStatus !== 'idle' && callStatus !== 'incoming'
        resetCallState()
        if (wasInCall) toast.info('Cuộc gọi đã kết thúc')
      }
    }

    peerConnectionRef.current = pc
    setCallPeerUserId(peerUserId)
    setCallConversationId(conversationRef)
    return pc
  }

  const startVoiceCall = async () => {
    if (!activeConvId || !otherParticipant?.id) return
    if (callStatus !== 'idle') {
      toast.info('Bạn đang có cuộc gọi khác')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream

      const pc = setupPeerConnection(otherParticipant.id, activeConvId)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      emitCallOffer({
        toUserId: otherParticipant.id,
        conversationId: activeConvId,
        offer,
      })

      setCallStatus('calling')
      toast.info(`Đang gọi thoại cho ${otherParticipant.displayName}...`)
    } catch {
      resetCallState()
      toast.error('Không thể truy cập micro để thực hiện cuộc gọi')
    }
  }

  const acceptIncomingCall = async () => {
    if (!incomingCall) return
    try {
      sessionStorage.removeItem(PENDING_INCOMING_CALL_KEY)
      if (incomingCall.conversationId !== activeConvId) {
        setActiveConvId(incomingCall.conversationId)
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream

      const pc = setupPeerConnection(incomingCall.fromUserId, incomingCall.conversationId)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      for (const candidate of pendingIceCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      pendingIceCandidatesRef.current = []

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      emitCallAnswer({
        toUserId: incomingCall.fromUserId,
        conversationId: incomingCall.conversationId,
        answer,
      })

      setIncomingCall(null)
      setCallStatus('connecting')
    } catch {
      resetCallState()
      toast.error('Không thể nhận cuộc gọi lúc này')
    }
  }

  const rejectIncomingCall = () => {
    if (!incomingCall) return
    sessionStorage.removeItem(PENDING_INCOMING_CALL_KEY)
    emitCallReject({
      toUserId: incomingCall.fromUserId,
      conversationId: incomingCall.conversationId,
    })
    setIncomingCall(null)
    setCallStatus('idle')
  }

  const hangupCall = () => {
    if (callPeerUserId && callConversationId) {
      emitCallHangup({ toUserId: callPeerUserId, conversationId: callConversationId })
    }
    resetCallState()
  }

  // Socket setup
  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)
    let joinedConversationId: string | undefined
    if (activeConvId) {
      joinConversation(activeConvId)
      joinedConversationId = activeConvId
    }

    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === activeConvId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] })
        if (activeConvId) markReadMutation.mutate(activeConvId)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }

    const handleTypingEvent = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId !== activeConvId) return
      if (data.userId !== user?.id) setOtherTyping(true)
    }

    const handleStopTypingEvent = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId !== activeConvId) return
      if (data.userId !== user?.id) setOtherTyping(false)
    }

    const handleCallOffer = (payload: {
      fromUserId: string
      fromEmail?: string
      conversationId: string
      offer: RTCSessionDescriptionInit
    }) => {
      if (!payload?.fromUserId || !payload?.conversationId || !payload?.offer) return

      if (callStatus !== 'idle') {
        emitCallReject({
          toUserId: payload.fromUserId,
          conversationId: payload.conversationId,
        })
        toast.info('Bạn đang bận cuộc gọi khác')
        return
      }

      setIncomingCall({
        fromUserId: payload.fromUserId,
        fromEmail: payload.fromEmail,
        conversationId: payload.conversationId,
        offer: payload.offer,
      })
      setCallStatus('incoming')
      toast.info(`Cuộc gọi đến${payload.fromEmail ? ` từ ${payload.fromEmail}` : ''}`)
    }

    const handleCallAnswer = async (payload: {
      fromUserId: string
      conversationId: string
      answer: RTCSessionDescriptionInit
    }) => {
      if (!payload?.answer || payload.conversationId !== callConversationId || payload.fromUserId !== callPeerUserId) return
      try {
        const pc = peerConnectionRef.current
        if (!pc) return
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
        pendingIceCandidatesRef.current = []
        setCallStatus('connecting')
      } catch {
        resetCallState()
        toast.error('Không thể kết nối cuộc gọi')
      }
    }

    const handleCallIceCandidate = async (payload: {
      fromUserId: string
      conversationId: string
      candidate: RTCIceCandidateInit
    }) => {
      if (!payload?.candidate || payload.conversationId !== callConversationId || payload.fromUserId !== callPeerUserId) return
      const pc = peerConnectionRef.current
      if (!pc) return
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch {
          // Ignore malformed candidate from client side.
        }
      } else {
        pendingIceCandidatesRef.current.push(payload.candidate)
      }
    }

    const handleCallReject = (payload: { fromUserId: string; conversationId: string }) => {
      if (payload.conversationId !== callConversationId || payload.fromUserId !== callPeerUserId) return
      resetCallState()
      toast.info('Người nhận đã từ chối cuộc gọi')
    }

    const handleCallHangup = (payload: { fromUserId: string; conversationId: string }) => {
      if (payload.conversationId !== callConversationId || payload.fromUserId !== callPeerUserId) return
      resetCallState()
      toast.info('Đối phương đã kết thúc cuộc gọi')
    }

    socket.on('new-message', handleNewMessage)
    socket.on('typing', handleTypingEvent)
    socket.on('stop-typing', handleStopTypingEvent)
    socket.on('call:offer', handleCallOffer)
    socket.on('call:answer', handleCallAnswer)
    socket.on('call:ice-candidate', handleCallIceCandidate)
    socket.on('call:reject', handleCallReject)
    socket.on('call:hangup', handleCallHangup)

    return () => {
      if (joinedConversationId) leaveConversation(joinedConversationId)
      socket.off('new-message', handleNewMessage)
      socket.off('typing', handleTypingEvent)
      socket.off('stop-typing', handleStopTypingEvent)
      socket.off('call:offer', handleCallOffer)
      socket.off('call:answer', handleCallAnswer)
      socket.off('call:ice-candidate', handleCallIceCandidate)
      socket.off('call:reject', handleCallReject)
      socket.off('call:hangup', handleCallHangup)
    }
  }, [token, activeConvId, user?.id, queryClient, callStatus, callConversationId, callPeerUserId, toast])

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)

    const onOnlineList = (payload: { userIds?: string[] }) => setOnlineUsers(payload.userIds ?? [])
    const onUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => (prev.includes(userId) ? prev : [...prev, userId]))
    }
    const onUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId))
    }

    socket.on('online-users', onOnlineList)
    socket.on('user-online', onUserOnline)
    socket.on('user-offline', onUserOffline)

    return () => {
      socket.off('online-users', onOnlineList)
      socket.off('user-online', onUserOnline)
      socket.off('user-offline', onUserOffline)
    }
  }, [token])

  useEffect(() => {
    setOtherTyping(false)
    setShowInfoPanel(false)
  }, [activeConvId])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeConvId || !messages?.length) return
    markReadMutation.mutate(activeConvId)
  }, [activeConvId, messages])

  useEffect(() => {
    if (callStatus !== 'idle') return
    try {
      const raw = sessionStorage.getItem(PENDING_INCOMING_CALL_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as IncomingCallState
      if (!parsed?.fromUserId || !parsed?.conversationId || !parsed?.offer) return
      setIncomingCall(parsed)
      setCallStatus('incoming')
    } catch {
      // Ignore invalid storage payload.
    }
  }, [callStatus])

  useEffect(() => {
    return () => {
      releaseCallResources()
    }
  }, [])

  const handleTyping = () => {
    if (!isTyping && activeConvId) {
      setIsTyping(true)
      emitTyping(activeConvId, user?.displayName ?? '')
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      if (activeConvId) emitStopTyping(activeConvId)
    }, 2000)
  }

  const activeConv = conversations?.find(c => c.id === activeConvId)
  const otherParticipant = activeConv?.participants.find(p => p.id !== user?.id)
  const incomingCaller =
    incomingCall
      ? conversations
        ?.flatMap((conv) => conv.participants)
        .find((participant) => participant.id === incomingCall.fromUserId)
      : undefined
  const onlineSet = useMemo(() => new Set(onlineUsers), [onlineUsers])
  const toMs = (value?: string) => (value ? new Date(value).getTime() : 0)
  const getConversationTime = (conv: Conversation) =>
    toMs(conv.lastMessage?.createdAt ?? (conv as any).lastMessageAt ?? (conv as any).updatedAt ?? (conv as any).createdAt)
  const getConversationPeerName = (conv: Conversation) => {
    const peer = conv.participants.find((p) => p.id !== user?.id)
    return (peer?.displayName ?? '').trim()
  }
  const friendAvatars = useMemo(
    () => (friends ?? []).filter(f => f.id !== user?.id).slice(0, 20),
    [friends, user?.id]
  )
  const conversationList = useMemo(() => {
    const src = [...(conversations ?? [])]
    const filtered = src.filter((conv) => {
      if (listTab === 'unread') return conv.unreadCount > 0
      if (listTab === 'group') return !!conv.isGroup
      return true
    })
    filtered.sort((a, b) => {
      if (sortMode === 'name') return getConversationPeerName(a).localeCompare(getConversationPeerName(b), 'vi')
      if (sortMode === 'unread') {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
        return getConversationTime(b) - getConversationTime(a)
      }
      return getConversationTime(b) - getConversationTime(a)
    })
    return filtered
  }, [conversations, listTab, sortMode, user?.id])

  const openConversation = (convId: string) => {
    setActiveConvId(convId)
    setMenuConvId(null)
    queryClient.setQueryData<Conversation[] | undefined>(['conversations'], (prev) =>
      prev?.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    )
    markReadMutation.mutate(convId)
  }

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 flex h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] bg-[#F5F7FA] gap-3 md:gap-4 overflow-hidden">
      
      {/* COLUMN 1: Chat List */}
      <div className={cn('w-full md:w-[340px] lg:w-[360px] flex-shrink-0 flex flex-col', activeConvId ? 'hidden md:flex' : 'flex')}>
        <div className="flex justify-between items-center mb-3 px-1.5">
          <div className="flex flex-col">
            <h2 className="text-[34px] leading-[1.05] font-black text-text-primary tracking-tight">Tin nhắn</h2>
            <span className="text-[14px] text-text-muted font-semibold mt-0.5">{conversationList.length} cuộc trò chuyện gần đây</span>
          </div>
          <button
            onClick={() => setSortMenuOpen(v => !v)}
            className="relative h-11 text-[14px] text-text-secondary font-semibold hover:bg-white px-4 rounded-full transition-colors flex items-center gap-1.5 shadow-sm bg-white ring-1 ring-gray-200/70"
          >
            Bộ lọc <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
            {sortMenuOpen && (
              <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-gray-200 bg-white shadow-lg p-1 text-left">
                {[
                  { key: 'recent', label: 'Mới nhất' },
                  { key: 'unread', label: 'Ưu tiên chưa đọc' },
                  { key: 'name', label: 'Tên A-Z' },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSortMode(option.key as 'recent' | 'unread' | 'name')
                      setSortMenuOpen(false)
                    }}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-sm hover:bg-gray-50',
                      sortMode === option.key ? 'font-semibold text-primary-600' : 'text-gray-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </button>
        </div>

        <div className="flex gap-2.5 mb-4 px-1.5">
          <button
            onClick={() => setListTab('all')}
            className={cn(
              'h-11 px-5 rounded-full text-[16px] transition-all ring-1',
              listTab === 'all'
                ? 'bg-white shadow-sm text-primary-600 font-bold ring-primary-100'
                : 'bg-white/80 hover:bg-white text-text-secondary font-semibold ring-gray-200/70'
            )}
          >
            Tất cả
          </button>
          <button
            onClick={() => setListTab('unread')}
            className={cn(
              'h-11 px-5 rounded-full text-[16px] transition-all ring-1',
              listTab === 'unread'
                ? 'bg-white shadow-sm text-primary-600 font-bold ring-primary-100'
                : 'bg-white/80 hover:bg-white text-text-secondary font-semibold ring-gray-200/70'
            )}
          >
            Chưa đọc
          </button>
          <button
            onClick={() => setListTab('group')}
            className={cn(
              'h-11 px-5 rounded-full text-[16px] transition-all ring-1',
              listTab === 'group'
                ? 'bg-white shadow-sm text-primary-600 font-bold ring-primary-100'
                : 'bg-white/80 hover:bg-white text-text-secondary font-semibold ring-gray-200/70'
            )}
          >
            Nhóm
          </button>
        </div>

        <div className="mb-4 px-1.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-text-secondary">Bạn bè</p>
            <button
              onClick={() => setNewChatOpen(true)}
              className="text-[12px] font-semibold text-primary-600 hover:underline"
            >
              Xem tất cả
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {friendAvatars.length === 0 ? (
              <p className="text-[12px] text-text-muted py-1">Chưa có bạn bè để hiển thị.</p>
            ) : (
              friendAvatars.map(friend => {
                const isOnline = onlineSet.has(friend.id)
                return (
                  <button
                    key={friend.id}
                    onClick={() => openDirectConversation(friend.id)}
                    disabled={startChatMutation.isPending}
                    className="group flex flex-col items-center min-w-[62px]"
                    title={`${friend.displayName}${isOnline ? ' (Đang hoạt động)' : ''}`}
                  >
                    <div className="relative">
                      <Avatar src={friend.avatar} name={friend.displayName} size="md" className="w-12 h-12 ring-2 ring-white shadow-sm" />
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white',
                          isOnline ? 'bg-success-500' : 'bg-gray-300'
                        )}
                      />
                    </div>
                    <span className="mt-1 text-[11px] text-gray-600 font-medium truncate max-w-[62px] group-hover:text-gray-900">
                      {friend.displayName}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4 scrollbar-thin">
          {convsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !conversationList.length ? (
            <div className="py-8"><EmptyState title="Trống" icon={<span className="text-3xl opacity-80">💬</span>} /></div>
          ) : (
            conversationList.map(conv => {
              const other = conv.participants.find(p => p.id !== user?.id)
              const isActive = conv.id === activeConvId
              const isUnread = conv.unreadCount > 0
              return (
                <div
                  key={conv.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-conv-menu="true"]')) return
                    openConversation(conv.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openConversation(conv.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'w-full flex items-center gap-3 p-3.5 text-left rounded-2xl border transition-colors transition-shadow duration-150',
                    isActive
                      ? 'bg-white shadow-md border-primary-100 ring-1 ring-primary-100/50'
                      : isUnread
                        ? 'bg-blue-100/70 border-blue-300 shadow-sm hover:shadow-md hover:bg-blue-100'
                        : 'bg-white border-transparent shadow-sm hover:shadow-md hover:bg-gray-50'
                  )}
                >
                  <div className="relative">
                    <Avatar
                      src={other?.avatar}
                      name={other?.displayName ?? ''}
                      size="md"
                      className={cn('w-12 h-12 shadow-sm', isUnread && !isActive && 'ring-2 ring-blue-300')}
                    />
                    {isActive && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={cn("text-[15px] truncate", isActive || isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>{other?.displayName}</p>
                      {conv.lastMessage && <span className={cn("text-[11px] flex-shrink-0 ml-1 font-medium", isUnread ? "text-primary-600" : "text-gray-400")}>{timeAgo(conv.lastMessage.createdAt)}</span>}
                    </div>
                    {conv.lastMessage && (
                      <p className={cn("text-[13px] truncate", isUnread ? "text-gray-900 font-semibold" : "text-gray-500")}>{conv.lastMessage.content}</p>
                    )}
                  </div>
                  <div className="relative flex items-center gap-1">
                    {conv.unreadCount > 0 && (
                      <span className="min-w-[22px] h-[22px] bg-primary-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                    <button
                      data-conv-menu="true"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenuConvId(prev => (prev === conv.id ? null : conv.id))
                      }}
                      className="h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 inline-flex items-center justify-center"
                      aria-label="Tùy chọn cuộc trò chuyện"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
                      </svg>
                    </button>
                    {menuConvId === conv.id && (
                      <div
                        data-conv-menu="true"
                        className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-gray-200 bg-white shadow-lg py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          data-conv-menu="true"
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            markReadMutation.mutate(conv.id)
                            setMenuConvId(null)
                          }}
                        >
                          Đánh dấu đã đọc
                        </button>
                        <button
                          data-conv-menu="true"
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          disabled={deleteConversationMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!conv.id) {
                              toast.error('Không tìm thấy mã cuộc trò chuyện')
                              return
                            }
                            setMenuConvId(null)
                            setConfirmDeleteConv({
                              id: conv.id,
                              name: other?.displayName || 'người dùng này',
                            })
                          }}
                        >
                          {deleteConversationMutation.isPending ? 'Dang xoa...' : 'Xoa phia toi'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          
          <button onClick={() => setNewChatOpen(true)} className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-gray-300 rounded-2xl text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors font-medium text-sm">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
             Tạo cuộc trò chuyện mới
          </button>
        </div>
      </div>

      {/* COLUMN 2: Chat Window */}
      {activeConvId ? (
        <div className={cn('relative flex-1 min-w-0 bg-white rounded-[24px] shadow-sm ring-1 ring-gray-100 flex flex-col overflow-hidden', !activeConvId ? 'hidden md:flex' : 'flex')}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 lg:px-6 py-4 border-b border-gray-100/80 bg-white/80 backdrop-blur-sm z-10">
            <div className="flex min-w-0 items-center gap-3.5">
              <button className="md:hidden p-2 -ml-2 text-gray-400 hover:bg-gray-100 rounded-full" onClick={() => setActiveConvId(undefined)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              </button>
              <Avatar src={otherParticipant?.avatar} name={otherParticipant?.displayName ?? ''} size="md" online={true} />
              <div className="min-w-0">
                <h3 className="truncate font-bold text-[17px] text-gray-900 leading-tight">{otherParticipant?.displayName}</h3>
                {otherTyping ? (
                  <p className="truncate text-[13px] text-primary-500 font-medium animate-pulse mt-0.5">Đang nhập tin nhắn...</p>
                ) : (
                  <p className="truncate text-[13px] text-success-500 font-medium mt-0.5">Đang hoạt động - Phản hồi rất nhanh</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
              <button
                onClick={() => void startVoiceCall()}
                disabled={callStatus !== 'idle'}
                className={cn(
                  "hidden sm:inline-flex items-center gap-2 h-10 lg:h-11 px-3 lg:px-4 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap",
                  callStatus === 'idle'
                    ? "bg-gray-50 hover:bg-gray-100 text-gray-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <span className="hidden 2xl:inline">Gọi thoại</span>
              </button>
              <button
                onClick={() => toast.info(`Đang gọi video với ${otherParticipant?.displayName ?? 'người dùng'}...`)}
                className="hidden sm:inline-flex items-center gap-2 h-10 lg:h-11 px-3 lg:px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span className="hidden 2xl:inline">Gọi video</span>
              </button>
              <button
                onClick={() => {
                  if (!otherParticipant?.id) return
                  navigate(`/profile/${otherParticipant.id}`)
                }}
                className="inline-flex items-center justify-center h-10 lg:h-11 px-3 lg:px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap"
              >
                 <span className="hidden 2xl:inline">Xem hồ sơ</span>
                 <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <svg className="hidden sm:block 2xl:hidden w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </button>
              <button
                onClick={() => setShowInfoPanel(v => !v)}
                className="inline-flex items-center justify-center h-10 w-10 lg:h-11 lg:w-11 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-colors"
                title="Tùy chọn"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white/50">
            {msgsLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
              messages?.map((msg, idx) => {
                const isOwn = msg.senderId === user?.id
                // just a mock timestamp
                const isStartOfDay = idx === 0 || new Date(msg.createdAt).getDay() !== new Date(messages[idx-1].createdAt).getDay()
                return (
                  <div key={msg.id} className="flex flex-col">
                    {isStartOfDay && <div className="text-center my-6"><span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-3 py-1 rounded-full">{new Date(msg.createdAt).toLocaleDateString()}</span></div>}
                    <div className={cn('flex items-end gap-2.5', isOwn && 'flex-row-reverse')}>
                      {!isOwn && <Avatar src={msg.sender?.avatar} name={msg.sender?.displayName ?? ''} size="xs" className="mb-4" />}
                      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                        <div className={cn(
                           'max-w-[85%] lg:max-w-[450px] px-5 py-3.5 rounded-[20px] text-[15px] shadow-sm leading-relaxed',
                           isOwn
                             ? 'bg-primary-600 text-white rounded-br-sm'
                             : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                         )}>
                           {msg.content}
                         </div>
                         <span className="text-[11px] text-gray-400 mt-1 font-medium px-1">
                           {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 sm:p-5 bg-white border-t border-gray-100 z-10">
            <div className="flex items-center gap-2 sm:gap-3 bg-gray-50/80 ring-1 ring-gray-200/60 rounded-[24px] p-2 focus-within:ring-primary-500/50 focus-within:bg-white transition-all shadow-inner">
              <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 rounded-full transition-colors flex-shrink-0" title="Thêm">
                <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              
              <input
                type="text"
                value={message}
                onChange={e => { setMessage(e.target.value); handleTyping() }}
                placeholder="Nhập tin nhắn..."
                className="flex-1 bg-transparent px-2 py-2 text-[15px] font-medium text-gray-800 focus:outline-none placeholder-gray-400"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                    e.preventDefault()
                    if (!sendMutation.isPending) sendMutation.mutate()
                  }
                }}
              />
              
              <div className="flex items-center gap-1 pr-1 flex-shrink-0">
                <button className="hidden xl:flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 font-semibold text-[13px] bg-transparent hover:bg-gray-200/50 rounded-full transition-colors mr-1">
                   Đính kèm
                </button>
                <button
                  onClick={() => sendMutation.mutate()}
                  disabled={!message.trim() || sendMutation.isPending}
                  className={cn(
                    "h-11 min-w-[44px] xl:min-w-[126px] px-3 xl:px-5 rounded-full inline-flex items-center justify-center gap-2 font-bold text-[14px] transition-all duration-200 whitespace-nowrap",
                    message.trim() ? "bg-primary-600 text-white shadow-md hover:bg-primary-700 hover:scale-105 active:scale-95" : "bg-gray-200 text-gray-400"
                  )}
                >
                  <span className="hidden xl:inline">Gửi tin nhắn</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5L21 3l-8.5 18-2.5-7L3 11.5z"></path></svg>
                </button>
              </div>
            </div>
          </div>

          {showInfoPanel && activeConvId && otherParticipant && (
            <>
              <button
                className="hidden lg:block absolute inset-0 bg-black/10 z-20"
                onClick={() => setShowInfoPanel(false)}
                aria-label="Đóng thông tin"
              />
              <div className="hidden lg:flex absolute right-0 top-0 h-full w-[300px] 2xl:w-[330px] bg-[#F5F7FA] border-l border-gray-200 z-30 p-4 flex-col gap-4 overflow-y-auto">
                <div className="bg-white rounded-[24px] p-6 shadow-sm ring-1 ring-gray-100 flex flex-col items-center">
                  <Avatar src={otherParticipant.avatar} name={otherParticipant.displayName} className="w-24 h-24 mb-4 ring-4 ring-gray-50 shadow-md" />
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{otherParticipant.displayName}</h3>
                  <p className="text-[13px] text-gray-500 font-medium mb-6 text-center">Bạn bè - Học nhóm Web Development</p>
                  <div className="grid grid-cols-2 gap-2.5 w-full">
                    <button
                      onClick={() => navigate(`/profile/${otherParticipant.id}`)}
                      className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                    >
                      Trang cá nhân
                    </button>
                    <button
                      onClick={() => {
                        if (!activeConvId) return
                        setMutedConversationIds((prev) => {
                          const next = { ...prev, [activeConvId]: !prev[activeConvId] }
                          toast.success(next[activeConvId] ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật lại thông báo cuộc trò chuyện')
                          return next
                        })
                      }}
                      className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                    >
                      {activeConvId && mutedConversationIds[activeConvId] ? 'Bật thông báo' : 'Tắt thông báo'}
                    </button>
                    <button
                      onClick={() => {
                        const keyword = window.prompt('Nhập từ khóa cần tìm trong cuộc chat:')
                        if (!keyword) return
                        const found = (messages ?? []).find((m) => m.content?.toLowerCase().includes(keyword.toLowerCase()))
                        if (!found) return toast.info('Không tìm thấy nội dung phù hợp')
                        toast.success('Đã tìm thấy trong cuộc trò chuyện')
                      }}
                      className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                    >
                      Tìm trong chat
                    </button>
                    <button
                      onClick={() => toast.info('Tính năng chặn đang được phát triển')}
                      className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                    >
                      Chặn
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[24px] p-5 shadow-sm ring-1 ring-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-extrabold text-[15px] text-gray-900">Tệp đã chia sẻ</h4>
                    <button className="text-[13px] text-primary-600 font-bold hover:underline">Xem tất cả</button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3.5 p-3.5 bg-gray-50 rounded-[18px] ring-1 ring-gray-200/50">
                      <div className="w-12 h-12 bg-blue-100/50 text-blue-600 rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-gray-900 truncate">UI_Chat_Flow.pdf</p>
                        <p className="text-[12px] text-gray-500 font-medium">2.4 MB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5 p-3.5 bg-gray-50 rounded-[18px] ring-1 ring-gray-200/50">
                      <div className="w-12 h-12 bg-blue-100/50 text-blue-600 rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-gray-900 truncate">Meeting_Notes.docx</p>
                        <p className="text-[12px] text-gray-500 font-medium">880 KB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-transparent">
          <div className="max-w-md text-center bg-white p-10 rounded-[32px] shadow-xl shadow-primary-500/5 border border-white">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
              <span className="text-5xl drop-shadow-sm">💬</span>
            </div>
            <h2 className="text-[26px] font-black text-gray-900 mb-3 tracking-tight">Cổng kết nối thế giới</h2>
            <p className="text-gray-500 text-[15px] font-medium leading-relaxed mb-8 px-4">Giữ liên lạc với bạn bè, đồng nghiệp và nhóm học của bạn với trải nghiệm nhắn tin hoàn toàn mới.</p>
            <Button className="rounded-full px-8 py-4 h-auto text-[15px] shadow-lg shadow-primary-500/20 hover:-translate-y-1 transition-transform font-bold" onClick={() => setNewChatOpen(true)}>Bắt đầu trò chuyện ngay</Button>
          </div>
        </div>
      )}
      {(menuConvId || sortMenuOpen) && (
        <button
          className="fixed inset-0 z-10 cursor-default"
          aria-hidden="true"
          onClick={() => {
            setMenuConvId(null)
            setSortMenuOpen(false)
          }}
        />
      )}
      {/* New Chat Modal */}
      <Modal open={newChatOpen} onClose={() => setNewChatOpen(false)} title="Tạo tin nhắn mới" size="md">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {!friends ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : friends.length === 0 ? (
            <div className="py-8 text-center text-text-muted">Bạn chưa có người bạn nào để nhắn tin.</div>
          ) : (
            friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => openDirectConversation(friend.id)}
                disabled={startChatMutation.isPending}
                className="w-full flex items-center gap-3 p-3 hover:bg-hover-bg rounded-xl transition-colors text-left"
              >
                <Avatar src={friend.avatar} name={friend.displayName} size="md" />
                <div className="flex-1">
                  <p className="font-semibold text-text-primary text-[15px]">{friend.displayName}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal
        open={!!confirmDeleteConv}
        onClose={() => {
          if (deleteConversationMutation.isPending) return
          setConfirmDeleteConv(null)
        }}
        title="Xóa cuộc trò chuyện"
        size="sm"
        closeOnOverlay={!deleteConversationMutation.isPending}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteConv(null)}
              disabled={deleteConversationMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={deleteConversationMutation.isPending}
              onClick={() => {
                if (!confirmDeleteConv?.id) return
                deleteConversationMutation.mutate(confirmDeleteConv.id, {
                  onSettled: () => setConfirmDeleteConv(null),
                })
              }}
            >
              Xóa phía tôi
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[15px] text-gray-700 leading-relaxed">
            Bạn có chắc muốn xóa cuộc trò chuyện với{' '}
            <span className="font-semibold text-gray-900">{confirmDeleteConv?.name}</span> ở phía bạn?
          </p>
          <p className="text-[13px] text-gray-500">
            Người còn lại vẫn giữ cuộc trò chuyện và tin nhắn của họ.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!incomingCall}
        onClose={rejectIncomingCall}
        title="Cuộc gọi đến"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={rejectIncomingCall}>Từ chối</Button>
            <Button onClick={() => void acceptIncomingCall()}>Nhận cuộc gọi</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[15px] text-gray-700">
            {incomingCaller?.displayName ?? incomingCall?.fromEmail ?? 'Người dùng'} đang gọi thoại cho bạn.
          </p>
          <p className="text-[13px] text-gray-500">Nhấn "Nhận cuộc gọi" để bắt đầu trò chuyện bằng giọng nói.</p>
        </div>
      </Modal>

      <Modal
        open={callStatus !== 'idle' && callStatus !== 'incoming'}
        onClose={hangupCall}
        title="Cuộc gọi thoại"
        size="sm"
        closeOnOverlay={false}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                const nextMuted = !isMicMuted
                setIsMicMuted(nextMuted)
                localStreamRef.current?.getAudioTracks().forEach((track) => {
                  track.enabled = !nextMuted
                })
              }}
            >
              {isMicMuted ? 'Bật mic' : 'Tắt mic'}
            </Button>
            <Button variant="danger" onClick={hangupCall}>
              Kết thúc
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[16px] font-semibold text-gray-900">
            {otherParticipant?.displayName ?? incomingCaller?.displayName ?? 'Người dùng'}
          </p>
          <p className="text-[14px] text-gray-600">
            {callStatus === 'calling' && 'Đang đổ chuông...'}
            {callStatus === 'connecting' && 'Đang kết nối cuộc gọi...'}
            {callStatus === 'in-call' && 'Đang trong cuộc gọi thoại'}
          </p>
        </div>
      </Modal>

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  )
}

