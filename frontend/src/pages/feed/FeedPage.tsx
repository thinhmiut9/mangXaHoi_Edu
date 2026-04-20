import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '@/api/posts'
import { storiesApi, Story } from '@/api/stories'
import { uploadsApi } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { PostCard } from '@/components/shared/PostCard'
import { Modal } from '@/components/ui/Modal'
import { MentionTextarea } from '@/components/ui/MentionTextarea'

const PULL_TO_REFRESH_TRIGGER = 72
const PULL_TO_REFRESH_MAX = 96

function PostComposer() {
  const { user } = useAuthStore()
  const [composerOpen, setComposerOpen] = useState(false)
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isImageFile = (file: File) => file.type.startsWith('image/')
  const isVideoFile = (file: File) => {
    if (file.type.startsWith('video/')) return true
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    return ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const imageUrls: string[] = []
      const videoUrls: string[] = []
      const documentUrls: string[] = []
      if (selectedFiles.length > 0) {
        const uploaded = await Promise.all(
          selectedFiles.map(file => {
            if (isImageFile(file)) return uploadsApi.uploadImage(file, 'posts').then(item => ({ type: 'image' as const, url: item.url }))
            if (isVideoFile(file)) return uploadsApi.uploadVideo(file, 'posts').then(item => ({ type: 'video' as const, url: item.url }))
            return uploadsApi.uploadDocument(file).then(item => ({ type: 'document' as const, url: item.url }))
          })
        )
        uploaded.forEach(item => {
          if (item.type === 'image') imageUrls.push(item.url)
          if (item.type === 'video') videoUrls.push(item.url)
          if (item.type === 'document') documentUrls.push(item.url)
        })
      }
      return postsApi.createPost({ content, privacy, imageUrls, videoUrls, documentUrls })
    },
    onSuccess: () => {
      setContent('')
      setSelectedFiles([])
      setImagePreviewUrls([])
      setComposerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      toast.success('Đã đăng bài viết!')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const onPickFiles = () => fileInputRef.current?.click()
  const onInsertTag = () => {
    setContent((prev) => {
      const trimmed = prev.trimEnd()
      if (!trimmed) return '@'
      return `${trimmed} @`
    })
  }

  const onFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const merged = [...selectedFiles, ...files].slice(0, 8)
    setSelectedFiles(merged)

    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    setImagePreviewUrls(merged.filter(isImageFile).map(file => URL.createObjectURL(file)))

    e.target.value = ''
  }

  const removeImageAt = (index: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(nextFiles)

    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    setImagePreviewUrls(nextFiles.filter(isImageFile).map(file => URL.createObjectURL(file)))
  }
  const documentFiles = selectedFiles.filter((file) => !isImageFile(file) && !isVideoFile(file))
  const videoFiles = selectedFiles.filter((file) => isVideoFile(file))

  return (
    <>
      <div className="bg-white rounded-lg shadow-card border border-border-light p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="md" />
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex-1 text-left bg-app-bg rounded-full px-4 py-2.5 text-sm text-text-secondary hover:bg-hover-bg transition-colors"
          >
            {`${user?.displayName} ơi, bạn đang nghĩ gì?`}
          </button>
        </div>

        <hr className="border-border-light mb-3" />
        <div className="flex gap-2">
          {[
            { icon: '📎', label: 'Ảnh/Tài liệu' },
            { icon: '😊', label: 'Cảm xúc' },
            { icon: '📍', label: 'Vị trí' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => setComposerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-hover-bg transition-colors text-sm font-medium text-text-secondary"
            >
              <span>{a.icon}</span>
              <span className="hidden sm:block">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Tạo bài viết"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar src={user?.avatar} name={user?.displayName ?? ''} size="md" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-text-primary truncate">{user?.displayName}</p>
              <select
                value={privacy}
                onChange={e => setPrivacy(e.target.value as typeof privacy)}
                className="mt-1 text-xs bg-app-bg border border-border-light rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-300"
                aria-label="Quyền riêng tư"
              >
                <option value="PUBLIC">Công khai</option>
                <option value="FRIENDS">Bạn bè</option>
                <option value="PRIVATE">Chỉ mình tôi</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border-light px-1 py-1">
            <MentionTextarea
              value={content}
              onChange={setContent}
              placeholder={`${user?.displayName} ơi, bạn đang nghĩ gì thế?`}
              className="w-full min-h-[150px] bg-white rounded-xl px-3 py-2 text-3xl leading-tight resize-none border-0 focus:outline-none focus:ring-0"
              rows={4}
              aria-label="Viết bài"
            />
          </div>

          <div className="rounded-xl border border-border-light bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-bold text-text-primary leading-none">Thêm vào bài viết của bạn</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPickFiles}
                  aria-label="Thêm ảnh/video"
                  className="rounded-lg border border-border-light bg-app-bg p-2 text-text-primary hover:bg-hover-bg"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
                    <path d="M9 10a1.5 1.5 0 1 0 0-.001" />
                    <path d="m20 15-5-5-4 4-2-2-5 5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onInsertTag}
                  aria-label="Gắn thẻ"
                  className="rounded-lg border border-border-light bg-app-bg p-2 text-text-primary hover:bg-hover-bg"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7" />
                    <path d="M14 4h6v6" />
                    <path d="M10 14 20 4" />
                  </svg>
                </button>
              </div>
            </div>
            {!!selectedFiles.length && (
              <p className="mt-2 text-xs text-text-secondary">Đã chọn {selectedFiles.length} tệp</p>
            )}
          </div>

          {imagePreviewUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {imagePreviewUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative rounded-xl overflow-hidden border border-border-light">
                  <img src={url} alt={`Ảnh đã chọn ${idx + 1}`} className="w-full h-32 object-cover" />
                  <button
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded"
                    onClick={() => removeImageAt(idx)}
                    aria-label="Xóa ảnh"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}

          {videoFiles.length > 0 && (
            <div className="space-y-1">
              {selectedFiles.map((file, idx) => ({ file, idx })).filter(item => isVideoFile(item.file)).map(({ file, idx }) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-xl border border-border-light bg-app-bg px-3 py-2">
                  <span className="text-sm text-text-primary truncate pr-3">Video {file.name}</span>
                  <button className="text-xs text-text-secondary hover:text-text-primary" onClick={() => removeImageAt(idx)} aria-label="Xóa tệp video">
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}

          {documentFiles.length > 0 && (
            <div className="space-y-1">
              {selectedFiles.map((file, idx) => ({ file, idx })).filter(item => !isImageFile(item.file) && !isVideoFile(item.file)).map(({ file, idx }) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-xl border border-border-light bg-app-bg px-3 py-2">
                  <span className="text-sm text-text-primary truncate pr-3">Tệp {file.name}</span>
                  <button className="text-xs text-text-secondary hover:text-text-primary" onClick={() => removeImageAt(idx)} aria-label="Xóa tệp">
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!content.trim() || mutation.isPending}
            className="w-full"
          >
            Tiếp
          </Button>
        </div>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        multiple
        className="hidden"
        onChange={onFilesSelected}
      />
    </>
  )
}

type StoryGroup = {
  userId: string
  author: Story['author']
  stories: Story[]
  latestAt: string
  hasUnviewed: boolean
}

function groupStoriesByAuthor(stories: Story[]): StoryGroup[] {
  const map = new Map<string, StoryGroup>()

  for (const story of stories) {
    const key = story.author.id
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        userId: key,
        author: story.author,
        stories: [story],
        latestAt: story.createdAt,
        hasUnviewed: !story.isViewed,
      })
      continue
    }

    existing.stories.push(story)
    if (story.createdAt > existing.latestAt) existing.latestAt = story.createdAt
    if (!story.isViewed) existing.hasUnviewed = true
  }

  return Array.from(map.values())
    .map(group => ({
      ...group,
      stories: group.stories.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

function StoryComposerModal({
  open,
  creating,
  onClose,
  onSubmit,
}: {
  open: boolean
  creating: boolean
  onClose: () => void
  onSubmit: (payload: { file: File; content?: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!open) {
      setFile(null)
      setContent('')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
  }, [open, previewUrl])

  const onSelectFile = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const isVideo = !!file?.type.startsWith('video/')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo tin"
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={creating}>Hủy</Button>
          <Button
            onClick={() => file && onSubmit({ file, content: content.trim() || undefined })}
            loading={creating}
            disabled={!file || creating}
          >
            Đăng tin
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Chọn ảnh/video
          </Button>
          <span className="text-sm text-text-secondary self-center truncate">{file?.name ?? 'Chưa chọn tệp'}</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={onSelectFile}
        />

        {previewUrl && (
          <div className="rounded-lg overflow-hidden border border-border-light bg-black">
            {isVideo ? (
              <video src={previewUrl} className="w-full max-h-72 object-contain" controls playsInline />
            ) : (
              <img src={previewUrl} alt="Xem trước tin" className="w-full max-h-72 object-contain" />
            )}
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Viết nội dung cho tin (không bắt buộc)"
          maxLength={300}
          className="w-full min-h-[90px] bg-app-bg border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>
    </Modal>
  )
}

function StoryStrip({
  groups,
  isLoading,
  creating,
  onCreate,
  onOpenGroup,
}: {
  groups: StoryGroup[]
  isLoading: boolean
  creating: boolean
  onCreate: () => void
  onOpenGroup: (groupIndex: number) => void
}) {
  const { user } = useAuthStore()

  return (
    <div className="bg-white rounded-lg shadow-card border border-border-light p-3 mb-4">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <button
          className="relative w-28 h-44 rounded-xl overflow-hidden border border-border-light bg-app-bg flex-shrink-0"
          onClick={onCreate}
          disabled={creating}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Ảnh đại diện" className="w-full h-full object-cover opacity-75" />
          ) : (
            <div className="w-full h-full bg-primary-100" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-white/95 p-2 text-center">
            <div className="w-7 h-7 mx-auto -mt-5 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold">+</div>
            <p className="text-xs font-semibold text-text-primary mt-1">{creating ? 'Đang tải...' : 'Tạo tin'}</p>
          </div>
        </button>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-28 h-44 rounded-xl bg-app-bg animate-pulse border border-border-light flex-shrink-0" />
          ))
        ) : groups.length === 0 ? (
          <div className="text-sm text-text-secondary px-2">Chưa có tin nào từ bạn bè trong 24 giờ qua.</div>
        ) : (
          groups.map((group, index) => {
            const latestStory = group.stories[group.stories.length - 1]
            return (
              <button
                key={group.userId}
                onClick={() => onOpenGroup(index)}
                className="relative w-28 h-44 rounded-xl overflow-hidden border border-border-light flex-shrink-0"
              >
                {latestStory.type === 'VIDEO' ? (
                  <video src={latestStory.mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  <img src={latestStory.mediaUrl} alt={group.author.displayName} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
                <div className="absolute top-2 left-2">
                  <Avatar src={group.author.avatar} name={group.author.displayName} size="xs" className={group.hasUnviewed ? 'ring-2 ring-primary-400' : 'ring-2 ring-white'} />
                </div>
                {group.stories.length > 1 && (
                  <div className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 bg-black/60 text-[11px] text-white">
                    +{group.stories.length - 1}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs text-white font-medium truncate">{group.author.displayName}</p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function StoryViewer({
  open,
  groups,
  startGroupIndex,
  onClose,
  onViewed,
}: {
  open: boolean
  groups: StoryGroup[]
  startGroupIndex: number
  onClose: () => void
  onViewed: (storyId: string) => void
}) {
  const { user } = useAuthStore()
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setGroupIndex(startGroupIndex)
    setStoryIndex(0)
  }, [open, startGroupIndex])

  const activeGroup = groups[groupIndex]
  const activeStory = activeGroup?.stories[storyIndex]
  const isOwnerViewing = !!activeStory && activeStory.author.id === user?.id

  const viewersQuery = useQuery({
    queryKey: ['story-viewers', activeStory?.id],
    queryFn: () => storiesApi.getViewers(activeStory!.id),
    enabled: open && !!activeStory && isOwnerViewing,
    staleTime: 15_000,
  })

  const goNext = () => {
    if (!activeGroup) return

    if (storyIndex < activeGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1)
      return
    }

    if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1)
      setStoryIndex(0)
      return
    }

    onClose()
  }

  const goPrev = () => {
    if (!activeGroup) return

    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1)
      return
    }

    if (groupIndex > 0) {
      const prevGroupIndex = groupIndex - 1
      const prevGroup = groups[prevGroupIndex]
      setGroupIndex(prevGroupIndex)
      setStoryIndex(Math.max(0, prevGroup.stories.length - 1))
    }
  }

  useEffect(() => {
    if (!open || !activeStory) return
    onViewed(activeStory.id)
  }, [open, activeStory, onViewed])

  useEffect(() => {
    if (!open || !activeStory || activeStory.type !== 'IMAGE') return
    const timer = window.setTimeout(() => {
      goNext()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [open, activeStory, groupIndex, storyIndex])

  return (
    <Modal open={open} onClose={onClose} title="Xem tin" size="2xl">
      {!activeStory || !activeGroup ? null : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Avatar src={activeGroup.author.avatar} name={activeGroup.author.displayName} size="sm" />
            <div>
              <p className="text-sm font-semibold text-text-primary">{activeGroup.author.displayName}</p>
              <p className="text-xs text-text-secondary">{storyIndex + 1}/{activeGroup.stories.length} • Tin tự ẩn sau 24 giờ</p>
            </div>
          </div>

          <div className="rounded-lg overflow-hidden border border-border-light bg-black">
            {activeStory.type === 'VIDEO' ? (
              <video
                src={activeStory.mediaUrl}
                className="w-full max-h-[70vh] object-contain"
                controls
                autoPlay
                playsInline
                onEnded={goNext}
              />
            ) : (
              <img src={activeStory.mediaUrl} alt="Story" className="w-full max-h-[70vh] object-contain" />
            )}
          </div>

          {activeStory.content && (
            <p className="mt-3 text-sm text-text-primary whitespace-pre-wrap">{activeStory.content}</p>
          )}

          {isOwnerViewing && (
            <div className="mt-3 rounded-lg border border-border-light bg-app-bg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary">
                  Người đã xem ({viewersQuery.data?.length ?? 0})
                </p>
              </div>
              {viewersQuery.isLoading ? (
                <p className="text-xs text-text-secondary">Đang tải danh sách...</p>
              ) : !viewersQuery.data?.length ? (
                <p className="text-xs text-text-secondary">Chưa có ai xem tin này.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-2">
                  {viewersQuery.data.map((entry) => (
                    <div key={`${entry.user.id}-${entry.viewedAt}`} className="flex items-center gap-2">
                      <Avatar src={entry.user.avatar} name={entry.user.displayName} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-text-primary truncate">{entry.user.displayName}</p>
                        <p className="text-[11px] text-text-secondary">
                          {new Date(entry.viewedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 gap-2">
            <Button variant="secondary" size="sm" onClick={goPrev} disabled={groupIndex === 0 && storyIndex === 0}>Tin trước</Button>
            <span className="text-xs text-text-secondary">Nhóm {groupIndex + 1}/{groups.length}</span>
            <Button variant="secondary" size="sm" onClick={goNext}>Tin tiếp</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function FeedPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const pullStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const isVideoFile = (file: File) => {
    if (file.type.startsWith('video/')) return true
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    return ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext)
  }

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 1 }) => postsApi.getFeed(pageParam as number),
    getNextPageParam: (lastPage) => lastPage.meta?.hasNext ? (lastPage.meta.page + 1) : undefined,
    initialPageParam: 1,
  })

  const storiesQuery = useQuery({
    queryKey: ['stories'],
    queryFn: storiesApi.getFeed,
  })

  const createStoryMutation = useMutation({
    mutationFn: async (payload: { file: File; content?: string }) => {
      const isVideo = isVideoFile(payload.file)
      const uploaded = isVideo
        ? await uploadsApi.uploadVideo(payload.file, 'stories')
        : await uploadsApi.uploadImage(payload.file, 'stories')

      return storiesApi.createStory({
        type: isVideo ? 'VIDEO' : 'IMAGE',
        mediaUrl: uploaded.url,
        content: payload.content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      toast.success('Đăng tin thành công. Tin sẽ tự ẩn sau 24 giờ.')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const viewedMutation = useMutation({
    mutationFn: (storyId: string) => storiesApi.markViewed(storyId),
  })
  const viewedStoryIdsRef = useRef<Set<string>>(new Set())
  const handleViewed = useCallback((storyId: string) => {
    if (viewedStoryIdsRef.current.has(storyId)) return
    viewedStoryIdsRef.current.add(storyId)
    viewedMutation.mutate(storyId)
  }, [viewedMutation])

  const posts = data?.pages.flatMap(p => p.data) ?? []
  const storyGroups = useMemo(() => groupStoriesByAuthor(storiesQuery.data ?? []), [storiesQuery.data])

  useEffect(() => {
    pullDistanceRef.current = pullDistance
  }, [pullDistance])

  const refreshAtTop = useCallback(async () => {
    if (isPullRefreshing) return
    setIsPullRefreshing(true)
    try {
      await Promise.all([refetch(), storiesQuery.refetch()])
    } finally {
      setIsPullRefreshing(false)
      setPullDistance(0)
    }
  }, [isPullRefreshing, refetch, storiesQuery])

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice) return

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || isPullRefreshing) return
      pullStartYRef.current = event.touches[0]?.clientY ?? null
      isPullingRef.current = pullStartYRef.current !== null
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isPullingRef.current || pullStartYRef.current === null) return
      if (window.scrollY > 0) {
        isPullingRef.current = false
        setPullDistance(0)
        return
      }

      const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
      const delta = currentY - pullStartYRef.current
      if (delta <= 0) {
        setPullDistance(0)
        return
      }

      const distance = Math.min(PULL_TO_REFRESH_MAX, delta * 0.5)
      setPullDistance(distance)

      if (delta > 8) event.preventDefault()
    }

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return
      isPullingRef.current = false
      pullStartYRef.current = null

      if (pullDistanceRef.current >= PULL_TO_REFRESH_TRIGGER) {
        void refreshAtTop()
      } else {
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isPullRefreshing, refreshAtTop])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (!hasNextPage || isFetchingNextPage || isLoading || isError) return
        fetchNextPage()
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, posts.length])

  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [storyComposerOpen, setStoryComposerOpen] = useState(false)
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)

  return (
    <div className="relative">
      <div
        className="flex justify-center overflow-hidden transition-[max-height] duration-200"
        style={{ maxHeight: pullDistance > 0 || isPullRefreshing ? 44 : 0 }}
      >
        <div className="mt-1 h-7 w-7 rounded-full border border-border-light bg-white/90 shadow-sm grid place-items-center">
          <span
            className={`h-4 w-4 rounded-full border-2 border-slate-200 border-t-primary-500 ${isPullRefreshing ? 'animate-spin' : ''}`}
            style={!isPullRefreshing ? { transform: `rotate(${Math.min(360, (pullDistance / PULL_TO_REFRESH_TRIGGER) * 360)}deg)` } : undefined}
          />
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPullRefreshing || pullDistance === 0 ? 'transform 160ms ease-out' : undefined,
        }}
      >
      <StoryStrip
        groups={storyGroups}
        isLoading={storiesQuery.isLoading}
        creating={createStoryMutation.isPending}
        onCreate={() => setStoryComposerOpen(true)}
        onOpenGroup={(groupIndex) => {
          setSelectedGroupIndex(groupIndex)
          setStoryViewerOpen(true)
        }}
      />

      <PostComposer />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <EmptyState
          title="Không thể tải bài viết"
          description={extractError(error)}
          action={<Button onClick={() => refetch()} variant="secondary">Thử lại</Button>}
          icon={<span className="text-3xl">⚠️</span>}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Bảng tin chưa có bài viết"
          description="Hiện bạn chưa có bạn bè (hoặc bạn bè chưa đăng bài). Hãy tìm thêm bạn bè mới để bảng tin sôi động hơn."
          action={
            <Button onClick={() => navigate('/friends')} variant="secondary">
              Tìm bạn bè mới
            </Button>
          }
          icon={<span className="text-3xl">📰</span>}
        />
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}

          <div ref={loadMoreRef} className="h-6" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-2 text-sm text-text-secondary">
              Đang tải thêm bài viết...
            </div>
          )}
        </div>
      )}
      </div>

      <StoryComposerModal
        open={storyComposerOpen}
        creating={createStoryMutation.isPending}
        onClose={() => setStoryComposerOpen(false)}
        onSubmit={(payload) => {
          createStoryMutation.mutate(payload, {
            onSuccess: () => setStoryComposerOpen(false),
          })
        }}
      />

      <StoryViewer
        open={storyViewerOpen}
        groups={storyGroups}
        startGroupIndex={selectedGroupIndex}
        onClose={() => setStoryViewerOpen(false)}
        onViewed={handleViewed}
      />
    </div>
  )
}
