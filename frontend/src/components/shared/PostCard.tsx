import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Comment as PostComment, Post, postsApi } from '@/api/posts'
import { reportsApi } from '@/api/index'
import { groupsApi } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea } from '@/components/ui/TextArea'
import { useToast } from '@/components/ui/Toast'
import { timeAgo } from '@/utils/format'
import { extractError } from '@/api/client'
import { cn } from '@/utils/cn'
import { MentionInput } from '@/components/ui/MentionTextarea'
import { MentionText } from '@/components/ui/MentionText'

interface PostCardProps {
  post: Post
  showComments?: boolean
}

function isImageLikeUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) || url.includes('/image/upload/')
}

function isDocumentLikeUrl(url: string): boolean {
  return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)(\?|$)/i.test(url) || url.includes('/raw/upload/')
}

function isVideoLikeUrl(url: string): boolean {
  return /\.(mp4|webm|mov|mkv)(\?|$)/i.test(url) || url.includes('/video/upload/')
}

function getFileName(url: string): string {
  const noQuery = url.split('?')[0]
  const part = noQuery.split('/').pop() || 'Tài liệu đính kèm'
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

function getFileExtLabel(url: string): string {
  const name = getFileName(url)
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return 'FILE'
  return name.slice(dot + 1).toUpperCase().slice(0, 5)
}

export function PostCard({ post, showComments = false }: PostCardProps) {
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showCommentBox, setShowCommentBox] = useState(showComments)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editPrivacy, setEditPrivacy] = useState(post.privacy)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('SPAM')
  const [reportDesc, setReportDesc] = useState('')

  const reportMutation = useMutation({
    mutationFn: () => reportsApi.create({ targetId: post.id, targetType: 'POST', reason: reportReason, description: reportDesc }),
    onSuccess: () => {
      toast.success('Đã gửi báo cáo thành công')
      setReportOpen(false)
      setReportDesc('')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const likeMutation = useMutation({
    mutationFn: () => postsApi.toggleLike(post.id),
    onSuccess: (data) => {
      toast.success(`${data.likesCount} người đã tim bài viết`)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', post.id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const saveMutation = useMutation({
    mutationFn: () => postsApi.toggleSave(post.id),
    onSuccess: (data) => {
      toast.success(data.saved ? 'Đã lưu bài viết' : 'Đã bỏ lưu')
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const shareMutation = useMutation({
    mutationFn: () => postsApi.sharePost(post.id),
    onSuccess: (data) => {
      toast.success(data.shared ? 'Đã chia sẻ bài viết về trang cá nhân' : 'Bạn đã chia sẻ bài này rồi')
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', post.id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const commentMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      postsApi.createComment(post.id, { content, parentId }),
    onSuccess: () => {
      setNewComment('')
      setReplyText('')
      setReplyingTo(null)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
      toast.success('Đã đăng bình luận!')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const updatePostMutation = useMutation({
    mutationFn: () => postsApi.updatePost(post.id, { content: editContent.trim(), privacy: editPrivacy }),
    onSuccess: () => {
      toast.success('Đã cập nhật bài viết')
      setEditOpen(false)
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', post.id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deletePostMutation = useMutation({
    mutationFn: () => postsApi.deletePost(post.id),
    onSuccess: () => {
      toast.success('Đã xóa bài viết')
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(commentId),
    onSuccess: () => {
      toast.success('Đã xóa bình luận')
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const likeCommentMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.toggleCommentLike(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const { data: comments } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => postsApi.getComments(post.id),
    enabled: showCommentBox || detailOpen,
  })
  const { data: reactions } = useQuery({
    queryKey: ['post-reactions', post.id, post.likesCount, reactionsOpen],
    queryFn: () => postsApi.getReactions(post.id),
    enabled: reactionsOpen,
  })
  const { data: fallbackGroupMeta } = useQuery({
    queryKey: ['group-meta', post.groupId],
    queryFn: () => groupsApi.getGroup(post.groupId!),
    enabled: Boolean(post.groupId && (!post.groupName || !post.groupCoverUrl)),
    staleTime: 5 * 60 * 1000,
  })

  const isOwnPost = user?.id === post.authorId
  const contentHashtags = post.content
    .split(/\s+/)
    .filter((word) => /^#[\p{L}\p{N}_-]+$/u.test(word))
    .slice(0, 4)
  const allMedia = (post.mediaUrls ?? post.images ?? []).filter(Boolean)
  const imageUrls = Array.from(
    new Set([...(post.imageUrls ?? post.images ?? []), ...allMedia.filter(isImageLikeUrl)])
  )
  const videoUrls = Array.from(new Set([...(post.videoUrls ?? []), ...allMedia.filter(isVideoLikeUrl)]))
  const documentUrls = Array.from(
    new Set([...(post.documentUrls ?? []), ...allMedia.filter((url) => !isImageLikeUrl(url) && !isVideoLikeUrl(url) && isDocumentLikeUrl(url))])
  )
  const isGroupPost = Boolean(post.groupId && post.groupId !== 'null')
  const displayGroupName = post.groupName || fallbackGroupMeta?.name || 'Nhóm'
  const displayGroupCoverUrl = post.groupCoverUrl || fallbackGroupMeta?.coverUrl || fallbackGroupMeta?.coverPhoto
  const fallbackGroupLabel = 'Nh\u00F3m'
  const dotSeparator = '\u00B7'
  const privacyLabel =
    post.privacy === 'PUBLIC' ? 'C\u00F4ng khai' : post.privacy === 'FRIENDS' ? 'B\u1EA1n b\u00E8' : 'Ri\u00EAng t\u01B0'
  const openDetail = () => {
    setDetailOpen(true)
    setShowCommentBox(true)
  }
  const openReactions = () => {
    setReactionsOpen(true)
  }
  const commentsList = comments ?? []
  const repliesByParent = commentsList.reduce<Record<string, PostComment[]>>((acc, comment) => {
    if (!comment.parentId) return acc
    if (!acc[comment.parentId]) acc[comment.parentId] = []
    acc[comment.parentId].push(comment)
    return acc
  }, {})
  const rootComments = commentsList.filter(comment => !comment.parentId)
  const handleSharePost = () => shareMutation.mutate()

  const renderComment = (comment: PostComment, depth = 0): JSX.Element => {
    const isOwnComment = user?.id === comment.authorId
    const childReplies = repliesByParent[comment.id] ?? []
    const isReplyingThis = replyingTo === comment.id

    return (
      <div key={comment.id} className={cn('space-y-2', depth > 0 && 'ml-9')}>
        <div className="flex items-start gap-2">
          <Avatar src={comment.author?.avatar} name={comment.author?.displayName ?? ''} size="sm" />
          <div className="flex-1">
            <div className="bg-app-bg rounded-2xl px-3 py-2 cursor-pointer" onClick={openDetail}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text-primary mb-0.5">{comment.author?.displayName}</p>
                {isOwnComment && (
                  <button
                    className="text-xs text-error-500 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCommentMutation.mutate(comment.id)
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                <MentionText content={comment.content} />
              </p>
            </div>

            <div className="mt-1 ml-2 flex items-center gap-3 text-xs text-text-muted">
              <button
                className={cn('hover:underline', comment.isLiked && 'text-primary-600 font-medium')}
                onClick={(e) => {
                  e.stopPropagation()
                  likeCommentMutation.mutate(comment.id)
                }}
                disabled={likeCommentMutation.isPending}
              >
                {comment.isLiked ? 'Đã thích' : 'Thích'}
              </button>
              <button
                className="hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  setReplyingTo(isReplyingThis ? null : comment.id)
                }}
              >
                Trả lời
              </button>
              <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
              {comment.likesCount > 0 && <span>{comment.likesCount} lượt thích</span>}
            </div>

            {isReplyingThis && (
              <div className="mt-2 flex items-center gap-2 bg-app-bg rounded-full px-3 py-1.5">
                <MentionInput
                  value={replyText}
                  onChange={setReplyText}
                  placeholder="Viết phản hồi..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  onSubmit={() => {
                    if (replyText.trim()) commentMutation.mutate({ content: replyText.trim(), parentId: comment.id })
                  }}
                />
                {replyText.trim() && (
                  <button
                    onClick={() => commentMutation.mutate({ content: replyText.trim(), parentId: comment.id })}
                    disabled={commentMutation.isPending}
                    className="text-primary-500 hover:text-primary-600 disabled:opacity-50 text-sm font-semibold"
                  >
                    Gửi
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {childReplies.length > 0 && <div className="space-y-2">{childReplies.map(child => renderComment(child, depth + 1))}</div>}
      </div>
    )
  }

  const renderPostMedia = () => {
    const images = imageUrls.filter(Boolean)
    if (images.length === 0) return null

    const visible = images.slice(0, 5)
    const extraCount = images.length - 5

    if (images.length === 1) {
      return (
        <div className="p-3 pb-2">
          <button type="button" onClick={openDetail} className="w-full border-2 border-border-light bg-app-bg overflow-hidden rounded-md">
            <img src={images[0]} alt="Ảnh bài viết" className="w-full h-64 md:h-80 object-cover" loading="lazy" />
          </button>
        </div>
      )
    }

    if (images.length === 2) {
      return (
        <div className="p-3 pb-2">
          <button type="button" onClick={openDetail} className="w-full border-2 border-border-light bg-app-bg overflow-hidden rounded-md">
            <div className="grid grid-cols-2 gap-[2px] h-64 md:h-80">
              {images.slice(0, 2).map((img, idx) => (
                <img key={idx} src={img} alt={`Ảnh bài viết ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
              ))}
            </div>
          </button>
        </div>
      )
    }

    if (images.length === 3) {
      return (
        <div className="p-3 pb-2">
          <button type="button" onClick={openDetail} className="w-full border-2 border-border-light bg-app-bg overflow-hidden rounded-md">
            <div className="grid grid-cols-2 grid-rows-2 gap-[2px] h-64 md:h-80">
              <img src={images[0]} alt="Ảnh bài viết 1" className="w-full h-full object-cover row-span-2" loading="lazy" />
              <img src={images[1]} alt="Ảnh bài viết 2" className="w-full h-full object-cover" loading="lazy" />
              <img src={images[2]} alt="Ảnh bài viết 3" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </button>
        </div>
      )
    }

    if (images.length === 4) {
      return (
        <div className="p-3 pb-2">
          <button type="button" onClick={openDetail} className="w-full border-2 border-border-light bg-app-bg overflow-hidden rounded-md">
            <div className="grid grid-cols-2 grid-rows-2 gap-[2px] h-64 md:h-80">
              {images.slice(0, 4).map((img, idx) => (
                <img key={idx} src={img} alt={`Ảnh bài viết ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
              ))}
            </div>
          </button>
        </div>
      )
    }

    return (
      <div className="p-3 pb-2">
        <button type="button" onClick={openDetail} className="w-full border-2 border-border-light bg-app-bg overflow-hidden rounded-md">
          <div className="grid grid-cols-2 grid-rows-2 gap-[2px] h-64 md:h-80">
            <img src={visible[0]} alt="Ảnh bài viết 1" className="w-full h-full object-cover row-span-2" loading="lazy" />
            <img src={visible[1]} alt="Ảnh bài viết 2" className="w-full h-full object-cover" loading="lazy" />
            <img src={visible[2]} alt="Ảnh bài viết 3" className="w-full h-full object-cover" loading="lazy" />
            <div className="relative w-full h-full">
              <img src={visible[3]} alt="Ảnh bài viết 4" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="relative w-full h-full">
              <img src={visible[4]} alt="Ảnh bài viết 5" className="w-full h-full object-cover" loading="lazy" />
              {extraCount > 0 && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-xl font-bold">
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
        </button>
      </div>
    )
  }

  const renderPostVideos = () => {
    if (videoUrls.length === 0) return null
    return (
      <div className="p-3 pt-0 space-y-2">
        {videoUrls.slice(0, 2).map((url, idx) => (
          <div key={`${post.id}-video-${idx}`} className="w-full overflow-hidden rounded-md border-2 border-border-light bg-app-bg">
            <video src={url} className="w-full max-h-96 object-cover" controls preload="metadata" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <article className="bg-white rounded-xl border border-border-light shadow-card overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isGroupPost ? (
              <>
                <div className="relative flex-shrink-0 w-12 h-12">
                  <div className="w-11 h-11 rounded-xl overflow-hidden border border-border-light bg-app-bg shadow-sm">
                    {displayGroupCoverUrl ? (
                      <img src={displayGroupCoverUrl} alt={displayGroupName || fallbackGroupLabel} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-primary-50 text-primary-700 grid place-items-center text-[11px] font-semibold px-1 text-center">
                        {(displayGroupName || fallbackGroupLabel).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <Link to={`/profile/${post.authorId}`} className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1px] shadow-sm border border-white">
                    <Avatar src={post.author?.avatar} name={post.author?.displayName ?? ''} size="xs" />
                  </Link>
                </div>

                <div className="flex flex-col min-w-0">
                  <Link
                    to={`/groups/${post.groupId}`}
                    className="text-[15px] leading-tight font-semibold text-text-primary truncate hover:underline"
                    title={displayGroupName || fallbackGroupLabel}
                  >
                    {displayGroupName || fallbackGroupLabel}
                  </Link>
                  <div className="flex items-center text-[12px] text-text-muted mt-0.5 gap-1 min-w-0">
                    <Link to={`/profile/${post.authorId}`} className="hover:underline truncate max-w-[180px]">
                      {post.author?.displayName}
                    </Link>
                    <span aria-hidden="true">{dotSeparator}</span>
                    <button type="button" onClick={openDetail} className="hover:underline whitespace-nowrap">
                      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
                    </button>
                    <span aria-hidden="true">{dotSeparator}</span>
                    <span className="flex items-center text-text-muted" title={privacyLabel}>
                      {post.privacy === 'PUBLIC' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>}
                      {post.privacy === 'FRIENDS' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>}
                      {post.privacy === 'PRIVATE' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link to={`/profile/${post.authorId}`} className="flex-shrink-0">
                  <Avatar src={post.author?.avatar} name={post.author?.displayName ?? ''} size="sm" />
                </Link>
                <div className="flex flex-col min-w-0">
                  <Link to={`/profile/${post.authorId}`} className="text-[14px] leading-tight font-semibold text-text-primary hover:underline truncate">
                    {post.author?.displayName}
                  </Link>
                  <div className="flex items-center text-[12px] text-text-muted mt-0.5 gap-1">
                    <button type="button" onClick={openDetail} className="hover:underline">
                      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
                    </button>
                    <span aria-hidden="true">{dotSeparator}</span>
                    <span className="flex items-center text-text-muted" title={privacyLabel}>
                      {post.privacy === 'PUBLIC' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>}
                      {post.privacy === 'FRIENDS' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>}
                      {post.privacy === 'PRIVATE' && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-text-secondary relative top-[2px]">
            <div className="relative ml-1">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-full hover:bg-hover-bg text-text-secondary transition-colors" aria-label="Tùy chọn">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border-light shadow-lg rounded-md z-20 py-1 overflow-hidden font-medium">
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        handleSharePost()
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-hover-bg text-sm text-text-primary"
                      disabled={shareMutation.isPending}
                    >
                      Chia sẻ bài viết
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        saveMutation.mutate()
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-hover-bg text-sm text-text-primary"
                      disabled={saveMutation.isPending}
                    >
                      {post.isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
                    </button>
                    <div className="my-1 border-t border-border-light" />

                    {isOwnPost || user?.role === 'ADMIN' ? (
                      <>
                        {isOwnPost && (
                          <button onClick={() => { setEditOpen(true); setMenuOpen(false) }} className="w-full text-left px-4 py-2 hover:bg-hover-bg text-sm text-text-primary">
                            Chỉnh sửa bài viết
                          </button>
                        )}
                        <button onClick={() => { if (window.confirm('Bạn có chắc chắn muốn xóa bài viết này?')) deletePostMutation.mutate() }} className="w-full text-left px-4 py-2 hover:bg-hover-bg text-sm text-red-500">
                          Xóa bài viết
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { setReportOpen(true); setMenuOpen(false) }} className="w-full text-left px-4 py-2 hover:bg-hover-bg text-sm text-text-primary">
                        Báo cáo bài viết
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>


        {post.content && (
          <button
            type="button"
            onClick={openDetail}
            className="mt-2 text-left w-full text-[21px] leading-8 font-semibold text-slate-800 line-clamp-2"
          >
            <MentionText content={post.content} />
          </button>
        )}

        {contentHashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {contentHashtags.map((tag, idx) => (
              <button
                key={`${post.id}-tag-${idx}`}
                type="button"
                onClick={openDetail}
                className="text-[13px] font-medium text-blue-600 hover:underline"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {documentUrls.length > 0 && (
          <div className="mt-3 space-y-2">
            {documentUrls.slice(0, 2).map((url, idx) => (
              <a
                key={`${post.id}-doc-${idx}`}
                href={url}
                download={getFileName(url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 grid place-items-center text-[11px] font-bold">
                    {getFileExtLabel(url)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{getFileName(url)}</p>
                    <p className="text-[12px] text-slate-500">Tài liệu đính kèm</p>
                  </div>
                </div>
                <span className="text-blue-500" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {renderPostMedia()}
      {renderPostVideos()}

      <div className="hidden lg:flex items-center justify-between border-t border-border-light px-4 py-2 bg-white">
        <div className="flex items-center gap-5">
          <button
            type="button"
            className={cn('flex items-center gap-1.5 text-sm', post.isLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-700')}
            onClick={() => likeMutation.mutate()}
          >
            <span className="text-lg leading-none">{post.isLiked ? '♥' : '♡'}</span>
            <span>{post.likesCount}</span>
          </button>
          <button type="button" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700" onClick={openDetail}>
            <span className="text-lg leading-none">💬</span>
            <span>{post.commentsCount}</span>
          </button>
        </div>
        <button type="button" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700" onClick={handleSharePost}>
          <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          <span>Chia sẻ</span>
        </button>
      </div>

      <div className="flex lg:hidden items-end border-t border-border-light px-3 pt-2 pb-2 bg-white gap-1 rounded-b-md">
        {[
          {
            id: 'like',
            label: post.isLiked ? 'Đã tim' : 'Tim',
            icon: post.isLiked ? '♥' : '♡',
            onClick: () => likeMutation.mutate(),
            active: post.isLiked,
          },
          {
            id: 'comment',
            label: 'Bình luận',
            icon: '💬',
            onClick: openDetail,
          },
          {
            id: 'share',
            label: post.isShared ? 'Đã chia sẻ' : 'Chia sẻ',
            icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>,
            onClick: handleSharePost,
            active: post.isShared,
          },
          {
            id: 'save',
            label: post.isSaved ? 'Đã lưu' : 'Lưu',
            icon: '🔖',
            onClick: () => saveMutation.mutate(),
            active: post.isSaved,
          },
        ].map(action => (
          <div key={action.id} className="flex-1 flex flex-col items-center">
            {action.id === 'like' && post.likesCount > 0 && (
              <span className="mb-1 text-[11px] leading-none text-red-500 bg-white border border-red-100 rounded-full px-1.5 py-0.5 shadow-sm">
                ♥ {post.likesCount}
              </span>
            )}
            {action.id !== 'like' && <span className="mb-1 h-[17px]" aria-hidden="true" />}
            <button
              onClick={action.onClick}
              aria-label={action.label}
              className={cn(
                'w-full h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-colors',
                action.id === 'like'
                  ? action.active
                    ? 'text-red-500 bg-red-50 hover:bg-red-100'
                    : 'text-text-secondary hover:bg-hover-bg'
                  : action.active
                    ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                    : 'text-text-secondary hover:bg-hover-bg'
              )}
              aria-pressed={action.active}
            >
              <span className={cn('leading-none', action.id === 'like' ? 'text-[22px]' : 'text-[20px]')}>{action.icon}</span>
              <span className="sr-only">{action.label}</span>
            </button>
          </div>
        ))}
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết bài viết" size="xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar src={post.author?.avatar} name={post.author?.displayName ?? ''} size="md" />
            <div>
              <p className="font-semibold text-text-primary">{post.author?.displayName}</p>
              <p className="text-xs text-text-muted">
                {timeAgo(post.createdAt)} · {post.privacy === 'PUBLIC' ? 'C\u00F4ng khai' : post.privacy === 'FRIENDS' ? 'B\u1EA1n b\u00E8' : 'Ri\u00EAng t\u01B0'}
              </p>
            </div>
          </div>

          <p className="text-sm text-text-primary whitespace-pre-wrap">
            <MentionText content={post.content} />
          </p>

          {imageUrls.length > 0 && (
            <div className={cn('grid gap-1', imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {imageUrls.map((img, idx) => (
                <img key={idx} src={img} alt={`Ảnh bài viết ${idx + 1}`} className="w-full h-56 object-cover rounded-md border border-border-light" />
              ))}
            </div>
          )}

          {videoUrls.length > 0 && (
            <div className="space-y-2">
              {videoUrls.map((url, idx) => (
                <video key={`${url}-${idx}`} src={url} className="w-full max-h-96 rounded-md border border-border-light bg-black object-contain" controls preload="metadata" />
              ))}
            </div>
          )}

          {documentUrls.length > 0 && (
            <div className="space-y-2">
              {documentUrls.map((url, idx) => (
                <a
                  key={`${post.id}-detail-doc-${idx}`}
                  href={url}
                  download={getFileName(url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 grid place-items-center text-[11px] font-bold">
                      {getFileExtLabel(url)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{getFileName(url)}</p>
                      <p className="text-[12px] text-slate-500">Tài liệu đính kèm</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-text-secondary border-y border-border-light py-2">
            <button type="button" onClick={openReactions} className="flex items-center gap-1 hover:underline">
              <span className="text-red-500">♥</span>
              {post.likesCount} người đã tim
            </button>
            <span>{post.commentsCount} bình luận</span>
          </div>

          <div className="flex items-center gap-2">
            <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="sm" />
            <div className="flex-1 flex items-center gap-2 bg-app-bg rounded-full px-4 py-2">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                placeholder="Viết bình luận..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                aria-label="Viết bình luận"
                onSubmit={() => { if (newComment.trim()) commentMutation.mutate({ content: newComment.trim() }) }}
              />
              {newComment.trim() && (
                <button
                  onClick={() => commentMutation.mutate({ content: newComment.trim() })}
                  disabled={commentMutation.isPending}
                  className="text-primary-500 hover:text-primary-600 disabled:opacity-50 text-sm font-semibold"
                >
                  Gửi
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {rootComments.length === 0 ? (
              <p className="text-sm text-text-muted">Chưa có bình luận nào</p>
            ) : (
              rootComments.map(comment => renderComment(comment))
            )}
          </div>
        </div>
      </Modal>

      <Modal open={reactionsOpen} onClose={() => setReactionsOpen(false)} title="Người đã thả cảm xúc" size="md">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {!reactions || reactions.length === 0 ? (
            <p className="text-sm text-text-muted">Chưa có ai thả cảm xúc</p>
          ) : (
            reactions.map(person => (
              <Link
                key={person.id}
                to={`/profile/${person.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-hover-bg"
                onClick={() => setReactionsOpen(false)}
              >
                <Avatar src={person.avatar} name={person.displayName} size="sm" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{person.displayName}</p>
                  <p className="text-xs text-text-muted">@{person.username}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Chỉnh sửa bài viết"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button
              onClick={() => updatePostMutation.mutate()}
              loading={updatePostMutation.isPending}
              disabled={!editContent.trim()}
            >
              Lưu
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <TextArea value={editContent} onChange={e => setEditContent(e.target.value)} rows={5} />
          <select
            value={editPrivacy}
            onChange={e => setEditPrivacy(e.target.value)}
            className="w-full h-10 rounded-md border border-border-main bg-white px-3 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="PUBLIC">Công khai</option>
            <option value="FRIENDS">Bạn bè</option>
            <option value="PRIVATE">Riêng tư</option>
          </select>
        </div>
      </Modal>
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Báo cáo bài viết"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>Hủy</Button>
            <Button
              onClick={() => reportMutation.mutate()}
              loading={reportMutation.isPending}
              disabled={!reportReason}
            >
              Gửi báo cáo
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Vui lòng chọn lý do báo cáo bài viết này. Quản trị viên sẽ xem xét và xử lý.</p>
          <select
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            className="w-full h-10 rounded-md border border-border-main bg-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="SPAM">Spam, vi phạm tiêu chuẩn</option>
            <option value="INAPPROPRIATE">Nội dung phản cảm, không phù hợp</option>
            <option value="HARASSMENT">Quấy rối, công kích cá nhân</option>
            <option value="FAKE_NEWS">Tin giả, sai sự thật</option>
            <option value="OTHER">Lý do khác...</option>
          </select>
          <TextArea 
            value={reportDesc} 
            onChange={e => setReportDesc(e.target.value)} 
            placeholder="Mô tả thêm (không bắt buộc)" 
            rows={3} 
          />
        </div>
      </Modal>
    </article>
  )
}

