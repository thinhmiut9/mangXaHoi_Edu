import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { groupsApi, uploadsApi } from '@/api/index'
import { Post, postsApi } from '@/api/posts'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { PostCard } from '@/components/shared/PostCard'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Modal } from '@/components/ui/Modal'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator'

type Tag = '# UI' | '# Database' | '# Meeting'
type GroupMember = {
  id: string
  name: string
  avatar: string
  role: string
  roleText: string
}

function roleLabel(role: string) {
  if (role === 'OWNER') return 'Admin'
  if (role === 'MODERATOR') return 'Moderator'
  return 'Member'
}

function privacyLabel(privacy?: 'PUBLIC' | 'PRIVATE') {
  return privacy === 'PRIVATE' ? 'Riêng tư' : 'Công khai'
}

function extractMembers(raw: any, ownerId?: string): GroupMember[] {
  const rows = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return rows.map((row: any, index: number) => {
    const user = row?.u?.properties ?? row?.user?.properties ?? row?.user ?? row ?? {}
    const id = user.userId ?? user.id ?? `member-${index}`
    const role = row.role ?? (ownerId && id === ownerId ? 'OWNER' : 'MEMBER')
    return {
      id,
      name: user.displayName ?? 'Thành viên',
      avatar: user.avatarUrl ?? user.avatar ?? '',
      role,
      roleText: roleLabel(role),
    }
  })
}

function deriveFiles(posts: Post[]) {
  const items: Array<{ id: string; name: string; size: string; url: string }> = []
  posts.forEach((post) => {
    ;(post.documentUrls ?? []).forEach((url, idx) => {
      const noQuery = url.split('?')[0]
      const name = noQuery.split('/').pop() || `Tài liệu #${idx + 1}`
      items.push({
        id: `${post.id}-${idx}`,
        name,
        size: 'Tài liệu đính kèm',
        url,
      })
    })
  })
  return items.slice(0, 8)
}

