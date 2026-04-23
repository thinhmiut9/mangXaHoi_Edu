import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { chatApi, Conversation, Message } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/utils/cn'
import { timeAgo } from '@/utils/format'
import { notificationsApi } from '@/api/index'
import { connectSocket } from '@/socket/socketClient'

/**
 * Parse URLs in text and render as clickable links
 */
function renderMsgContent(content: string, isMe: boolean) {
  const URL_REGEX = /(https?:\/\/[^\s]+)/g
  const parts = content.split(URL_REGEX)
  const origin = window.location.origin
  return parts.map((part, i) => {
    if (!part.startsWith('http://') && !part.startsWith('https://')) {
      return <span key={i}>{part}</span>
    }
    const linkClass = `underline break-all ${isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`
    if (part.startsWith(origin)) {
      return <Link key={i} to={part.slice(origin.length) || '/'} className={linkClass}>{part}</Link>
    }
    return <a key={i} href={part} target='_blank' rel='noopener noreferrer' className={linkClass}>{part}</a>
  })
}

/**
 * Floating Messenger-style chat widget
 * - View 1: conversation list
 * - View 2: inline mini chat for selected conversation
 * Hidden on /chat page
 */
export function FloatingChat() {
  const location = useLocation()
  if (location.pathname.startsWith('/chat')) return null
  return <FloatingChatWidget />
}

