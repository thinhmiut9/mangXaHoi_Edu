import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Group, GroupJoinRequest, groupsApi, uploadsApi } from '@/api/index'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

type GroupPrivacy = 'PUBLIC' | 'PRIVATE'
type GroupCategory = 'TECH' | 'DESIGN'

function privacyLabel(privacy: GroupPrivacy) {
  return privacy === 'PUBLIC' ? 'Công khai' : 'Riêng tư'
}

function inferCategory(group: Group): GroupCategory {
  const text = `${group.name} ${group.description ?? ''}`.toLowerCase()
  if (/ui|ux|figma|design|thiết kế/.test(text)) return 'DESIGN'
  return 'TECH'
}

function inferTags(group: Group): string[] {
  const text = `${group.name} ${group.description ?? ''}`
  const candidates = text
    .split(/[^\p{L}\p{N}.+#-]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)

  const unique: string[] = []
  for (const w of candidates) {
    const normalized = w.toLowerCase()
    if (unique.some((i) => i.toLowerCase() === normalized)) continue
    unique.push(w)
    if (unique.length >= 3) break
  }

  return unique.length ? unique : ['Học nhóm', 'Thảo luận', 'Tài liệu']
}

function groupCover(group: Group) {
  if (group.coverUrl && group.coverUrl.trim()) return group.coverUrl
  if (group.coverPhoto && group.coverPhoto.trim()) return group.coverPhoto
  return `https://picsum.photos/seed/edusocial-${group.id}/1200/600`
}

const accentPalette = [
  'from-blue-600/90 via-cyan-500/70 to-cyan-400/60',
  'from-violet-600/90 via-indigo-500/70 to-blue-500/60',
  'from-emerald-600/90 via-teal-500/70 to-cyan-400/60',
  'from-rose-600/90 via-fuchsia-500/70 to-indigo-500/60',
]

export default function GroupsPage() {
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeCategory, setActiveCategory] = useState<'ALL' | GroupCategory>('ALL')
  const [showPendingRequests, setShowPendingRequests] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupTopic, setNewGroupTopic] = useState('')
  const [newGroupCoverUrl, setNewGroupCoverUrl] = useState('')
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<GroupPrivacy>('PUBLIC')

  const myGroupsSectionRef = useRef<HTMLElement | null>(null)
  const discoverSectionRef = useRef<HTMLElement | null>(null)
  const coverFileInputRef = useRef<HTMLInputElement | null>(null)

  const myGroupsQuery = useQuery({
    queryKey: ['my-groups'],
    queryFn: groupsApi.getMyGroups,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  const ownerJoinRequestsQuery = useQuery({
    queryKey: ['owner-join-requests', myGroupsQuery.data?.map((g) => `${g.id}:${g.isOwner ? '1' : '0'}`).join('|')],
    queryFn: async () => {
      const groups = myGroupsQuery.data ?? []
      const ownerGroups = groups.filter((g) => g.isOwner)
      const result = await Promise.all(
        ownerGroups.map(async (group) => {
          const requests = await groupsApi.getJoinRequests(group.id)
          return requests.map((request: GroupJoinRequest) => ({
            groupId: group.id,
            groupName: group.name,
            requester: request.requester,
            requestedAt: request.requestedAt,
          }))
        })
      )
      return result.flat()
    },
    enabled: !!myGroupsQuery.data,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.join(groupId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success(result.message || (result.status === 'REQUESTED' ? 'Đã gửi yêu cầu tham gia nhóm.' : 'Đã tham gia nhóm'))
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const createGroupMutation = useMutation({
    mutationFn: () =>
      groupsApi.createGroup({
        name: newGroupName.trim(),
        description: [newGroupDescription.trim(), newGroupTopic.trim()].filter(Boolean).join(' • ') || undefined,
        coverUrl: newGroupCoverUrl.trim() || undefined,
        privacy: newGroupPrivacy,
      }),
    onSuccess: () => {
      setShowCreateGroupModal(false)
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupTopic('')
      setNewGroupCoverUrl('')
      setNewGroupPrivacy('PUBLIC')
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Tạo nhóm thành công')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => uploadsApi.uploadImage(file),
    onSuccess: (data) => {
      setNewGroupCoverUrl(data.url)
      toast.success('Tải ảnh bìa lên thành công')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const approveRequestMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => groupsApi.approveJoinRequest(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-join-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Đã duyệt yêu cầu tham gia')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const rejectRequestMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => groupsApi.rejectJoinRequest(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-join-requests'] })
      toast.success('Đã từ chối yêu cầu tham gia')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const myGroups = myGroupsQuery.data ?? []
  const allGroups = groupsQuery.data ?? []
  const myGroupIds = new Set(myGroups.map((g) => g.id))

  const discoverGroups = useMemo(() => {
    const base = allGroups.filter((group) => !myGroupIds.has(group.id))
    if (activeCategory === 'ALL') return base
    return base.filter((group) => inferCategory(group) === activeCategory)
  }, [allGroups, myGroupIds, activeCategory])

  const pendingJoinRequests = ownerJoinRequestsQuery.data ?? []
  const stats = useMemo(() => ({
    joinedGroups: myGroups.length,
    pendingApprovals: pendingJoinRequests.length,
  }), [myGroups.length, pendingJoinRequests.length])

  return (
    <>
      <div className='space-y-6 pb-8'>
        <section className='rounded-[32px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm'>
          <div className='grid grid-cols-1 gap-5'>
            <article className='relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f1b4d] via-[#243c8f] to-[#312e81] p-5 text-white shadow-[0_14px_28px_rgba(30,64,175,0.38)]'>
              <div className='pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-blue-400/25 blur-3xl' />
              <div className='pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl' />

              <div className='relative z-10'>
                <span className='inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur'>
                  Không gian nhóm mới
                </span>
                <h1 className='mt-2 text-4xl font-bold tracking-tight'>Nhóm</h1>
                <p className='mt-2 max-w-3xl text-[16px]/7 text-blue-100'>
                  Tạo nhóm, quản lý thành viên và chia sẻ nội dung trong một giao diện gọn gàng, hiện đại và trực quan hơn.
                </p>

                <div className='mt-4 flex flex-wrap gap-2.5'>
                  <Button
                    onClick={() => setShowCreateGroupModal(true)}
                    className='!rounded-2xl !bg-white !px-4 !text-slate-900 hover:!bg-slate-100'
                  >
                    + Tạo nhóm mới
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setActiveCategory('ALL')
                      discoverSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className='!rounded-2xl !border-white/30 !bg-white/10 !px-4 !text-white backdrop-blur hover:!bg-white/20'
                  >
                    Khám phá nhóm
                  </Button>
                </div>

                <div className='mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                  <button
                    onClick={() => myGroupsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className='rounded-2xl border border-white/10 bg-white/10 p-2.5 text-left backdrop-blur-sm transition hover:bg-white/20'
                  >
                    <p className='text-2xl font-semibold leading-none'>{stats.joinedGroups.toString().padStart(2, '0')}</p>
                    <p className='mt-1.5 text-sm text-blue-100'>Nhóm đang tham gia</p>
                  </button>

                  <button
                    onClick={() => {
                      setShowPendingRequests(true)
                      ownerJoinRequestsQuery.refetch()
                    }}
                    className='rounded-2xl border border-white/10 bg-white/10 p-2.5 text-left backdrop-blur-sm transition hover:bg-white/20'
                  >
                    <p className='text-2xl font-semibold leading-none'>{stats.pendingApprovals.toString().padStart(2, '0')}</p>
                    <p className='mt-1.5 text-sm text-blue-100'>Yêu cầu chờ duyệt</p>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <div className='grid grid-cols-1 gap-5'>
          <main className='space-y-5'>
            <section ref={myGroupsSectionRef} className='rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]'>
              <div className='mb-4 flex items-center justify-between'>
                <div>
                  <h2 className='text-2xl font-bold text-slate-800'>Nhóm của bạn</h2>
                  <p className='mt-1 text-sm text-slate-500'>Các nhóm bạn đã tham gia hoặc đang quản lý.</p>
                </div>
                <Button variant='secondary' size='sm' className='rounded-xl' onClick={() => myGroupsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  Xem tất cả
                </Button>
              </div>

              {myGroupsQuery.isLoading ? (
                <p className='text-sm text-slate-500'>Đang tải nhóm của bạn...</p>
              ) : myGroups.length === 0 ? (
                <p className='text-sm text-slate-500'>Bạn chưa tham gia nhóm nào.</p>
              ) : (
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                  {myGroups.map((group, index) => {
                    const role = group.isOwner || group.ownerId === user?.id ? 'Quản trị viên' : 'Thành viên'
                    return (
                      <article key={group.id} className='group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(37,99,235,0.16)]'>
                        <div className='relative h-36 overflow-hidden'>
                          <img src={groupCover(group)} alt={group.name} className='h-full w-full object-cover transition duration-300 group-hover:scale-105' />
                          <div className={cn('absolute inset-0 bg-gradient-to-r', accentPalette[index % accentPalette.length])} />
                          <div className='absolute inset-x-0 bottom-0 p-4 text-white'>
                            <p className='text-sm font-medium opacity-90'>{role}</p>
                            <h3 className='line-clamp-1 text-3xl font-semibold'>{group.name}</h3>
                          </div>
                        </div>

                        <div className='space-y-3 p-4'>
                          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500'>
                            <span>{group.membersCount ?? 0} thành viên</span>
                            <span>Đang hoạt động</span>
                            <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>{privacyLabel((group.privacy as GroupPrivacy) ?? 'PUBLIC')}</span>
                          </div>

                          <div className='flex gap-2'>
                            <Link to={`/groups/${group.id}`}>
                              <Button size='sm' className='rounded-xl'>Vào nhóm</Button>
                            </Link>
                            <Link to={`/groups/${group.id}`}>
                              <Button variant='secondary' size='sm' className='rounded-xl'>
                                {group.isOwner || group.ownerId === user?.id ? 'Quản lý' : 'Xem nhóm'}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section ref={discoverSectionRef} className='rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]'>
              <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h2 className='text-2xl font-bold text-slate-800'>Khám phá nhóm</h2>
                  <p className='mt-1 text-sm text-slate-500'>Tìm các cộng đồng phù hợp với chủ đề học tập của bạn.</p>
                </div>

                <div className='flex items-center gap-2'>
                  {[
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'TECH', label: 'Công nghệ' },
                    { key: 'DESIGN', label: 'Thiết kế' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setActiveCategory(item.key as 'ALL' | GroupCategory)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                        activeCategory === item.key ? 'bg-blue-50 text-blue-600 shadow-[0_4px_10px_rgba(59,130,246,0.2)]' : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {groupsQuery.isLoading ? (
                <p className='text-sm text-slate-500'>Đang tải danh sách nhóm...</p>
              ) : discoverGroups.length === 0 ? (
                <p className='text-sm text-slate-500'>Không còn nhóm phù hợp trong bộ lọc hiện tại.</p>
              ) : (
                <div className='space-y-3'>
                  {discoverGroups.map((group: Group) => (
                    <article key={group.id} className='rounded-3xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-[0_12px_26px_rgba(37,99,235,0.14)]'>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex min-w-0 gap-3'>
                          <img src={groupCover(group)} alt={group.name} className='h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200' />
                          <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <h3 className='text-2xl font-semibold text-slate-800'>{group.name}</h3>
                              <span className='rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600'>{privacyLabel((group.privacy as GroupPrivacy) ?? 'PUBLIC')}</span>
                              <span className='text-sm text-slate-500'>{group.membersCount ?? 0} thành viên</span>
                            </div>
                            <p className='mt-1 text-sm text-slate-600'>{group.description || 'Nhóm học tập và trao đổi kiến thức.'}</p>
                            <div className='mt-2 flex flex-wrap gap-1.5'>
                              {inferTags(group).map((tag) => (
                                <span key={tag} className='rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600'>{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {group.isJoinRequested ? (
                          <Button
                            disabled
                            className='rounded-2xl bg-slate-300 px-4 text-slate-700'
                          >
                            Đang chờ duyệt
                          </Button>
                        ) : (
                          <Button
                            loading={joinMutation.isPending}
                            onClick={() => joinMutation.mutate(group.id)}
                            className='rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 shadow-[0_10px_18px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-indigo-500'
                          >
                            Tham gia
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {showPendingRequests && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]' onClick={() => setShowPendingRequests(false)}>
          <div className='max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]' onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between border-b border-slate-200 px-5 py-4'>
              <h2 className='text-xl font-bold text-slate-800'>Yêu cầu chờ duyệt theo nhóm</h2>
              <Button variant='secondary' size='sm' className='rounded-xl' onClick={() => setShowPendingRequests(false)}>
                Đóng
              </Button>
            </div>

            <div className='max-h-[calc(85vh-72px)] overflow-y-auto p-5'>
              {ownerJoinRequestsQuery.isLoading ? (
                <p className='text-sm text-slate-500'>Đang tải yêu cầu chờ duyệt...</p>
              ) : pendingJoinRequests.length === 0 ? (
                <p className='text-sm text-slate-500'>Hiện không có yêu cầu chờ duyệt nào.</p>
              ) : (
                <div className='space-y-3'>
                  {pendingJoinRequests.map((entry) => (
                    <article
                      key={`${entry.groupId}-${entry.requester.id}-${entry.requestedAt}`}
                      className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3'
                    >
                      <div className='min-w-0'>
                        <Link to={`/groups/${entry.groupId}`} className='truncate text-sm text-blue-600 hover:underline'>
                          Nhóm: {entry.groupName}
                        </Link>
                        <p className='truncate text-base font-semibold text-slate-800'>{entry.requester.displayName}</p>
                        <p className='text-xs text-slate-500'>{new Date(entry.requestedAt).toLocaleString('vi-VN')}</p>
                      </div>

                      <div className='flex items-center gap-2'>
                        <Button
                          size='sm'
                          loading={approveRequestMutation.isPending}
                          onClick={() => approveRequestMutation.mutate({ groupId: entry.groupId, userId: entry.requester.id })}
                          className='rounded-xl'
                        >
                          Duyệt
                        </Button>
                        <Button
                          variant='secondary'
                          size='sm'
                          loading={rejectRequestMutation.isPending}
                          onClick={() => rejectRequestMutation.mutate({ groupId: entry.groupId, userId: entry.requester.id })}
                          className='rounded-xl'
                        >
                          Từ chối
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]' onClick={() => setShowCreateGroupModal(false)}>
          <div className='w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]' onClick={(e) => e.stopPropagation()}>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-slate-800'>Tạo nhóm mới</h2>
              <Button variant='secondary' size='sm' onClick={() => setShowCreateGroupModal(false)}>
                Đóng
              </Button>
            </div>

            <div className='space-y-3'>
              <input
                placeholder='Tên nhóm'
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className='h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100'
              />
                <input
                  placeholder='Mô tả ngắn'
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className='h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100'
                />
              <input
                placeholder='Ảnh bìa nhóm (URL)'
                value={newGroupCoverUrl}
                onChange={(e) => setNewGroupCoverUrl(e.target.value)}
                className='h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100'
              />
              <div className='flex items-center gap-2'>
                <input
                  ref={coverFileInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    uploadCoverMutation.mutate(file)
                    e.currentTarget.value = ''
                  }}
                />
                <Button
                  type='button'
                  variant='secondary'
                  loading={uploadCoverMutation.isPending}
                  onClick={() => coverFileInputRef.current?.click()}
                  className='rounded-xl'
                >
                  Thêm tệp
                </Button>
                {newGroupCoverUrl && (
                  <button
                    type='button'
                    onClick={() => setNewGroupCoverUrl('')}
                    className='text-sm text-slate-500 hover:text-slate-700'
                  >
                    Xóa ảnh
                  </button>
                )}
              </div>
              {newGroupCoverUrl && (
                <img
                  src={newGroupCoverUrl}
                  alt='Ảnh bìa nhóm'
                  className='h-24 w-full rounded-xl border border-slate-200 object-cover'
                />
              )}
              <div className='grid grid-cols-[1fr_140px] gap-2'>
                <input
                  placeholder='Chủ đề'
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value)}
                  className='h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100'
                />
                <select
                  value={newGroupPrivacy}
                  onChange={(e) => setNewGroupPrivacy(e.target.value as GroupPrivacy)}
                  className='h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                >
                  <option value='PUBLIC'>Công khai</option>
                  <option value='PRIVATE'>Riêng tư</option>
                </select>
              </div>

              <div className='pt-1'>
                <Button
                  loading={createGroupMutation.isPending}
                  disabled={!newGroupName.trim()}
                  onClick={() => createGroupMutation.mutate()}
                  className='h-11 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-indigo-500'
                >
                  Tạo nhóm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
