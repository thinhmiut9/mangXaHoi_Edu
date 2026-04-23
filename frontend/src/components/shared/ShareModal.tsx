import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Post, postsApi } from '@/api/posts'
import { friendsApi } from '@/api/users'
import { chatApi } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

interface ShareModalProps {
  post: Post
  onClose: () => void
}

type PrivacyValue = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

const PRIVACY_OPTIONS: { value: PrivacyValue; label: string; icon: JSX.Element }[] = [
  {
    value: 'PUBLIC',
    label: 'Công khai',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
  },
  {
    value: 'FRIENDS',
    label: 'Bạn bè',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
  {
    value: 'PRIVATE',
    label: 'Chỉ mình tôi',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    ),
  },
]

export function ShareModal({ post, onClose }: ShareModalProps) {
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  // Share-to-profile state
  const [caption, setCaption] = useState('')
  const [privacy, setPrivacy] = useState<PrivacyValue>('PUBLIC')
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // Send-to-friends state
  const [friendSearch, setFriendSearch] = useState('')
  const [sendingTo, setSendingTo] = useState<Set<string>>(new Set())
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())

  // Copy link state
  const [copied, setCopied] = useState(false)

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: friendsApi.getFriends,
  })

  const shareMutation = useMutation({
    mutationFn: () => postsApi.sharePost(post.id, { caption: caption.trim(), privacy }),
    onSuccess: () => {
      toast.success('Đã chia sẻ bài viết về trang cá nhân')
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', post.id] })
      onClose()
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const sendToFriend = async (friendId: string) => {
    if (sendingTo.has(friendId) || sentTo.has(friendId)) return
    setSendingTo(prev => new Set(prev).add(friendId))
    try {
      const conv = await chatApi.getOrCreateConversation(friendId)
      const postLink = `${window.location.origin}/posts/${post.id}`
      const message = caption.trim()
        ? `${caption.trim()}\n${postLink}`
        : postLink
      await chatApi.sendMessage(conv.id, message)
      setSentTo(prev => new Set(prev).add(friendId))
      toast.success('Đã gửi bài viết qua tin nhắn')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSendingTo(prev => { const s = new Set(prev); s.delete(friendId); return s })
    }
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/posts/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Đã sao chép liên kết')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Không thể sao chép')
    }
  }

  const selectedPrivacy = PRIVACY_OPTIONS.find(o => o.value === privacy)!
  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(friendSearch.toLowerCase())
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Chia sẻ</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Share to profile section */}
          <div className="p-4 border-b border-slate-100">
            {/* User row + privacy */}
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900 leading-none">{user?.displayName}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(o => !o)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
                  >
                    {selectedPrivacy.icon}
                    <span>{selectedPrivacy.label}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  {privacyOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPrivacyOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden w-44">
                        {PRIVACY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setPrivacy(opt.value); setPrivacyOpen(false) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                              privacy === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {opt.icon}
                            {opt.label}
                            {privacy === opt.value && (
                              <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Caption textarea */}
            <textarea
              placeholder="Hãy nói gì đó về nội dung này..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              className="w-full text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none"
            />

            {/* Post preview card */}
            <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar src={post.author?.avatar} name={post.author?.displayName ?? ''} size="xs" />
                  <span className="text-xs font-semibold text-slate-700">{post.author?.displayName}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{post.content || '(Bài viết không có nội dung)'}</p>
              </div>
              {(post.imageUrls?.[0] || post.images?.[0]) && (
                <img
                  src={post.imageUrls?.[0] || post.images?.[0]}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                />
              )}
            </div>

            {/* Share now button */}
            <button
              type="button"
              onClick={() => shareMutation.mutate()}
              disabled={shareMutation.isPending}
              className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {shareMutation.isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang chia sẻ...
                </>
              ) : 'Chia sẻ ngay'}
            </button>
          </div>

          {/* Send to friends */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Gửi qua tin nhắn</h3>
            </div>
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Tìm bạn bè..."
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-slate-200 transition-colors"
              />
            </div>
            {filteredFriends.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Không tìm thấy bạn bè</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {filteredFriends.slice(0, 12).map(friend => {
                  const isSending = sendingTo.has(friend.id)
                  const isSent = sentTo.has(friend.id)
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      disabled={isSending || isSent}
                      onClick={() => sendToFriend(friend.id)}
                      className="flex flex-col items-center gap-1.5 min-w-[64px] max-w-[64px] disabled:opacity-70"
                    >
                      <div className="relative">
                        <Avatar src={friend.avatar} name={friend.displayName} size="md" />
                        {isSent && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          </span>
                        )}
                        {isSending && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600 text-center leading-tight line-clamp-2 w-full">
                        {friend.displayName.split(' ').slice(-1)[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Chia sẻ lên</h3>
            <div className="grid grid-cols-3 gap-3">
              {/* Copy link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm ${copied ? 'bg-green-500' : 'bg-slate-500'} transition-colors`}>
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"/>
                    </svg>
                  )}
                </span>
                <span className="text-[11px] text-slate-600 font-medium leading-tight text-center">
                  {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
                </span>
              </button>

              {/* Share to profile (shortcut) */}
              <button
                type="button"
                onClick={() => shareMutation.mutate()}
                disabled={shareMutation.isPending}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-60"
              >
                <span className="w-11 h-11 rounded-full flex items-center justify-center bg-blue-500 text-white shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z"/>
                  </svg>
                </span>
                <span className="text-[11px] text-slate-600 font-medium leading-tight text-center">Trang cá nhân</span>
              </button>

              {/* Native share (Web Share API) */}
              {typeof navigator.share === 'function' && (
                <button
                  type="button"
                  onClick={() => navigator.share({ title: post.author?.displayName ?? 'Bài viết', url: `${window.location.origin}/posts/${post.id}` })}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-500 text-white shadow-sm">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium leading-tight text-center">Chia sẻ khác</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
