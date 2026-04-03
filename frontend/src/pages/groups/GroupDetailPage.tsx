import { useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { groupsApi, uploadsApi } from '@/api/index'
import { Post, postsApi } from '@/api/posts'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { timeAgo } from '@/utils/format'
import { useAuthStore } from '@/store/authStore'

type Tag = '# UI' | '# Database' | '# Meeting'

function roleLabel(role: string) {
  if (role === 'OWNER') return 'Admin'
  if (role === 'MODERATOR') return 'Moderator'
  return 'Member'
}

function privacyLabel(privacy?: 'PUBLIC' | 'PRIVATE') {
  return privacy === 'PRIVATE' ? 'Riêng tư' : 'Công khai'
}

function extractMembers(raw: any, ownerId?: string) {
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
    ;(post.images ?? []).forEach((url, idx) => {
      items.push({
        id: `${post.id}-${idx}`,
        name: `Tệp từ bài viết #${post.id.slice(0, 6)} (${idx + 1})`,
        size: 'Ảnh đính kèm',
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const groupQuery = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.getGroup(id),
    enabled: !!id,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  const membersQuery = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => groupsApi.getMembers(id),
    enabled: !!id,
    refetchInterval: 7000,
    refetchIntervalInBackground: true,
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

      let images: string[] | undefined
      if (selectedFiles.length) {
        const uploaded = await Promise.all(selectedFiles.map((file) => uploadsApi.uploadImage(file)))
        images = uploaded.map((item) => item.url)
      }

      return postsApi.createPost({
        content: trimmed,
        images,
        privacy: 'GROUP',
        groupId: id,
      })
    },
    onSuccess: () => {
      setContent('')
      setSelectedFiles([])
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

  const likeMutation = useMutation({
    mutationFn: (postId: string) => postsApi.toggleLike(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const shareMutation = useMutation({
    mutationFn: (postId: string) => postsApi.sharePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', id] })
      toast.success('Đã chia sẻ bài viết')
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

  if (groupQuery.isLoading) return <PostSkeleton />

  if (!group) {
    return <div className='rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500'>Không tìm thấy nhóm.</div>
  }

  return (
    <div className='min-h-screen bg-[#f3f6fb] text-slate-800'>
      <div className='mx-auto max-w-[1500px] px-6 pb-8 pt-2'>
        <main className='grid grid-cols-[minmax(0,1fr)_330px] gap-6'>
          <section className='space-y-6'>
            <article className='overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm'>
              <div className='relative h-[260px]'>
                <img
                  src={group.coverUrl || group.coverPhoto || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&h=520&fit=crop'}
                  alt='cover'
                  className='h-full w-full object-cover'
                />
                <div className='absolute inset-0 bg-slate-900/45' />

                <div className='absolute inset-0 flex items-end justify-between p-6'>
                  <div className='text-white'>
                    <span className='inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur'>{activeBadge}</span>
                    <h1 className='mt-3 text-4xl font-bold tracking-tight'>{group.name}</h1>
                    <p className='mt-2 text-sm text-slate-100'>
                      {group.description || 'Nhóm cộng đồng EduSocial'} • {group.membersCount ?? members.length} thành viên • {privacyLabel(group.privacy)}
                    </p>
                  </div>

                  <div className='flex gap-2'>
                    <button
                      onClick={() => toast.info('Tính năng mời thành viên sẽ được kết nối ở bước tiếp theo.')}
                      className='rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100'
                    >
                      Mời thành viên
                    </button>
                    <button
                      onClick={() => leaveMutation.mutate()}
                      className='rounded-xl border border-white/50 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20'
                    >
                      {leaveMutation.isPending ? 'Đang xử lý...' : 'Rời nhóm'}
                    </button>
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-4 gap-3 border-t border-slate-200 p-4'>
                {stats.map((item) => (
                  <div key={item.label} className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
                    <p className='text-2xl font-semibold leading-none text-slate-900'>{item.value}</p>
                    <p className='mt-2 text-sm text-slate-500'>{item.label}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className='rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm'>
              <div className='flex items-start justify-between'>
                <div>
                  <h2 className='text-xl font-bold text-slate-900'>Đăng thảo luận</h2>
                  <p className='mt-1 text-sm text-slate-500'>Chia sẻ tiến độ, câu hỏi hoặc tài liệu mới với cả nhóm.</p>
                </div>
                <label className='cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'>
                  Thêm tệp
                  <input
                    type='file'
                    accept='image/*'
                    multiple
                    className='hidden'
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
              </div>

              <div className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3'>
                <div className='flex items-start gap-3'>
                  <Avatar src={user?.avatar} name={user?.displayName || 'Me'} size='sm' />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder='Viết nội dung thảo luận trong nhóm...'
                    rows={4}
                    className='min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                  />
                </div>

                {!!selectedFiles.length && (
                  <p className='mt-2 text-xs text-slate-500'>Đã chọn {selectedFiles.length} tệp ảnh để tải lên.</p>
                )}

                <div className='mt-3 flex items-center justify-between'>
                  <div className='flex gap-2'>
                    {(['# UI', '# Database', '# Meeting'] as Tag[]).map((tag) => (
                      <button
                        type='button'
                        key={tag}
                        onClick={() => addTag(tag)}
                        className='rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100'
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => createPostMutation.mutate()}
                    disabled={!content.trim() || createPostMutation.isPending}
                    className='rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {createPostMutation.isPending ? 'Đang đăng...' : 'Đăng bài'}
                  </button>
                </div>
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
                posts.map((post) => (
                  <article key={post.id} className='rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-start gap-3'>
                        <Avatar src={post.author?.avatar} name={post.author?.displayName || 'Thành viên'} size='sm' />
                        <div>
                          <p className='font-semibold text-slate-900'>{post.author?.displayName || 'Thành viên'}</p>
                          <p className='text-sm text-slate-500'>Thành viên • {timeAgo(post.createdAt)}</p>
                        </div>
                      </div>
                      <button className='rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700'>
                        <svg viewBox='0 0 24 24' className='h-5 w-5 fill-current'>
                          <circle cx='5' cy='12' r='2' />
                          <circle cx='12' cy='12' r='2' />
                          <circle cx='19' cy='12' r='2' />
                        </svg>
                      </button>
                    </div>

                    <p className='mt-4 text-[15px] leading-7 text-slate-700'>{post.content}</p>

                    {!!post.images?.length && (
                      <div className='mt-3 grid grid-cols-2 gap-2'>
                        {post.images.slice(0, 4).map((image, idx) => (
                          <img key={`${post.id}-${idx}`} src={image} alt='media' className='h-36 w-full rounded-xl object-cover' />
                        ))}
                      </div>
                    )}

                    <div className='mt-3 flex flex-wrap gap-2'>
                      {post.content.includes('#')
                        ? post.content
                            .split(' ')
                            .filter((word) => word.startsWith('#'))
                            .slice(0, 4)
                            .map((tag) => (
                              <span key={`${post.id}-${tag}`} className='rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'>
                                {tag}
                              </span>
                            ))
                        : null}
                    </div>

                    <div className='mt-4 border-y border-slate-100 py-2 text-sm text-slate-500'>
                      {post.likesCount} lượt thích • {post.commentsCount} bình luận
                    </div>

                    <div className='mt-3 grid grid-cols-3 gap-2'>
                      <button
                        onClick={() => likeMutation.mutate(post.id)}
                        className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
                      >
                        Thích
                      </button>
                      <button
                        onClick={() => toast.info('Mở chi tiết bài để bình luận.')}
                        className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
                      >
                        Bình luận
                      </button>
                      <button
                        onClick={() => shareMutation.mutate(post.id)}
                        className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
                      >
                        Chia sẻ
                      </button>
                    </div>
                  </article>
                ))
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

          <aside className='space-y-4'>
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
                  featuredMembers.map((member) => (
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
    </div>
  )
}