function FloatingChatWidget() {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const { unreadMessageCount, setUnreadSummary } = useNotificationStore()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [msgText, setMsgText] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Conversation list ──
  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
    enabled: open,
    staleTime: 20_000,
  })

  // ── Messages for selected conversation ──
  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConv?.id],
    queryFn: () => chatApi.getMessages(activeConv!.id),
    enabled: !!activeConv?.id,
    refetchInterval: 5000, // poll every 5s for real-time feel
  })

  // ── Mark read ──
  const markReadMutation = useMutation({
    mutationFn: (convId: string) => chatApi.markConversationRead(convId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      const summary = await notificationsApi.getUnreadSummary()
      setUnreadSummary(summary)
    },
  })

  // ── Send message ──
  const sendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(activeConv!.id, msgText.trim()),
    onSuccess: () => {
      setMsgText('')
      queryClient.invalidateQueries({ queryKey: ['messages', activeConv?.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // ── Socket: listen for new messages in active conv ──
  useEffect(() => {
    if (!token || !activeConv?.id) return
    const socket = connectSocket(token)
    const handler = (msg: Message) => {
      if (msg.conversationId === activeConv.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConv.id] })
        markReadMutation.mutate(activeConv.id)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
    socket.on('new-message', handler)
    return () => { socket.off('new-message', handler) }
  }, [token, activeConv?.id, queryClient])

  // ── Auto scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Mark read when opening a conversation ──
  useEffect(() => {
    if (activeConv?.id) markReadMutation.mutate(activeConv.id)
  }, [activeConv?.id])

  // ── Focus input when opening a conversation ──
  useEffect(() => {
    if (activeConv) setTimeout(() => inputRef.current?.focus(), 100)
  }, [activeConv])

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSend = useCallback(() => {
    if (!msgText.trim() || !activeConv || sendMutation.isPending) return
    sendMutation.mutate()
  }, [msgText, activeConv, sendMutation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleOpenConv = (conv: Conversation) => {
    setActiveConv(conv)
  }

  const sorted = [...(conversations ?? [])].sort((a, b) => {
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
    return tb - ta
  })

  const otherParticipant = activeConv?.participants.find(p => p.id !== user?.id)

  return (
    <div ref={popupRef} className='fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2'>

      {/* ════════════════════════════════════
          POPUP PANEL
          ════════════════════════════════════ */}
      {open && (
        <div
          className='w-[340px] bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-slate-100 overflow-hidden flex flex-col'
          style={{ height: 'min(520px, calc(100vh - 100px))' }}
        >
          {/* ── Header ── */}
          {activeConv ? (
            /* Mini chat header */
            <div className='flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-white'>
              {/* Back to list */}
              <button
                type='button'
                onClick={() => setActiveConv(null)}
                className='w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0'
              >
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2.2'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7' />
                </svg>
              </button>
              <Avatar src={otherParticipant?.avatar} name={otherParticipant?.displayName ?? ''} size='xs' />
              <span className='flex-1 text-[14px] font-semibold text-slate-900 truncate'>
                {otherParticipant?.displayName ?? activeConv.name ?? 'Nhóm chat'}
              </span>
              {/* Open full chat */}
              <button
                type='button'
                onClick={() => { navigate(`/chat/${activeConv.id}`); setOpen(false) }}
                className='w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0'
                title='Mở trang tin nhắn'
              >
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5' />
                </svg>
              </button>
              <button type='button' onClick={() => setOpen(false)} className='w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0'>
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' /></svg>
              </button>
            </div>
          ) : (
            /* Conversation list header */
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-100'>
              <h3 className='text-[17px] font-bold text-slate-900'>Tin nhắn</h3>
              <div className='flex items-center gap-1'>
                <button type='button' onClick={() => { navigate('/chat'); setOpen(false) }}
                  className='w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors' title='Mở trang tin nhắn đầy đủ'>
                  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5' />
                  </svg>
                </button>
                <button type='button' onClick={() => setOpen(false)}
                  className='w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors'>
                  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' /></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Body ── */}
          {activeConv ? (
            /* ─── MINI CHAT VIEW ─── */
            <>
              {/* Messages */}
              <div className='flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50/50'>
                {msgsLoading ? (
                  <div className='flex justify-center py-8'>
                    <div className='w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin' />
                  </div>
                ) : !messages?.length ? (
                  <div className='text-center py-8 text-sm text-slate-400'>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</div>
                ) : (
                  messages.map((msg: Message) => {
                    const isMe = msg.senderId === user?.id
                    return (
                      <div key={msg.id} className={cn('flex gap-2', isMe ? 'justify-end' : 'justify-start')}>
                        {!isMe && (
                          <Avatar src={otherParticipant?.avatar} name={otherParticipant?.displayName ?? ''} size='xs' className='flex-shrink-0 mt-0.5' />
                        )}
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed break-words',
                          isMe
                            ? 'bg-primary-500 text-white rounded-br-md'
                            : 'bg-white text-slate-800 shadow-sm rounded-bl-md border border-slate-100'
                        )}>
                          <span className='whitespace-pre-wrap break-words'>{renderMsgContent(msg.content, isMe)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className='flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-white'>
                <input
                  ref={inputRef}
                  type='text'
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='Nhắn tin...'
                  className='flex-1 text-[13px] bg-slate-100 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-slate-400'
                  disabled={sendMutation.isPending}
                />
                <button
                  type='button'
                  onClick={handleSend}
                  disabled={!msgText.trim() || sendMutation.isPending}
                  className='w-8 h-8 flex items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0'
                >
                  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2.2'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            /* ─── CONVERSATION LIST VIEW ─── */
            <div className='flex-1 overflow-y-auto'>
              {convsLoading ? (
                <div className='space-y-1 p-2'>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className='flex items-center gap-3 p-3 animate-pulse'>
                      <div className='w-11 h-11 rounded-full bg-slate-200 flex-shrink-0' />
                      <div className='flex-1 space-y-1.5'>
                        <div className='h-3 bg-slate-200 rounded w-28' />
                        <div className='h-2.5 bg-slate-100 rounded w-40' />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <svg className='w-12 h-12 text-slate-200 mb-3' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.2'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' />
                  </svg>
                  <p className='text-sm text-slate-400'>Không tìm thấy tin nhắn.</p>
                </div>
              ) : (
                <div className='py-2'>
                  {sorted.map((conv: Conversation) => {
                    const other = conv.participants.find(p => p.id !== user?.id)
                    const isUnread = conv.unreadCount > 0
                    return (
                      <button
                        key={conv.id}
                        type='button'
                        onClick={() => handleOpenConv(conv)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left',
                          isUnread && 'bg-blue-50/60 hover:bg-blue-50'
                        )}
                      >
                        <div className='relative flex-shrink-0'>
                          <Avatar src={other?.avatar} name={other?.displayName ?? ''} size='md' />
                          {isUnread && (
                            <span className='absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-white' />
                          )}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-baseline justify-between gap-1'>
                            <p className={cn('text-[14px] truncate', isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700')}>
                              {other?.displayName ?? conv.name ?? 'Nhóm chat'}
                            </p>
                            {conv.lastMessage && (
                              <span className='text-[11px] text-slate-400 flex-shrink-0'>{timeAgo(conv.lastMessage.createdAt)}</span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className={cn('text-[12px] truncate', isUnread ? 'font-semibold text-slate-700' : 'text-slate-400')}>
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className='flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-bold px-1.5'>
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          TOGGLE BUTTON
          ════════════════════════════════════ */}
      <button
        type='button'
        onClick={() => { setOpen(v => !v); if (!open) setActiveConv(null) }}
        className={cn(
          'flex items-center gap-2.5 rounded-full bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-4 py-3 text-slate-700 font-semibold text-[14px]',
          'hover:shadow-[0_8px_32px_rgba(0,0,0,0.18)] hover:bg-slate-50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none',
          open && 'bg-slate-50'
        )}
        aria-label='Mở tin nhắn'
      >
        <span className='relative flex-shrink-0'>
          <svg className='w-5 h-5 text-slate-600' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.6-.3-3.7-.8L3 21l1.3-5.2A8.5 8.5 0 1 1 21 12Z' />
          </svg>
          {!!unreadMessageCount && !open && (
            <span className='absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white'>
              {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
            </span>
          )}
        </span>
        <span>Tin nhắn</span>
        {!!unreadMessageCount && !open && (
          <span className='flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white'>
            {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
          </span>
        )}
      </button>
    </div>
  )
}