export default function GroupDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [content, setContent] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isImageFile = (file: File) => file.type.startsWith('image/')
  const isVideoFile = (file: File) => {
    if (file.type.startsWith('video/')) return true
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    return ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext)
  }

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

  const groupQuery = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.getGroup(id),
    enabled: !!id,
  })

  const membersQuery = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => groupsApi.getMembers(id),
    enabled: !!id,
  })

  const postsQuery = useInfiniteQuery({
    queryKey: ['group-posts', id],
    queryFn: ({ pageParam = 1 }) => postsApi.getGroupPosts(id, pageParam as number, 10),
    initialPageParam: 1,
    enabled: !!id,
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
  })

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim()
      if (!trimmed) throw new Error('Nội dung thảo luận không được để trống')

      const imageUrls: string[] = []
      const videoUrls: string[] = []
      const documentUrls: string[] = []
      if (selectedFiles.length) {
        const uploaded = await Promise.all(
          selectedFiles.map((file) => {
            if (isImageFile(file)) return uploadsApi.uploadImage(file, 'posts').then(item => ({ type: 'image' as const, url: item.url }))
            if (isVideoFile(file)) return uploadsApi.uploadVideo(file, 'posts').then(item => ({ type: 'video' as const, url: item.url }))
            return uploadsApi.uploadDocument(file).then(item => ({ type: 'document' as const, url: item.url }))
          })
        )
        uploaded.forEach((item) => {
          if (item.type === 'image') imageUrls.push(item.url)
          if (item.type === 'video') videoUrls.push(item.url)
          if (item.type === 'document') documentUrls.push(item.url)
        })
      }

      return postsApi.createPost({
        content: trimmed,
        imageUrls,
        videoUrls,
        documentUrls,
        privacy: 'GROUP',
        groupId: id,
      })
    },
    onSuccess: () => {
      setContent('')
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
      setImagePreviewUrls([])
      setSelectedFiles([])
      setComposerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['group-posts', id] })
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      toast.success('Đăng thảo luận thành công')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const leaveMutation = useMutation({
    mutationFn: () => groupsApi.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      toast.success('Đã rời nhóm')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const group = groupQuery.data
  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.data) ?? [], [postsQuery.data])
  const members = useMemo(() => extractMembers(membersQuery.data, group?.ownerId), [membersQuery.data, group?.ownerId])
  const featuredMembers = members.slice(0, 5)
  const files = useMemo(() => deriveFiles(posts), [posts])

  const weeklyActivities = useMemo(() => {
    const now = Date.now()
    return posts.filter((post) => now - new Date(post.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length
  }, [posts])

  const stats = useMemo(
    () => [
      { label: 'Bài viết', value: String(posts.length).padStart(2, '0') },
      { label: 'Thành viên', value: String(group?.membersCount ?? members.length).padStart(2, '0') },
      { label: 'Tài liệu', value: String(files.length).padStart(2, '0') },
      { label: 'Hoạt động tuần', value: String(weeklyActivities).padStart(2, '0') },
    ],
    [posts.length, group?.membersCount, members.length, files.length, weeklyActivities]
  )

  const activeBadge = weeklyActivities > 0 ? 'Nhóm đang hoạt động' : 'Nhóm ít hoạt động'

  const addTag = (tag: Tag) => {
    if (content.includes(tag)) return
    setContent((prev) => (prev.trim() ? `${prev} ${tag}` : tag))
  }

  const onPickFiles = () => fileInputRef.current?.click()

  const onFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const merged = [...selectedFiles, ...files].slice(0, 8)
    setSelectedFiles(merged)

    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImagePreviewUrls(merged.filter(isImageFile).map((file) => URL.createObjectURL(file)))
    e.target.value = ''
  }

  const removeFileAt = (index: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(nextFiles)

    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImagePreviewUrls(nextFiles.filter(isImageFile).map((file) => URL.createObjectURL(file)))
  }

  const videoFiles = selectedFiles.filter((file) => isVideoFile(file))
  const documentFiles = selectedFiles.filter((file) => !isImageFile(file) && !isVideoFile(file))

  const refreshPage = useCallback(async () => {
    await Promise.all([
      groupQuery.refetch(),
      membersQuery.refetch(),
      postsQuery.refetch(),
    ])
  }, [groupQuery, membersQuery, postsQuery])
  const { pullDistance, isRefreshing } = usePullToRefresh(refreshPage)

  if (groupQuery.isLoading) return <PostSkeleton />

  if (!group) {
    return <div className='rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500'>Không tìm thấy nhóm.</div>
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
    <div className='min-h-screen bg-[#f3f6fb] text-slate-800'>
      <div className='mx-auto max-w-[1500px] px-0 sm:px-6 pb-8 pt-0 sm:pt-2'>
        <main className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-0 sm:gap-6'>
          <section className='space-y-4 sm:space-y-6'>
            <article className='overflow-hidden rounded-none sm:rounded-[32px] sm:border border-slate-200 bg-white shadow-sm'>
              <div className='relative h-[180px] sm:h-[220px] md:h-[260px]'>
                <img
                  src={group.coverUrl || group.coverPhoto || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&h=520&fit=crop'}
                  alt='cover'
                  className='h-full w-full object-cover'
                />
                <div className='absolute inset-0 bg-slate-900/45' />

                <div className='absolute inset-0 flex items-end justify-between p-4 sm:p-6'>
                  <div className='text-white min-w-0 flex-1 mr-2'>
                    <span className='inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur'>{activeBadge}</span>
                    <h1 className='mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight truncate'>{group.name}</h1>
                    <p className='mt-1 text-xs sm:text-sm text-slate-100 line-clamp-2'>
                      {group.description || 'Nhóm cộng đồng EduSocial'} • {group.membersCount ?? members.length} thành viên • {privacyLabel(group.privacy)}
                    </p>
                  </div>

                  <div className='flex flex-col sm:flex-row gap-2 shrink-0'>
                    <button
                      onClick={() => toast.info('Tính năng mời thành viên sẽ được kết nối ở bước tiếp theo.')}
                      className='rounded-xl bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100'
                    >
                      Mời
                    </button>
                    <button
                      onClick={() => leaveMutation.mutate()}
                      className='rounded-xl border border-white/50 bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-white/20'
                    >
                      {leaveMutation.isPending ? 'Đang xử lý...' : 'Rời nhóm'}
                    </button>
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200 p-3 sm:p-4'>
                {stats.map((item) => (
                  <div key={item.label} className='rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3'>
                    <p className='text-xl sm:text-2xl font-semibold leading-none text-slate-900'>{item.value}</p>
                    <p className='mt-2 text-xs sm:text-sm text-slate-500'>{item.label}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className='rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-cyan-50/40 p-5 shadow-sm'>
              <div className='flex items-center gap-3 mb-3'>
                <Avatar src={user?.avatar} name={user?.displayName || ''} size='md' />
                <button
                  type='button'
                  onClick={() => setComposerOpen(true)}
                  className='flex-1 text-left bg-white/90 rounded-full px-4 py-2.5 text-sm text-slate-600 border border-emerald-100 hover:bg-white transition-colors'
                >
                  {`${user?.displayName || 'Bạn'} ơi, chia sẻ ý tưởng cho nhóm nhé...`}
                </button>
              </div>
              <hr className='border-emerald-100 mb-3' />
              <div className='flex gap-2'>
                {[
                  { icon: '📎', label: 'Đính kèm' },
                  { icon: '💡', label: 'Ý tưởng' },
                  { icon: '✅', label: 'Tiến độ' },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={() => setComposerOpen(true)}
                    className='flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-emerald-100/60 transition-colors text-sm font-medium text-slate-700'
                  >
                    <span>{a.icon}</span>
                    <span className='hidden sm:block'>{a.label}</span>
                  </button>
                ))}
              </div>
            </article>

            <div className='space-y-4'>
              {postsQuery.isLoading ? (
                <PostSkeleton />
              ) : posts.length === 0 ? (
                <article className='rounded-[28px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm'>
                  Nhóm chưa có bài thảo luận nào.
                </article>
              ) : (
                posts.map((post) => <PostCard key={post.id} post={post} />)
              )}

              {postsQuery.hasNextPage && (
                <div className='flex justify-center'>
                  <Button variant='secondary' loading={postsQuery.isFetchingNextPage} onClick={() => postsQuery.fetchNextPage()}>
                    Tải thêm bài viết
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Right sidebar: hidden on mobile, shows below on sm */}
          <aside className='space-y-4 lg:block'>
            <article className='rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm'>
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='text-lg font-bold text-slate-900'>Thành viên nổi bật</h3>
                <button className='text-sm font-medium text-blue-600 hover:text-blue-700'>Xem tất cả</button>
              </div>

              <div className='space-y-3'>
                {membersQuery.isLoading ? (
                  <p className='text-sm text-slate-500'>Đang tải thành viên...</p>
                ) : featuredMembers.length === 0 ? (
                  <p className='text-sm text-slate-500'>Chưa có dữ liệu thành viên.</p>
                ) : (
                  featuredMembers.map((member: GroupMember) => (
                    <div key={member.id} className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-2.5'>
                      <div className='flex items-center gap-2.5'>
                        <Avatar src={member.avatar} name={member.name} size='sm' />
                        <div>
                          <p className='text-sm font-semibold text-slate-900'>{member.name}</p>
                          <p className='text-xs text-slate-500'>{member.roleText}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toast.info('Tính năng nhắn tin đang dùng tại trang Chat.')}
                        className='rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100'
                      >
                        Nhắn tin
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className='rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm'>
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='text-lg font-bold text-slate-900'>Tài liệu nhóm</h3>
                <button className='text-sm font-medium text-blue-600 hover:text-blue-700'>Tất cả</button>
              </div>

              <div className='space-y-2.5'>
                {files.length === 0 ? (
                  <p className='text-sm text-slate-500'>Chưa có tệp đính kèm trong bài viết.</p>
                ) : (
                  files.map((file) => (
                    <div key={file.id} className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium text-slate-800'>{file.name}</p>
                        <p className='text-xs text-slate-500'>{file.size}</p>
                      </div>
                      <a
                        href={file.url}
                        target='_blank'
                        rel='noreferrer'
                        className='rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100'
                      >
                        Mở
                      </a>
                    </div>
                  ))
                )}
              </div>
            </article>
          </aside>
        </main>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title='Tạo bài thảo luận nhóm'
        size='xl'
        footer={(
          <>
            <Button variant='secondary' onClick={() => setComposerOpen(false)} disabled={createPostMutation.isPending}>
              Hủy
            </Button>
            <Button
              onClick={() => createPostMutation.mutate()}
              loading={createPostMutation.isPending}
              disabled={!content.trim() || createPostMutation.isPending}
            >
              Đăng
            </Button>
          </>
        )}
      >
        <div className='space-y-4'>
          <div className='rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 flex items-center gap-3'>
            <Avatar src={user?.avatar} name={user?.displayName || ''} size='md' />
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-slate-900 truncate'>{user?.displayName}</p>
              <p className='text-xs text-slate-600'>Bài viết này sẽ hiển thị trong thảo luận của nhóm</p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <Avatar src={user?.avatar} name={user?.displayName || ''} size='md' className='mt-1' />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='Viết nội dung thảo luận trong nhóm...'
              className='flex-1 min-h-[150px] bg-white rounded-2xl px-4 py-3 text-sm resize-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200'
              rows={5}
              aria-label='Viết thảo luận'
            />
          </div>

          <div className='rounded-2xl border border-slate-200 bg-white p-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex gap-2'>
                {(['# UI', '# Database', '# Meeting'] as Tag[]).map((tag) => (
                  <button
                    type='button'
                    key={tag}
                    onClick={() => addTag(tag)}
                    className='rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100'
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <Button variant='secondary' size='sm' onClick={onPickFiles}>Thêm ảnh/video/tài liệu</Button>
            </div>
            {!!selectedFiles.length && (
              <p className='mt-2 text-xs text-slate-500'>Đã chọn {selectedFiles.length} tệp</p>
            )}
          </div>

          {imagePreviewUrls.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {imagePreviewUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className='relative rounded-xl overflow-hidden border border-slate-200'>
                  <img src={url} alt={`Ảnh đã chọn ${idx + 1}`} className='w-full h-32 object-cover' />
                  <button
                    className='absolute top-1.5 right-1.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded'
                    onClick={() => removeFileAt(idx)}
                    aria-label='Xóa ảnh'
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}

          {videoFiles.length > 0 && (
            <div className='space-y-1'>
              {selectedFiles.map((file, idx) => ({ file, idx })).filter(item => isVideoFile(item.file)).map(({ file, idx }) => (
                <div key={`${file.name}-${idx}`} className='flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'>
                  <span className='text-sm text-slate-800 truncate pr-3'>🎬 {file.name}</span>
                  <button className='text-xs text-slate-500 hover:text-slate-700' onClick={() => removeFileAt(idx)} aria-label='Xóa tệp video'>
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}

          {documentFiles.length > 0 && (
            <div className='space-y-1'>
              {selectedFiles.map((file, idx) => ({ file, idx })).filter(item => !isImageFile(item.file) && !isVideoFile(item.file)).map(({ file, idx }) => (
                <div key={`${file.name}-${idx}`} className='flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'>
                  <span className='text-sm text-slate-800 truncate pr-3'>📄 {file.name}</span>
                  <button className='text-xs text-slate-500 hover:text-slate-700' onClick={() => removeFileAt(idx)} aria-label='Xóa tệp'>
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      </div>
    </div>

      <input
        ref={fileInputRef}
        type='file'
        accept='image/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
        multiple
        className='hidden'
        onChange={onFilesSelected}
      />
    </div>
  )
}



