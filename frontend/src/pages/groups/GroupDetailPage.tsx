import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { groupsApi, uploadsApi } from '@/api/index'
import { Post, postsApi } from '@/api/posts'
import { extractError } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { PostCard } from '@/components/shared/PostCard'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/authStore'

type GroupMember = {
  id: string
  name: string
  avatar: string
  role: string
  roleText: string
}

type AttachmentBucket = {
  id: string
  name: string
  url: string
  kind: 'document' | 'image' | 'video'
}

function getRoleText(role: string) {
  if (role === 'OWNER') return 'Quản trị'
  if (role === 'MODERATOR') return 'Điều phối viên'
  return 'Thành viên'
}

function getPrivacyText(privacy?: 'PUBLIC' | 'PRIVATE') {
  return privacy === 'PRIVATE' ? 'Riêng tư' : 'Công khai'
}

function normalizeMembers(raw: any, ownerId?: string): GroupMember[] {
  const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return items.map((item: any, index: number) => {
    const user = item?.u?.properties ?? item?.user?.properties ?? item?.user ?? item ?? {}
    const id = user.userId ?? user.id ?? `member-${index}`
    const role = item.role ?? (ownerId && id === ownerId ? 'OWNER' : 'MEMBER')
    return {
      id,
      name: user.displayName ?? 'Thành viên chưa rõ',
      avatar: user.avatarUrl ?? user.avatar ?? '',
      role,
      roleText: getRoleText(role),
    }
  })
}

function collectAttachments(posts: Post[]): AttachmentBucket[] {
  const rows: AttachmentBucket[] = []
  posts.forEach((post) => {
    ;(post.documentUrls ?? []).forEach((url, index) => {
      const name = url.split('?')[0].split('/').pop() || `document-${index + 1}`
      rows.push({ id: `${post.id}-doc-${index}`, name, url, kind: 'document' })
    })
    ;(post.imageUrls ?? []).forEach((url, index) => {
      const name = url.split('?')[0].split('/').pop() || `image-${index + 1}`
      rows.push({ id: `${post.id}-img-${index}`, name, url, kind: 'image' })
    })
    ;(post.videoUrls ?? []).forEach((url, index) => {
      const name = url.split('?')[0].split('/').pop() || `video-${index + 1}`
      rows.push({ id: `${post.id}-vid-${index}`, name, url, kind: 'video' })
    })
  })
  return rows.slice(0, 12)
}

function getGroupCover(coverUrl?: string, coverPhoto?: string) {
  return (
    coverUrl ||
    coverPhoto ||
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop'
  )
}

