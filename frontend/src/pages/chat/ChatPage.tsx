import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, uploadsApi, Conversation, Message } from '@/api/index'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'in-call'

/** Renders message text with clickable links */
const URL_REGEX = /(https?:\/\/[^\s]+)/g

function renderMessageBubble(msg: import('@/api/index').Message, isOwn: boolean) {
  // IMAGE
  if (msg.type === 'IMAGE' && msg.mediaUrl) {
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={msg.mediaUrl}
          alt={msg.fileName ?? 'ảnh'}
          className="max-w-[260px] max-h-[220px] rounded-2xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    )
  }
  // VIDEO
  if (msg.type === 'VIDEO' && msg.mediaUrl) {
    return (
      <video
        src={msg.mediaUrl}
        controls
        className="max-w-[280px] rounded-2xl"
        style={{ maxHeight: 220 }}
      />
    )
  }
  // FILE
  if (msg.type === 'FILE' && msg.mediaUrl) {
    return (
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-3 p-3 rounded-2xl ring-1 min-w-[200px] max-w-[280px] no-underline transition-colors shadow-sm',
          isOwn ? 'bg-primary-600 ring-primary-500 hover:bg-primary-700' : 'bg-white ring-gray-200 hover:bg-gray-50'
        )}
      >
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isOwn ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-500')}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', isOwn ? 'text-white' : 'text-gray-800')}>{msg.fileName ?? 'Tệp đính kèm'}</p>
          <p className={cn('text-[11px]', isOwn ? 'text-white/80' : 'text-gray-400')}>
            {msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Tải xuống'}
          </p>
        </div>
        <svg className={cn('w-4 h-4 flex-shrink-0', isOwn ? 'text-white/80' : 'text-gray-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      </a>
    )
  }
  // LINK
  if (msg.type === 'LINK') {
    const url = msg.mediaUrl ?? msg.content
    let hostname = ''
    try { hostname = new URL(url).hostname } catch { hostname = url }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-3 p-3 rounded-2xl ring-1 min-w-[200px] max-w-[280px] no-underline transition-colors shadow-sm',
          isOwn ? 'bg-primary-600 ring-primary-500 hover:bg-primary-700' : 'bg-white ring-gray-200 hover:bg-gray-50'
        )}
      >
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isOwn ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', isOwn ? 'text-white' : 'text-gray-800')}>{url}</p>
          <p className={cn('text-[11px]', isOwn ? 'text-white/80' : 'text-gray-400')}>{hostname}</p>
        </div>
      </a>
    )
  }
  // TEXT (default) — render with clickable URL detection
  const parts = msg.content.split(URL_REGEX)
  return (
    <span className="whitespace-pre-wrap break-normal">
      {parts.map((part, i) => {
        if (!part.startsWith('http://') && !part.startsWith('https://')) return <span key={i}>{part}</span>
        const linkClass = `underline break-all ${isOwn ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={linkClass}>{part}</a>
      })}
    </span>
  )
}

function renderLastMessagePreview(conv: import('@/api/index').Conversation, currentUserId?: string) {
  if (!conv.lastMessage) return null
  const isOwn = conv.lastMessage.senderId === currentUserId
  let prefix = ''
  if (isOwn) {
    prefix = 'Bạn: '
  } else if (conv.isGroup) {
    const sender = conv.participants.find(p => p.id === conv.lastMessage?.senderId)
    if (sender) prefix = `${sender.displayName.split(' ').pop()}: `
  }

  switch (conv.lastMessage.type) {
    case 'IMAGE': return `${prefix}đã gửi một ảnh`
    case 'VIDEO': return `${prefix}đã gửi một video`
    case 'FILE': return `${prefix}đã gửi một file`
    default: return `${prefix}${conv.lastMessage.content}`
  }
}

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
  const [mutedConversationIds, setMutedConversationIds] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('mutedConvs') || '{}') } catch { return {} }
  })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  // Group chat
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('')
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('')
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [callPeerUserId, setCallPeerUserId] = useState<string | null>(null)
  const [callConversationId, setCallConversationId] = useState<string | null>(null)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const toast = useToast()

  const [editingGroupName, setEditingGroupName] = useState(false)
  const [editGroupNameValue, setEditGroupNameValue] = useState('')
  const [isUpdatingGroupAvatar, setIsUpdatingGroupAvatar] = useState(false)

  // Persist mute state to localStorage
  const toggleMute = useCallback((convId: string) => {
    setMutedConversationIds(prev => {
      const next = { ...prev, [convId]: !prev[convId] }
      localStorage.setItem('mutedConvs', JSON.stringify(next))
      return next
    })
  }, [])

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmojiPicker])

  // Close attach menu when clicking outside
  useEffect(() => {
    if (!showAttachMenu) return
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAttachMenu])

  const { data: conversations, isLoading: convsLoading, isError: convsError, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
  })

  const { data: messages, isLoading: msgsLoading, isError: msgsError, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => chatApi.getMessages(activeConvId!),
    enabled: !!activeConvId,
  })

  const sendMutation = useMutation({
    mutationFn: () => {
      const trimmed = message.trim()
      // If the entire message is a URL, send as LINK type
      const urlMatch = trimmed.match(/^(https?:\/\/[^\s]+)$/)
      if (urlMatch) {
        return chatApi.sendMessage(activeConvId!, trimmed, {
          type: 'LINK',
          mediaUrl: trimmed,
        })
      }
      return chatApi.sendMessage(activeConvId!, trimmed)
    },
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] })
      queryClient.invalidateQueries({ queryKey: ['media-messages', activeConvId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const { data: mediaMessages } = useQuery({
    queryKey: ['media-messages', activeConvId],
    queryFn: () => chatApi.getMediaMessages(activeConvId!),
    enabled: !!activeConvId && showInfoPanel,
  })

  const sendMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const mimeType = file.type
      const isImage = mimeType.startsWith('image/')
      const isVideo = mimeType.startsWith('video/')
      let mediaUrl = ''
      let msgType: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE'
      if (isImage) {
        const res = await uploadsApi.uploadImage(file, 'images')
        mediaUrl = res.url
        msgType = 'IMAGE'
      } else if (isVideo) {
        const res = await uploadsApi.uploadVideo(file)
        mediaUrl = res.url
        msgType = 'VIDEO'
      } else {
        const res = await uploadsApi.uploadDocument(file)
        mediaUrl = res.url
        msgType = 'FILE'
      }
      return chatApi.sendMessage(activeConvId!, file.name, {
        type: msgType,
        mediaUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] })
      queryClient.invalidateQueries({ queryKey: ['media-messages', activeConvId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowAttachMenu(false)
      toast.success('Gửi thành công!')
    },
    onError: () => toast.error('Gửi thất bại, vui lòng thử lại'),
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

  const createGroupMutation = useMutation({
    mutationFn: () => chatApi.createGroupConversation(groupName.trim(), selectedFriendIds, groupAvatarUrl || undefined),
    onSuccess: (conv) => {
      setActiveConvId(conv.id)
      setNewGroupOpen(false)
      setGroupName('')
      setSelectedFriendIds([])
      setGroupAvatarUrl('')
      setGroupAvatarPreview('')
      setIsUploadingGroupAvatar(false)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Tạo nhóm thành công!')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const updateGroupInfoMutation = useMutation({
    mutationFn: (data: { name?: string; avatarUrl?: string }) => chatApi.updateGroupInfo(activeConvId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Cập nhật nhóm thành công!')
      setEditingGroupName(false)
      setIsUpdatingGroupAvatar(false)
    },
    onError: (err) => {
      toast.error(extractError(err))
      setIsUpdatingGroupAvatar(false)
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
    setIsSpeakerOn(true)
    setCallElapsedSeconds(0)
  }

  useEffect(() => {
    if (callStatus !== 'in-call') return
    const timer = window.setInterval(() => {
      setCallElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [callStatus])

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

  const toggleMic = () => {
    const nextMuted = !isMicMuted
    setIsMicMuted(nextMuted)
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
  }

  const toggleSpeaker = () => {
    const nextSpeakerOn = !isSpeakerOn
    setIsSpeakerOn(nextSpeakerOn)
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = nextSpeakerOn ? 1 : 0.4
    }
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
    const parent = messagesEndRef.current?.parentElement;
    if (parent) {
      parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
    }
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
  const formatCallDuration = (totalSeconds: number) => {
    const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const ss = (totalSeconds % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
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
    <div className="px-0 py-0 md:px-4 md:py-4 lg:px-6 lg:py-6 flex h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] min-h-0 bg-[#F5F7FA] gap-0 md:gap-4 overflow-hidden">
      
      {/* COLUMN 1: Chat List */}
      <div className={cn('h-full min-h-0 w-full md:w-[340px] lg:w-[360px] flex-shrink-0 flex-col overflow-hidden', activeConvId ? 'hidden md:flex' : 'flex')}>
        <div className="flex-shrink-0 flex justify-between items-center mb-3 px-1.5">
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

        <div className="flex-shrink-0 flex gap-2.5 mb-4 px-1.5">
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

        <div className="flex-shrink-0 mb-4 px-1.5">
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
                      <Avatar src={friend.avatar} name={friend.displayName} size="lg" className="ring-2 ring-white shadow-sm" />
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

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-2 pb-4 overscroll-contain scrollbar-thin">
          {convsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : convsError ? (
            <div className="py-8 px-2 space-y-3 text-center">
              <p className="text-sm text-gray-600">Không tải được danh sách tin nhắn.</p>
              <Button variant="secondary" size="sm" onClick={() => refetchConversations()}>
                Thử lại
              </Button>
            </div>
          ) : !conversationList.length ? (
            <div className="py-8"><EmptyState title="Trống" icon={<span className="text-3xl opacity-80">💬</span>} /></div>
          ) : (
            conversationList.map(conv => {
              const other = conv.participants.find(p => p.id !== user?.id)
              // For group: use group name; for direct: use other user name
              const convName = conv.isGroup
                ? (conv.name || conv.participants.map(p => p.displayName).join(', '))
                : (other?.displayName ?? '')
              const convAvatar = conv.isGroup ? conv.avatarUrl : other?.avatar
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
                  <div className="relative flex-shrink-0">
                    {conv.isGroup ? (
                      /* Group icon: stacked avatars or generic group icon */
                      <div className={cn('w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm', isUnread && !isActive && 'ring-2 ring-blue-300')}>
                        {convAvatar
                          ? <img src={convAvatar} alt={convName} className="w-full h-full rounded-full object-cover" />
                          : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        }
                      </div>
                    ) : (
                      <Avatar
                        src={convAvatar}
                        name={convName}
                        size="lg"
                        online={other ? onlineSet.has(other.id) : false}
                        className={cn('shadow-sm', isUnread && !isActive && 'ring-2 ring-blue-300')}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={cn("text-[15px] truncate", isActive || isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>
                        {conv.isGroup && <span className="mr-1 text-primary-500 text-[12px] font-bold">Nhóm</span>}
                        {convName}
                      </p>
                      {conv.lastMessage && <span className={cn("text-[11px] flex-shrink-0 ml-1 font-medium", isUnread ? "text-primary-600" : "text-gray-400")}>{timeAgo(conv.lastMessage.createdAt)}</span>}
                    </div>
                    {conv.lastMessage && (
                      <p className={cn("text-[13px] truncate", isUnread ? "text-gray-900 font-semibold" : "text-gray-500")}>
                        {renderLastMessagePreview(conv, user?.id)}
                      </p>
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
                        className="absolute right-10 top-0 z-30 w-48 rounded-xl border border-gray-200 bg-white shadow-lg py-1"
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
        </div>

        {/* ── Fixed bottom: action buttons ── */}
        <div className="flex-shrink-0 pt-2 border-t border-gray-100 bg-[#F5F7FA] grid grid-cols-2 gap-2">
          <button onClick={() => setNewChatOpen(true)} className="flex items-center justify-center gap-1.5 p-2.5 bg-white border border-dashed border-gray-300 rounded-2xl text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Chat mới
          </button>
          <button onClick={() => setNewGroupOpen(true)} className="flex items-center justify-center gap-1.5 p-2.5 bg-primary-50 border border-dashed border-primary-300 rounded-2xl text-primary-600 hover:bg-primary-100 transition-colors font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Tạo nhóm
          </button>
        </div>
      </div>

      {/* COLUMN 2: Chat Window */}
      {activeConvId ? (
        <div className={cn('relative flex-1 w-full min-w-0 min-h-0 bg-white rounded-none md:rounded-[24px] md:shadow-sm md:ring-1 md:ring-gray-100 flex flex-col overflow-hidden', !activeConvId ? 'hidden md:flex' : 'flex', 'fixed inset-0 z-[100] md:relative md:inset-auto md:z-auto')}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white z-20">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
              <button className="md:hidden p-2 -ml-2 text-gray-400 hover:bg-gray-100 rounded-full" onClick={() => setActiveConvId(undefined)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              </button>
              {/* Header avatar */}
              {(() => {
                const activeConvData = conversations?.find(c => c.id === activeConvId)
                const isGroup = activeConvData?.isGroup
                const groupDisplayName = activeConvData?.name || activeConvData?.participants.map(p => p.displayName).join(', ')
                const other = activeConvData?.participants.find(p => p.id !== user?.id)
                if (isGroup) {
                  return (
                    <>
                      <div className="relative group cursor-pointer w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                        {activeConvData?.avatarUrl
                          ? <img src={activeConvData.avatarUrl} alt={groupDisplayName} className="w-full h-full rounded-full object-cover" />
                          : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        }
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          {isUpdatingGroupAvatar ? <Spinner className="w-4 h-4" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3v18" /></svg>}
                          <input type="file" accept="image/*" className="hidden" disabled={isUpdatingGroupAvatar} onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setIsUpdatingGroupAvatar(true)
                            try {
                              const res = await uploadsApi.uploadImage(file, 'images')
                              updateGroupInfoMutation.mutate({ avatarUrl: res.url })
                            } catch {
                              toast.error('Tải ảnh thất bại')
                              setIsUpdatingGroupAvatar(false)
                            }
                          }} />
                        </label>
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        {editingGroupName ? (
                          <div className="flex w-full gap-1 items-center">
                            <input
                              type="text"
                              value={editGroupNameValue}
                              onChange={(e) => setEditGroupNameValue(e.target.value)}
                              className="px-2 py-0.5 rounded border border-gray-300 text-[14px] font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 max-w-[150px] sm:max-w-[200px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateGroupInfoMutation.mutate({ name: editGroupNameValue })
                                } else if (e.key === 'Escape') {
                                  setEditingGroupName(false)
                                }
                              }}
                            />
                            <button onClick={() => updateGroupInfoMutation.mutate({ name: editGroupNameValue })} className="p-1 bg-primary-100 text-primary-700 rounded"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                            <button onClick={() => setEditingGroupName(false)} className="p-1 bg-gray-100 text-gray-700 rounded"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setEditGroupNameValue(groupDisplayName ?? ''); setEditingGroupName(true) }}>
                            <h3 className="truncate font-bold text-[16px] sm:text-[17px] text-gray-900 leading-tight">{groupDisplayName}</h3>
                            <svg className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </div>
                        )}
                        <p className="text-[12px] text-gray-500 font-medium mt-0.5">{activeConvData?.participants.length} thành viên</p>
                      </div>
                    </>
                  )
                }
                return (
                  <>
                    <Avatar src={other?.avatar} name={other?.displayName ?? ''} size="md" online={other ? onlineSet.has(other.id) : false} />
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-[16px] sm:text-[17px] text-gray-900 leading-tight">{other?.displayName}</h3>
                      {otherTyping ? (
                        <p className="truncate max-w-[170px] sm:max-w-none text-[12px] sm:text-[13px] text-primary-500 font-medium animate-pulse mt-0.5">Đang nhập tin nhắn...</p>
                      ) : (other && onlineSet.has(other.id)) ? (
                        <p className="truncate max-w-[170px] sm:max-w-none text-[12px] sm:text-[13px] text-success-500 font-medium mt-0.5">Đang hoạt động</p>
                      ) : (
                        <p className="truncate max-w-[170px] sm:max-w-none text-[12px] sm:text-[13px] text-gray-500 font-medium mt-0.5">Ngoại tuyến</p>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-1.5 lg:gap-2">
              <button
                onClick={() => void startVoiceCall()}
                disabled={callStatus !== 'idle'}
                aria-label="Gọi thoại"
                className={cn(
                  "inline-flex items-center justify-center h-10 w-10 sm:h-10 sm:w-auto sm:px-3 lg:h-11 lg:px-4 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ring-1 ring-gray-200/70",
                  callStatus === 'idle'
                    ? "bg-gray-50 hover:bg-gray-100 text-gray-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <span className="hidden 2xl:inline">Gọi thoại</span>
              </button>
              {!activeConv?.isGroup && (
                <button
                  onClick={() => {
                    if (!otherParticipant?.id) return
                    navigate(`/profile/${otherParticipant.id}`)
                  }}
                  className="hidden sm:inline-flex items-center justify-center h-10 lg:h-11 px-3 lg:px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap"
                >
                   <span className="hidden 2xl:inline">Xem hồ sơ</span>
                   <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                   <svg className="hidden sm:block 2xl:hidden w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>
              )}
              <button
                onClick={() => setShowInfoPanel(v => !v)}
                className="inline-flex items-center justify-center h-10 w-10 sm:h-10 sm:w-10 lg:h-11 lg:w-11 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-colors ring-1 ring-gray-200/70"
                title="Tùy chọn"
                aria-label="Mở tùy chọn"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/70">
            {msgsLoading ? <div className="flex justify-center py-10"><Spinner /></div> : msgsError ? (
              <div className="py-8 px-2 space-y-3 text-center">
                <p className="text-sm text-gray-600">Không tải được nội dung cuộc trò chuyện.</p>
                <Button variant="secondary" size="sm" onClick={() => refetchMessages()}>
                  Thử lại
                </Button>
              </div>
            ) : (
              messages?.map((msg, idx) => {
                const isOwn = msg.senderId === user?.id
                const isStartOfDay = idx === 0 || new Date(msg.createdAt).getDay() !== new Date(messages[idx-1].createdAt).getDay()
                const activeConvData = conversations?.find(c => c.id === activeConvId)
                const isGroup = activeConvData?.isGroup
                return (
                  <div key={msg.id} className="flex flex-col">
                    {isStartOfDay && <div className="text-center my-6"><span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-3 py-1 rounded-full">{new Date(msg.createdAt).toLocaleDateString()}</span></div>}
                    <div className={cn('flex items-end gap-2.5', isOwn && 'flex-row-reverse')}>
                      {!isOwn && <Avatar src={msg.sender?.avatar} name={msg.sender?.displayName ?? ''} size="xs" className="mb-4 flex-shrink-0" />}
                      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                        {/* Show sender name in group chat */}
                        {isGroup && !isOwn && (
                          <span className="text-[11px] text-gray-500 font-semibold mb-1 px-1">{msg.sender?.displayName}</span>
                        )}
                        <div className={cn(
                           msg.type === 'IMAGE' || msg.type === 'VIDEO'
                             ? 'max-w-[85%] lg:max-w-[300px] p-0 overflow-hidden rounded-[20px] shadow-sm'
                             : msg.type === 'FILE' || msg.type === 'LINK'
                               ? 'max-w-[85%] lg:max-w-[350px]'
                                : 'w-fit max-w-[45vw] sm:max-w-[85%] lg:max-w-[450px] px-5 py-3.5 rounded-[20px] text-[15px] shadow-sm leading-relaxed',
                           msg.type !== 'IMAGE' && msg.type !== 'VIDEO' && msg.type !== 'FILE' && msg.type !== 'LINK' && (
                             isOwn
                               ? 'bg-primary-600 text-white rounded-br-sm'
                               : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                           )
                         )}>
                           {renderMessageBubble(msg, isOwn)}
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

          {/* Message Request Banner */}
          {(() => {
            const activeConv = conversations?.find(c => c.id === activeConvId)
            const isPending = activeConv?.requestStatus === 'PENDING'
            const isRequester = activeConv?.requesterId === user?.id
            if (!isPending || isRequester) return null
            return (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex flex-col gap-2">
                <p className="text-[13px] text-amber-800 font-medium text-center">
                  Người này chưa có trong danh sách bạn bè của bạn. Bạn có muốn nhận tin nhắn từ họ không?
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      await chatApi.acceptMessageRequest(activeConvId!)
                      queryClient.invalidateQueries({ queryKey: ['conversations'] })
                    }}
                    className="px-4 py-1.5 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      chatApi.deleteConversation(activeConvId!)
                      setActiveConvId(undefined)
                      queryClient.invalidateQueries({ queryKey: ['conversations'] })
                    }}
                    className="px-4 py-1.5 rounded-full bg-white border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
                  >
                    Từ chối &amp; xóa
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 sm:p-5 bg-white border-t border-gray-100 z-10 relative">
            {/* Emoji Picker popup */}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden">
                <Picker
                  data={data}
                  locale="vi"
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                  onEmojiSelect={(emoji: { native: string }) => {
                    setMessage(prev => prev + emoji.native)
                    setShowEmojiPicker(false)
                  }}
                />
              </div>
            )}
            <div className="flex items-center gap-2 sm:gap-3 bg-gray-50/80 ring-1 ring-gray-200/60 rounded-[24px] p-2 focus-within:ring-primary-500/50 focus-within:bg-white transition-all shadow-inner">
              {/* Attach Menu popup */}
              <div ref={attachMenuRef} className="relative flex-shrink-0">
                <button
                  onClick={() => setShowAttachMenu(v => !v)}
                  disabled={sendMediaMutation.isPending}
                  className={cn(
                    "p-2.5 rounded-full transition-colors",
                    showAttachMenu ? "text-primary-500 bg-primary-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200/50",
                    sendMediaMutation.isPending && "opacity-50 cursor-not-allowed"
                  )}
                  title="Đính kèm"
                >
                  {sendMediaMutation.isPending
                    ? <Spinner className="w-[22px] h-[22px]" />
                    : <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  }
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-2 w-52 z-50 flex flex-col gap-0.5">
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center flex-shrink-0 group-hover:bg-pink-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Hình ảnh</p>
                        <p className="text-[11px] text-gray-400">JPG, PNG, GIF, WEBP</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendMediaMutation.mutate(f) }} />
                    </label>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.369A1 1 0 0121 8.535v6.93a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Video</p>
                        <p className="text-[11px] text-gray-400">MP4, MOV, AVI, WEBM</p>
                      </div>
                      <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendMediaMutation.mutate(f) }} />
                    </label>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">File / Tài liệu</p>
                        <p className="text-[11px] text-gray-400">PDF, DOCX, XLSX, ZIP...</p>
                      </div>
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendMediaMutation.mutate(f) }} />
                    </label>
                  </div>
                )}
              </div>

              
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
                <button
                  title="Emoji"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className={cn(
                    "flex items-center justify-center p-2.5 font-semibold text-[13px] bg-transparent rounded-full transition-colors mr-1",
                    showEmojiPicker ? "text-primary-500 bg-primary-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200/50"
                  )}
                >
                  <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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

          {showInfoPanel && activeConvId && activeConv && (
            <>
              <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); }
                  to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
              `}</style>
              {/* Slide-in panel (Mobile & Desktop) */}
              <button
                className="block absolute inset-0 bg-black/10 z-20"
                onClick={() => setShowInfoPanel(false)}
                aria-label="Đóng thông tin"
              />
              <div className="flex absolute right-0 top-0 h-full w-full sm:w-[300px] 2xl:w-[330px] bg-[#F5F7FA] border-l border-gray-200 z-30 p-4 flex-col gap-4 overflow-y-auto animate-slide-in-right shadow-2xl">
                {/* Back button for mobile */}
                <div className="flex sm:hidden items-center pb-2 border-b border-gray-200/50">
                  <button
                    onClick={() => setShowInfoPanel(false)}
                    className="flex items-center gap-1.5 p-1 -ml-1 text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                    <span className="font-semibold text-[15px]">Đóng</span>
                  </button>
                </div>
                {activeConv.isGroup ? (
                  <>
                    <div className="bg-white rounded-[24px] p-6 shadow-sm ring-1 ring-gray-100 flex flex-col items-center relative">
                      <div className="relative group cursor-pointer mb-4">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center overflow-hidden ring-4 ring-gray-50 shadow-md">
                          {activeConv.avatarUrl ? (
                            <img src={activeConv.avatarUrl} alt={activeConv.name} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                          {isUpdatingGroupAvatar ? <Spinner className="w-6 h-6" /> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3v18" /></svg>}
                          <input type="file" accept="image/*" className="hidden" disabled={isUpdatingGroupAvatar} onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setIsUpdatingGroupAvatar(true)
                            try {
                              const res = await uploadsApi.uploadImage(file, 'images')
                              updateGroupInfoMutation.mutate({ avatarUrl: res.url })
                            } catch {
                              toast.error('Tải ảnh thất bại')
                              setIsUpdatingGroupAvatar(false)
                            }
                          }} />
                        </label>
                      </div>
                      
                      {editingGroupName ? (
                        <div className="flex w-full gap-2 mt-2">
                          <input
                            type="text"
                            value={editGroupNameValue}
                            onChange={(e) => setEditGroupNameValue(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateGroupInfoMutation.mutate({ name: editGroupNameValue })
                              } else if (e.key === 'Escape') {
                                setEditingGroupName(false)
                              }
                            }}
                          />
                          <button onClick={() => updateGroupInfoMutation.mutate({ name: editGroupNameValue })} className="p-1.5 bg-primary-100 text-primary-700 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                          <button onClick={() => setEditingGroupName(false)} className="p-1.5 bg-gray-100 text-gray-700 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 group">
                          <h3 className="text-xl font-bold text-gray-900 text-center">{activeConv.name || activeConv.participants.map(p => p.displayName).join(', ')}</h3>
                          <button onClick={() => { setEditGroupNameValue(activeConv.name || ''); setEditingGroupName(true) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-500 font-medium mt-1">{activeConv.participants.length} thành viên</p>

                      <div className="grid grid-cols-1 gap-2.5 w-full mt-4">
                        <button
                          onClick={() => {
                            if (!activeConvId) return
                            toggleMute(activeConvId)
                            toast.success(!mutedConversationIds[activeConvId] ? 'Đã tắt thông báo nhóm' : 'Đã bật lại thông báo nhóm')
                          }}
                          className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                        >
                          {activeConvId && mutedConversationIds[activeConvId] ? 'Bật thông báo' : 'Tắt thông báo'}
                        </button>
                        <button
                          onClick={() => {
                            if (!activeConvId) return
                            setConfirmDeleteConv({ id: activeConvId, name: activeConv.name || 'nhóm này' })
                          }}
                          className="bg-red-50/80 hover:bg-red-100 text-red-600 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-red-200/50"
                        >
                          Rời nhóm
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-[24px] p-5 shadow-sm ring-1 ring-gray-100 flex-shrink-0">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-gray-900">Thành viên nhóm</h4>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">
                          {activeConv.participants.length}
                        </span>
                      </div>
                      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                        {activeConv.participants.length === 0 ? (
                          <p className="py-3 text-center text-sm font-medium text-gray-400">Chưa có thành viên</p>
                        ) : (
                          activeConv.participants.map(p => {
                            const isCreator = p.id === activeConv.creatorId
                            const isCurrentUser = p.id === user?.id

                            return (
                              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-gray-50/80 px-3 py-2.5">
                                <Avatar src={p.avatar} name={p.displayName} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-gray-800">
                                    {p.displayName || 'Người dùng'}
                                    {isCurrentUser ? <span className="ml-1 text-xs font-semibold text-gray-400">(Bạn)</span> : null}
                                  </p>
                                  <p className="text-xs font-medium text-gray-400">{isCreator ? 'Quản trị viên' : 'Thành viên'}</p>
                                </div>
                                {isCreator ? (
                                  <span className="rounded-full bg-primary-100 px-2 py-1 text-[10px] font-bold text-primary-700">QTV</span>
                                ) : null}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-[24px] p-5 shadow-sm ring-1 ring-gray-100 flex-shrink-0 flex flex-col mt-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex-shrink-0">Phương tiện, file và liên kết</h4>
                      <div className="space-y-5 overflow-y-auto scrollbar-thin pr-1 flex-1 max-h-[320px]">
                        {/* Images & Videos */}
                        {(() => {
                          const mediaItems = (mediaMessages ?? []).filter(m => m.type === 'IMAGE' || m.type === 'VIDEO')
                          if (mediaItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ảnh / Video ({mediaItems.length})</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {mediaItems.map(m => (
                                  <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                                    {m.type === 'IMAGE'
                                      ? <img src={m.mediaUrl} alt={m.fileName ?? 'ảnh'} className="w-full h-full object-cover" />
                                      : <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white gap-1">
                                          {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt="thumb" className="absolute inset-0 w-full h-full object-cover opacity-60" /> : null}
                                          <svg className="w-6 h-6 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                          <span className="text-[10px] relative z-10 font-medium">VIDEO</span>
                                        </div>
                                    }
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Files */}
                        {(() => {
                          const fileItems = (mediaMessages ?? []).filter(m => m.type === 'FILE')
                          if (fileItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">File ({fileItems.length})</p>
                              <div className="space-y-1">
                                {fileItems.map(m => (
                                  <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors no-underline">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 truncate">{m.fileName ?? m.content}</p>
                                      <p className="text-[11px] text-gray-500">{m.fileSize ? `${(m.fileSize / 1024 / 1024).toFixed(1)} MB • ` : ''}{new Date(m.createdAt).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Links */}
                        {(() => {
                          const linkItems = (mediaMessages ?? []).filter(m => m.type === 'LINK')
                          if (linkItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Liên kết ({linkItems.length})</p>
                              <div className="space-y-1">
                                {linkItems.map(m => {
                                  const url = m.mediaUrl ?? m.content
                                  let hostname = ''
                                  try { hostname = new URL(url).hostname } catch { hostname = url }
                                  return (
                                    <a key={m.id} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors no-underline">
                                      <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{url}</p>
                                        <p className="text-[11px] text-gray-500">{hostname}</p>
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Empty state */}
                        {(!mediaMessages || mediaMessages.length === 0) && (
                          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                            <svg className="w-9 h-9 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="text-xs font-medium">Chưa có phương tiện nào được chia sẻ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : otherParticipant ? (
                  <>
                    <div className="bg-white rounded-[24px] p-6 shadow-sm ring-1 ring-gray-100 flex flex-col items-center">
                      <Avatar src={otherParticipant.avatar} name={otherParticipant.displayName} className="w-24 h-24 mb-4 ring-4 ring-gray-50 shadow-md" />
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{otherParticipant.displayName}</h3>
                      <div className="grid grid-cols-2 gap-2.5 w-full mt-4">
                        <button onClick={() => navigate(`/profile/${otherParticipant.id}`)} className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50">Trang cá nhân</button>
                        <button
                          onClick={() => {
                            if (!activeConvId) return
                            toggleMute(activeConvId)
                            toast.success(!mutedConversationIds[activeConvId] ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật lại thông báo cuộc trò chuyện')
                          }}
                          className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                        >
                          {activeConvId && mutedConversationIds[activeConvId] ? 'Bật thông báo' : 'Tắt thông báo'}
                        </button>
                        <button
                          onClick={() => toast.info('Tính năng chặn đang được phát triển')}
                          className="bg-gray-50/80 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-sm ring-1 ring-gray-200/50"
                        >
                          Chặn
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-[24px] p-5 shadow-sm ring-1 ring-gray-100 flex-1 min-h-0 flex flex-col mt-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex-shrink-0">Phương tiện, file và liên kết</h4>
                      <div className="space-y-5 overflow-y-auto scrollbar-thin pr-1 flex-1">
                        {/* Images & Videos */}
                        {(() => {
                          const mediaItems = (mediaMessages ?? []).filter(m => m.type === 'IMAGE' || m.type === 'VIDEO')
                          if (mediaItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ảnh / Video ({mediaItems.length})</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {mediaItems.map(m => (
                                  <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                                    {m.type === 'IMAGE'
                                      ? <img src={m.mediaUrl} alt={m.fileName ?? 'ảnh'} className="w-full h-full object-cover" />
                                      : <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white gap-1">
                                          {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt="thumb" className="absolute inset-0 w-full h-full object-cover opacity-60" /> : null}
                                          <svg className="w-6 h-6 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                          <span className="text-[10px] relative z-10 font-medium">VIDEO</span>
                                        </div>
                                    }
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Files */}
                        {(() => {
                          const fileItems = (mediaMessages ?? []).filter(m => m.type === 'FILE')
                          if (fileItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">File ({fileItems.length})</p>
                              <div className="space-y-1">
                                {fileItems.map(m => (
                                  <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors no-underline">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 truncate">{m.fileName ?? m.content}</p>
                                      <p className="text-[11px] text-gray-500">{m.fileSize ? `${(m.fileSize / 1024 / 1024).toFixed(1)} MB • ` : ''}{new Date(m.createdAt).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Links from TEXT messages */}
                        {(() => {
                          const urlRegex = /https?:\/\/[^\s]+/g
                          const linkItems = (mediaMessages ?? []).filter(m => m.type === 'LINK')
                          if (linkItems.length === 0) return null
                          return (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Liên kết ({linkItems.length})</p>
                              <div className="space-y-1">
                                {linkItems.map(m => {
                                  const url = m.mediaUrl ?? m.content
                                  let hostname = ''
                                  try { hostname = new URL(url).hostname } catch { hostname = url }
                                  return (
                                    <a key={m.id} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors no-underline">
                                      <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{url}</p>
                                        <p className="text-[11px] text-gray-500">{hostname}</p>
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                        {/* Empty state */}
                        {(!mediaMessages || mediaMessages.length === 0) && (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="text-xs font-medium">Chưa có phương tiện nào được chia sẻ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
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
      {/* Create Group Modal */}
      <Modal
        open={newGroupOpen}
        onClose={() => {
          if (isUploadingGroupAvatar || createGroupMutation.isPending) return
          setNewGroupOpen(false)
          setGroupName('')
          setSelectedFriendIds([])
          setGroupAvatarUrl('')
          setGroupAvatarPreview('')
          setIsUploadingGroupAvatar(false)
        }}
        title="Tạo nhóm nhắn tin"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setNewGroupOpen(false); setGroupName(''); setSelectedFriendIds([]); setGroupAvatarUrl(''); setGroupAvatarPreview('') }}>Hủy</Button>
            <Button
              onClick={() => createGroupMutation.mutate()}
              disabled={!groupName.trim() || selectedFriendIds.length < 2 || createGroupMutation.isPending || isUploadingGroupAvatar}
              loading={createGroupMutation.isPending || isUploadingGroupAvatar}
            >
              Tạo nhóm ({selectedFriendIds.length} đã chọn)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Group avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <label className="text-sm font-semibold text-gray-700 self-start">Ảnh nhóm <span className="text-xs text-gray-400 font-normal">(tùy chọn)</span></label>
            <label className="cursor-pointer group relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center overflow-hidden shadow-md ring-2 ring-white group-hover:ring-primary-300 transition-all">
                {groupAvatarPreview
                  ? <img src={groupAvatarPreview} alt="preview" className="w-full h-full object-cover" />
                  : <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border-2 border-primary-400 rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  // Local preview
                  const reader = new FileReader()
                  reader.onload = (ev) => setGroupAvatarPreview(ev.target?.result as string)
                  reader.readAsDataURL(file)
                  // Upload to Cloudinary via existing API
                  try {
                    setIsUploadingGroupAvatar(true)
                    setGroupAvatarUrl('')
                    const result = await uploadsApi.uploadImage(file, 'images')
                    setGroupAvatarUrl(result?.url ?? '')
                    toast.success('Da tai anh nhom len')
                    setIsUploadingGroupAvatar(false)
                    e.target.value = ''
                  } catch {
                    setGroupAvatarPreview('')
                    setGroupAvatarUrl('')
                    setIsUploadingGroupAvatar(false)
                    e.target.value = ''
                    toast.error('Không thể tải ảnh lên, vui lòng thử lại')
                  }
                }}
              />
            </label>
            {isUploadingGroupAvatar && (
              <p className="text-xs font-medium text-primary-600">Dang tai anh nhom...</p>
            )}
            {groupAvatarPreview && (
              <button
                type="button"
                onClick={() => {
                  if (isUploadingGroupAvatar) return
                  setGroupAvatarPreview('')
                  setGroupAvatarUrl('')
                }}
                disabled={isUploadingGroupAvatar}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Xóa ảnh
              </button>
            )}
          </div>
          {/* Group name input */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Tên nhóm <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Nhập tên nhóm..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400 text-[15px]"
            />
          </div>
          {/* Friend selection */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Chọn thành viên <span className="text-xs text-gray-400 font-normal">(tối thiểu 2 người)</span></label>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {!friends ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : friends.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">Bạn chưa có người bạn nào.</div>
              ) : (
                friends.map(friend => {
                  const checked = selectedFriendIds.includes(friend.id)
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => setSelectedFriendIds(prev =>
                        checked ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                      )}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
                        checked ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50'
                      )}
                    >
                      <Avatar src={friend.avatar} name={friend.displayName} size="md" />
                      <p className="flex-1 font-semibold text-[15px] text-gray-800">{friend.displayName}</p>
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                      )}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

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

      <ConfirmDialog
        open={!!confirmDeleteConv}
        onClose={() => {
          if (deleteConversationMutation.isPending) return
          setConfirmDeleteConv(null)
        }}
        onConfirm={() => {
          if (!confirmDeleteConv?.id) return
          deleteConversationMutation.mutate(confirmDeleteConv.id, {
            onSettled: () => setConfirmDeleteConv(null),
          })
        }}
        title={activeConv?.isGroup ? "Rời nhóm" : "Xóa cuộc trò chuyện"}
        closeOnOverlay={!deleteConversationMutation.isPending}
        description={(
          <span>
            {activeConv?.isGroup 
               ? <>Bạn có chắc muốn rời khỏi nhóm <b>{confirmDeleteConv?.name}</b> không?</>
               : <>Bạn có chắc muốn xóa cuộc trò chuyện với <b>{confirmDeleteConv?.name}</b> ở phía bạn? Người còn lại vẫn giữ cuộc trò chuyện và tin nhắn của họ.</>}
          </span>
        )}
        confirmText={activeConv?.isGroup ? "Rời nhóm" : "Xóa phía tôi"}
        cancelText="Hủy"
        tone="danger"
        loading={deleteConversationMutation.isPending}
      />

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

      {callStatus !== 'idle' && callStatus !== 'incoming' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[370px] rounded-[28px] bg-[#f4f4f7] px-7 py-10 shadow-2xl">
            <p className="text-center text-[33px] leading-none font-semibold text-[#353845]">
              {callStatus === 'calling' && 'Đang gọi...'}
              {callStatus === 'connecting' && 'Đang kết nối...'}
              {callStatus === 'in-call' && 'Đang gọi...'}
            </p>

            <div className="mt-8 flex justify-center">
              <Avatar
                src={otherParticipant?.avatar ?? incomingCaller?.avatar}
                name={otherParticipant?.displayName ?? incomingCaller?.displayName ?? 'Người dùng'}
                size="2xl"
                online={callStatus === 'in-call'}
                className="ring-4 ring-white shadow-lg"
              />
            </div>

            <p className="mt-6 text-center text-[38px] leading-tight font-bold text-[#353845] break-words">
              {otherParticipant?.displayName ?? incomingCaller?.displayName ?? 'Người dùng'}
            </p>
            <p className="mt-2 text-center text-[28px] leading-none text-[#757b86]">
              {callStatus === 'in-call'
                ? formatCallDuration(callElapsedSeconds)
                : callStatus === 'calling'
                  ? 'Đang đổ chuông...'
                  : 'Đang kết nối cuộc gọi...'}
            </p>

            <div className="mt-12 flex items-start justify-center gap-7">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-colors',
                    isMicMuted ? 'bg-[#5b6270] text-white' : 'bg-[#d9dce3] text-[#646b78]'
                  )}
                  aria-label={isMicMuted ? 'Bật mic' : 'Tắt mic'}
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 16a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Z" />
                    <path d="M5 12a7 7 0 0 0 14 0" />
                    <path d="M12 19v3" />
                  </svg>
                </button>
                <span className="mt-2 text-[18px] text-[#636975]">{isMicMuted ? 'Bật mic' : 'Tắt mic'}</span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={toggleSpeaker}
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-colors',
                    isSpeakerOn ? 'bg-[#d9dce3] text-[#646b78]' : 'bg-[#5b6270] text-white'
                  )}
                  aria-label={isSpeakerOn ? 'Tắt loa' : 'Bật loa'}
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 10v4h4l5 4V6L8 10H4Z" />
                    <path d="M16 9a5 5 0 0 1 0 6" />
                    <path d="M19 6a9 9 0 0 1 0 12" />
                  </svg>
                </button>
                <span className="mt-2 text-[18px] text-[#636975]">Loa</span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={hangupCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ef4747] text-white shadow-md transition-colors hover:bg-[#e23636]"
                  aria-label="Kết thúc"
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4.5 15.2c1.4-1.3 3.1-2 4.9-2h5.2c1.8 0 3.5.7 4.9 2l.6.5a1.1 1.1 0 0 1 .2 1.5l-1.6 2a1.1 1.1 0 0 1-1.3.3l-3.4-1.6a1.1 1.1 0 0 1-.6-1v-1.2H10.7V17a1.1 1.1 0 0 1-.6 1l-3.4 1.6a1.1 1.1 0 0 1-1.3-.3l-1.6-2a1.1 1.1 0 0 1 .2-1.5l.5-.6Z" />
                  </svg>
                </button>
                <span className="mt-2 text-[18px] text-[#636975]">Kết thúc</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  )
}