export default function GroupDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [composerOpen, setComposerOpen] = useState(false)
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{ id: string; name: string } | null>(null)

  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupDescription, setEditGroupDescription] = useState('')
  const [editGroupPrivacy, setEditGroupPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [editGroupCoverFile, setEditGroupCoverFile] = useState<File | null>(null)
  const [editGroupCoverPreview, setEditGroupCoverPreview] = useState('')
  const [memberDropdownId, setMemberDropdownId] = useState<string | null>(null)
  const editCoverInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.group-settings-dropdown')) {
        setShowSettingsMenu(false)
      }
      if (!(e.target as Element).closest('.member-dropdown-menu')) {
        setMemberDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const groupQuery = useQuery({
    queryKey: ['group', id],
    enabled: !!id,
    queryFn: () => groupsApi.getGroup(id),
  })

  const membersQuery = useQuery({
    queryKey: ['group-members', id],
    enabled: !!id,
    queryFn: () => groupsApi.getMembers(id),
  })

  const postsQuery = useInfiniteQuery({
    queryKey: ['group-posts', id],
    enabled: !!id,
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => postsApi.getGroupPosts(id, pageParam as number, 10),
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
  })

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

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim()
      if (!trimmed) throw new Error('Post content cannot be empty.')
      if (!trimmed) throw new Error('Nội dung bài viết không được để trống.')

      const imageUrls: string[] = []
      const videoUrls: string[] = []
      const documentUrls: string[] = []

      if (selectedFiles.length) {
        const uploaded = await Promise.all(
          selectedFiles.map((file) => {
            if (isImageFile(file)) return uploadsApi.uploadImage(file, 'posts').then((item) => ({ kind: 'image' as const, url: item.url }))
            if (isVideoFile(file)) return uploadsApi.uploadVideo(file, 'posts').then((item) => ({ kind: 'video' as const, url: item.url }))
            return uploadsApi.uploadDocument(file).then((item) => ({ kind: 'document' as const, url: item.url }))
          })
        )

        uploaded.forEach((item) => {
          if (item.kind === 'image') imageUrls.push(item.url)
          if (item.kind === 'video') videoUrls.push(item.url)
          if (item.kind === 'document') documentUrls.push(item.url)
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
      toast.success('Đăng thảo luận thành công.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const leaveMutation = useMutation({
    mutationFn: () => groupsApi.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      toast.success('Đã rời nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => groupsApi.removeMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', id] })
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      toast.success('Đã xóa thành viên khỏi nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const editGroupMutation = useMutation({
    mutationFn: async () => {
      let coverUrl = group?.coverUrl || ''
      if (editGroupCoverFile) {
        const uploaded = await uploadsApi.uploadImage(editGroupCoverFile, 'covers')
        coverUrl = uploaded.url
      }
      return groupsApi.updateGroup(id, {
        name: editGroupName,
        description: editGroupDescription,
        privacy: editGroupPrivacy,
        coverUrl,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      setShowEditGroupModal(false)
      toast.success('Đã cập nhật thông tin nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const assignRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) => groupsApi.assignRole(id, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', id] })
      queryClient.invalidateQueries({ queryKey: ['group', id] })
      toast.success('Đã phân quyền thành công.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const group = groupQuery.data
  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.data) ?? [], [postsQuery.data])
  const members = useMemo(() => normalizeMembers(membersQuery.data, group?.ownerId), [membersQuery.data, group?.ownerId])
  const attachments = useMemo(() => collectAttachments(posts), [posts])
  const recentPosts = useMemo(() => {
    const now = Date.now()
    return posts.filter((post) => now - new Date(post.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length
  }, [posts])

  const stats = [
    { label: 'Thành viên', value: group?.membersCount ?? members.length },
    { label: 'Bài viết', value: posts.length },
    { label: 'Tệp', value: attachments.length },
    { label: 'Hoạt động 7 ngày', value: recentPosts },
  ]

  const topMembers = members.slice(0, 6)
  const canManageMembers = !!group?.isOwner

  const openFilePicker = () => fileInputRef.current?.click()

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? [])
    if (!next.length) return

    const merged = [...selectedFiles, ...next].slice(0, 8)
    setSelectedFiles(merged)

    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImagePreviewUrls(merged.filter(isImageFile).map((file) => URL.createObjectURL(file)))
    event.target.value = ''
  }

  const removeFileAt = (index: number) => {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index)
    setSelectedFiles(nextFiles)
    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImagePreviewUrls(nextFiles.filter(isImageFile).map((file) => URL.createObjectURL(file)))
  }

  if (groupQuery.isLoading) return <PostSkeleton />

  if (!group) {
    return <div className='rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500'>Không tìm thấy nhóm.</div>
  }

  return (
    <>
      <div className='mx-auto max-w-[1500px] space-y-6 px-0 pb-8 sm:px-4 lg:px-6'>
        <section className='relative rounded-none border-0 bg-slate-950 text-white sm:rounded-[32px] sm:border sm:border-slate-800'>
          <div className='relative min-h-[320px]'>
            <div className='absolute inset-0 overflow-hidden rounded-none sm:rounded-[32px]'>
              <img src={getGroupCover(group.coverUrl, group.coverPhoto)} alt={group.name} className='absolute inset-0 h-full w-full object-cover' />
              <div className='absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.9))]' />
            </div>
            <div className='relative flex h-full min-h-[320px] flex-col justify-end gap-6 px-4 py-6 sm:px-8 sm:py-8'>
              <div className='flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100'>
                <span className='rounded-full border border-white/15 bg-white/10 px-3 py-1'>{getPrivacyText(group.privacy)}</span>
                <span className='rounded-full border border-white/15 bg-white/10 px-3 py-1'>
                  {recentPosts > 0 ? 'Có hoạt động tuần này' : 'Ít hoạt động tuần này'}
                </span>
              </div>

              <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
                <div className='max-w-3xl'>
                  <h1 className='text-3xl font-bold tracking-tight sm:text-5xl'>{group.name}</h1>
                  <p className='mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base'>
                    {group.description || 'Không gian tập trung để trao đổi, chia sẻ tài liệu và theo dõi tiến độ của nhóm.'}
                  </p>
                </div>

                <div className='flex flex-wrap gap-3'>
                  <Button onClick={() => setComposerOpen(true)} className='!rounded-full !bg-white !px-5 !text-slate-950 hover:!bg-slate-100'>
                    Bài viết mới
                  </Button>
                  <div className='group-settings-dropdown relative'>
                    <Button
                      variant='outline'
                      onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                      className='!rounded-full !border-white/20 !bg-white/5 !px-4 !text-white hover:!bg-white/10'
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                    </Button>

                    {showSettingsMenu && (
                      <div className='absolute right-0 top-full mt-2 w-48 z-10 rounded-xl border border-slate-200 bg-white p-1 shadow-lg'>
                        <button
                          type='button'
                          onClick={() => {
                            setShowSettingsMenu(false)
                            setShowMembersModal(true)
                          }}
                          className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 text-slate-700'
                        >
                          Xem thành viên
                        </button>
                        {canManageMembers && (
                          <button
                            type='button'
                            onClick={() => {
                              setShowSettingsMenu(false)
                              setEditGroupName(group.name)
                              setEditGroupDescription(group.description || '')
                              setEditGroupPrivacy(group.privacy as any)
                              setEditGroupCoverFile(null)
                              setEditGroupCoverPreview('')
                              setShowEditGroupModal(true)
                            }}
                            className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 text-slate-700'
                          >
                            Chỉnh sửa nhóm
                          </button>
                        )}
                        {!canManageMembers && (
                          <button
                            type='button'
                            onClick={() => {
                              setShowSettingsMenu(false)
                              setConfirmLeaveOpen(true)
                            }}
                            className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-red-50 text-red-600'
                          >
                            Rời nhóm
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        <div className='w-full'>
          <section className='space-y-6'>
            <article className='rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm'>
              <div className='flex items-start gap-4'>
                <Avatar src={user?.avatar} name={user?.displayName || ''} size='md' />
                <button
                  type='button'
                  onClick={() => setComposerOpen(true)}
                  className='flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-500 transition hover:bg-slate-100'
                >
                  Chia sẻ cập nhật với nhóm...
                </button>
              </div>
              <div className='mt-4 flex flex-wrap gap-2'>
                <Button variant='secondary' size='sm' onClick={() => setComposerOpen(true)}>Viết bài</Button>
                <Button variant='secondary' size='sm' onClick={() => {
                  setComposerOpen(true)
                  setTimeout(openFilePicker, 0)
                }}>
                  Thêm tệp
                </Button>
              </div>
            </article>

            <section className='space-y-4'>
              {postsQuery.isLoading ? (
                <PostSkeleton />
              ) : posts.length === 0 ? (
                <article className='rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm'>
                  Nhóm này chưa có bài thảo luận nào.
                </article>
              ) : (
                posts.map((post) => <PostCard key={post.id} post={post} />)
              )}

              {postsQuery.hasNextPage && (
                <div className='flex justify-center'>
                  <Button
                    variant='secondary'
                    loading={postsQuery.isFetchingNextPage}
                    onClick={() => postsQuery.fetchNextPage()}
                  >
                    Tải thêm bài viết
                  </Button>
                </div>
              )}
            </section>
          </section>


        </div>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title='Tạo bài viết trong nhóm'
        size='xl'
        footer={(
          <>
            <Button variant='secondary' onClick={() => setComposerOpen(false)} disabled={createPostMutation.isPending}>
              Hủy
            </Button>
            <Button
              onClick={() => createPostMutation.mutate()}
              loading={createPostMutation.isPending}
              disabled={!content.trim()}
            >
              Đăng bài
            </Button>
          </>
        )}
      >
        <div className='space-y-4'>
          <div className='flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-3'>
            <Avatar src={user?.avatar} name={user?.displayName || ''} size='md' />
            <div className='min-w-0'>
              <p className='truncate text-sm font-semibold text-slate-950'>{user?.displayName || 'Người dùng hiện tại'}</p>
              <p className='text-xs text-slate-500'>Đăng trong nhóm {group.name}</p>
            </div>
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder='Viết nội dung hữu ích cho nhóm...'
            rows={7}
            className='w-full rounded-[24px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400'
          />

          <div className='rounded-[24px] border border-slate-200 bg-slate-50 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-slate-950'>Tệp đính kèm</p>
                <p className='text-xs text-slate-500'>Hỗ trợ ảnh, video và tài liệu.</p>
              </div>
              <Button variant='secondary' onClick={openFilePicker}>
                Chọn tệp
              </Button>
            </div>

            {selectedFiles.length > 0 && (
              <div className='mt-4 space-y-2'>
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className='flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2'>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-slate-950'>{file.name}</p>
                      <p className='text-xs text-slate-500'>{Math.max(1, Math.round(file.size / 1024))} KB</p>
                    </div>
                    <Button variant='ghost' size='sm' onClick={() => removeFileAt(index)}>
                      Xóa
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {imagePreviewUrls.length > 0 && (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {imagePreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className='overflow-hidden rounded-[24px] border border-slate-200'>
                  <img src={url} alt={`preview-${index + 1}`} className='h-40 w-full object-cover' />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={() => leaveMutation.mutate(undefined, { onSettled: () => setConfirmLeaveOpen(false) })}
        title='Xác nhận rời nhóm?'
        description={`Bạn sẽ không còn nhận cập nhật từ nhóm ${group.name}.`}
        confirmText='Rời nhóm'
        cancelText='Ở lại'
        tone='warning'
        loading={leaveMutation.isPending}
      />

      <ConfirmDialog
        open={!!confirmRemoveMember}
        onClose={() => setConfirmRemoveMember(null)}
        onConfirm={() => {
          if (!confirmRemoveMember?.id) return
          removeMemberMutation.mutate(confirmRemoveMember.id, {
            onSettled: () => setConfirmRemoveMember(null),
          })
        }}
        title='Xác nhận xóa thành viên?'
        description={confirmRemoveMember ? `Xóa ${confirmRemoveMember.name} khỏi nhóm này.` : undefined}
        confirmText='Xóa thành viên'
        cancelText='Hủy'
        tone='danger'
        loading={removeMemberMutation.isPending}
      />

      <Modal
        open={showEditGroupModal}
        onClose={() => setShowEditGroupModal(false)}
        title='Chỉnh sửa nhóm'
        footer={(
          <>
            <Button variant='secondary' onClick={() => setShowEditGroupModal(false)} disabled={editGroupMutation.isPending}>
              Hủy
            </Button>
            <Button onClick={() => editGroupMutation.mutate()} loading={editGroupMutation.isPending} disabled={!editGroupName.trim()}>
              Lưu thay đổi
            </Button>
          </>
        )}
      >
        <div className='space-y-4'>
          <div>
            <label className='mb-2 block text-sm font-semibold text-slate-700'>Tên nhóm</label>
            <input
              type='text'
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className='w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-slate-400'
              placeholder='Nhập tên nhóm...'
            />
          </div>
          <div>
            <label className='mb-2 block text-sm font-semibold text-slate-700'>Mô tả</label>
            <textarea
              value={editGroupDescription}
              onChange={(e) => setEditGroupDescription(e.target.value)}
              className='w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-slate-400'
              placeholder='Nhập mô tả...'
              rows={3}
            />
          </div>
          <div>
            <label className='mb-2 block text-sm font-semibold text-slate-700'>Quyền riêng tư</label>
            <select
              value={editGroupPrivacy}
              onChange={(e) => setEditGroupPrivacy(e.target.value as any)}
              className='w-full rounded-xl border border-slate-200 bg-white px-4 py-2 outline-none focus:border-slate-400'
            >
              <option value='PUBLIC'>Công khai - Ai cũng có thể thấy và xin tham gia</option>
              <option value='PRIVATE'>Riêng tư - Chỉ thành viên mới thấy nội dung</option>
            </select>
          </div>
          <div>
            <label className='mb-2 block text-sm font-semibold text-slate-700'>Ảnh bìa mới</label>
            <input
              type='file'
              accept='image/*'
              className='hidden'
              ref={editCoverInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setEditGroupCoverFile(file)
                  setEditGroupCoverPreview(URL.createObjectURL(file))
                }
                e.target.value = ''
              }}
            />
            <div className='flex items-center gap-4'>
              <Button type='button' variant='secondary' onClick={() => editCoverInputRef.current?.click()}>
                Chọn ảnh
              </Button>
              {(editGroupCoverPreview || group.coverUrl) && (
                <img
                  src={editGroupCoverPreview || group.coverUrl}
                  alt='Cover Preview'
                  className='h-16 w-32 rounded-lg object-cover shadow-sm'
                />
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        title='Danh sách thành viên'
      >
        <div className='max-h-[60vh] overflow-y-auto pr-2 space-y-3 pb-24'>
          {members.length === 0 ? (
            <p className='text-sm text-slate-500'>Chưa có dữ liệu thành viên.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className='flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 p-3'>
                <div className='flex min-w-0 items-center gap-3'>
                  <Avatar src={member.avatar} name={member.name} size='md' />
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-slate-950'>{member.name}</p>
                    <p className='text-xs text-slate-500'>{member.roleText}</p>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  {!canManageMembers || member.id === user?.id || member.role === 'OWNER' ? (
                    <span className='text-xs font-medium text-slate-400'>
                      {member.id === user?.id ? 'Bạn' : member.roleText}
                    </span>
                  ) : (
                    <div className='member-dropdown-menu relative'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setMemberDropdownId(memberDropdownId === member.id ? null : member.id)}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </Button>
                      
                      {memberDropdownId === member.id && (
                        <div className='absolute right-0 top-full mt-2 w-40 z-20 rounded-xl border border-slate-200 bg-white p-1 shadow-lg'>
                          <button
                            type='button'
                            onClick={() => {
                              setMemberDropdownId(null)
                              assignRoleMutation.mutate({ memberId: member.id, role: 'OWNER' })
                            }}
                            className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 text-slate-700'
                          >
                            Giao thành admin
                          </button>
                          <button
                            type='button'
                            onClick={() => {
                              setMemberDropdownId(null)
                              setConfirmRemoveMember({ id: member.id, name: member.name })
                            }}
                            className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-red-50 text-red-600'
                          >
                            Xóa thành viên
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        accept='image/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
        onChange={onFilesSelected}
      />
    </>
  )
}
