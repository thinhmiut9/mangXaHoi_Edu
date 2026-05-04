import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Group, GroupJoinRequest, groupsApi, uploadsApi } from '@/api/index'
import { extractError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

type GroupPrivacy = 'PUBLIC' | 'PRIVATE'

type JoinRequestEntry = {
  groupId: string
  groupName: string
  requester: GroupJoinRequest['requester']
  requestedAt: string
}

function getCover(group: Group) {
  return (
    group.coverUrl ||
    group.coverPhoto ||
    `https://picsum.photos/seed/group-${group.id}/1200/720`
  )
}

function formatPrivacy(value?: GroupPrivacy) {
  return value === 'PRIVATE' ? 'Riêng tư' : 'Công khai'
}



function inferSummary(group: Group) {
  if (group.description?.trim()) return group.description
  return 'Không gian để thảo luận, chia sẻ tài liệu và cập nhật tiến độ hằng tuần.'
}

export default function GroupsPage() {
  const { user } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'discover'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState<{ id: string; name: string } | null>(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.group-dropdown-menu')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('action') === 'requests') {
      setShowRequestsModal(true)
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])
  const [showAllMyGroups, setShowAllMyGroups] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<GroupPrivacy>('PUBLIC')
  const [newGroupCoverUrl, setNewGroupCoverUrl] = useState('')
  const [newGroupCoverFile, setNewGroupCoverFile] = useState<File | null>(null)
  const [newGroupCoverPreviewUrl, setNewGroupCoverPreviewUrl] = useState('')

  useEffect(() => {
    return () => {
      if (newGroupCoverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newGroupCoverPreviewUrl)
      }
    }
  }, [newGroupCoverPreviewUrl])

  const resetCreateGroupForm = () => {
    if (newGroupCoverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(newGroupCoverPreviewUrl)
    }
    setNewGroupName('')
    setNewGroupDescription('')
    setNewGroupPrivacy('PUBLIC')
    setNewGroupCoverUrl('')
    setNewGroupCoverFile(null)
    setNewGroupCoverPreviewUrl('')
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    resetCreateGroupForm()
  }

  const myGroupsQuery = useQuery({
    queryKey: ['my-groups'],
    queryFn: groupsApi.getMyGroups,
  })

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  })

  const ownerJoinRequestsQuery = useQuery({
    queryKey: ['owner-join-requests', myGroupsQuery.data?.map((group) => `${group.id}:${group.isOwner ? '1' : '0'}`).join('|')],
    enabled: !!myGroupsQuery.data,
    queryFn: async (): Promise<JoinRequestEntry[]> => {
      const mine = myGroupsQuery.data ?? []
      const ownerGroups = mine.filter((group) => group.isOwner)
      const rows = await Promise.all(
        ownerGroups.map(async (group) => {
          const requests = await groupsApi.getJoinRequests(group.id)
          return requests.map((request) => ({
            groupId: group.id,
            groupName: group.name,
            requester: request.requester,
            requestedAt: request.requestedAt,
          }))
        })
      )
      return rows.flat()
    },
  })

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.join(groupId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success(result.status === 'REQUESTED' ? 'Đã gửi yêu cầu tham gia nhóm.' : 'Đã tham gia nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const leaveMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.leave(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Đã rời nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Đã xóa nhóm.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      let coverUrl = newGroupCoverUrl.trim() || undefined
      if (newGroupCoverFile) {
        const uploaded = await uploadsApi.uploadImage(newGroupCoverFile, 'covers')
        coverUrl = uploaded.url
      }

      return groupsApi.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        coverUrl,
        privacy: newGroupPrivacy,
      })
    },
    onSuccess: () => {
      setShowCreateModal(false)
      resetCreateGroupForm()
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Tạo nhóm thành công.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const approveRequestMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => groupsApi.approveJoinRequest(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-join-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Đã duyệt yêu cầu.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const rejectRequestMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => groupsApi.rejectJoinRequest(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-join-requests'] })
      toast.success('Đã từ chối yêu cầu.')
    },
    onError: (error) => toast.error(extractError(error)),
  })

  const myGroups = myGroupsQuery.data ?? []
  const allGroups = groupsQuery.data ?? []
  const myIds = new Set(myGroups.map((group) => group.id))
  const pendingRequests = ownerJoinRequestsQuery.data ?? []

  const discoverGroups = useMemo(
    () => allGroups.filter((group) => !myIds.has(group.id)),
    [allGroups, myIds]
  )

  const filteredMyGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return myGroups
    return myGroups.filter((group) =>
      `${group.name} ${group.description ?? ''}`.toLowerCase().includes(keyword)
    )
  }, [myGroups, query])

  const filteredDiscoverGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return discoverGroups
    return discoverGroups.filter((group) =>
      `${group.name} ${group.description ?? ''}`.toLowerCase().includes(keyword)
    )
  }, [discoverGroups, query])

  const visibleMyGroups = activeTab === 'discover' ? [] : filteredMyGroups
  const visibleDiscoverGroups = activeTab === 'mine' ? [] : filteredDiscoverGroups
  const displayedMyGroups = showAllMyGroups ? visibleMyGroups : visibleMyGroups.slice(0, 6)
  const hasMoreMyGroups = visibleMyGroups.length > 6

  const ownedGroups = myGroups.filter((group) => group.isOwner || group.ownerId === user?.id)
  const stats = [
    { label: 'Đã tham gia', value: myGroups.length },
    { label: 'Khám phá', value: discoverGroups.length },
    { label: 'Quản lý', value: ownedGroups.length },
    { label: 'Chờ duyệt', value: pendingRequests.length },
  ]
  const createGroupCoverPreview = newGroupCoverPreviewUrl || newGroupCoverUrl.trim()

  return (
    <>
      <div className='mx-auto max-w-[1400px] space-y-6 px-0 pb-8 sm:px-4 lg:px-6'>
        <section className='overflow-hidden rounded-none border-0 bg-[#0d1328] text-white sm:rounded-[32px] sm:border sm:border-slate-800'>
          <div className='relative'>
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.18),transparent_35%)]' />
            <div className='relative grid gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end'>
              <div className='space-y-4'>
                <span className='inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100'>
                  Trung tâm nhóm
                </span>
                <div className='space-y-3'>
                  <h1 className='max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl'>
                    Quản lý và khám phá nhóm trong một giao diện gọn, rõ và dễ dùng hơn.
                  </h1>
                  <p className='max-w-2xl text-sm leading-6 text-slate-300 sm:text-base'>
                    Theo dõi nhóm bạn tham gia, duyệt yêu cầu chờ xử lý và vào nhanh các không gian học tập đang hoạt động.
                  </p>
                </div>
                <div className='flex flex-wrap gap-3'>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className='!rounded-full !bg-[#f8fafc] !px-5 !text-slate-950 hover:!bg-white'
                  >
                    Tạo nhóm
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => setShowRequestsModal(true)}
                    className='!rounded-full !border-white/20 !bg-white/5 !px-5 !text-white hover:!bg-white/10'
                  >
                    Xem yêu cầu
                  </Button>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                {stats.map((item) => (
                  <div key={item.label} className='rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur'>
                    <div className='text-3xl font-bold'>{String(item.value).padStart(2, '0')}</div>
                    <div className='mt-1 text-sm text-slate-300'>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className='rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex flex-wrap gap-2'>
              {[
                { key: 'all', label: 'Tất cả nhóm' },
                { key: 'mine', label: 'Nhóm của bạn' },
                { key: 'discover', label: 'Khám phá' },
              ].map((item) => (
                <button
                  key={item.key}
                  type='button'
                  onClick={() => setActiveTab(item.key as 'all' | 'mine' | 'discover')}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition',
                    activeTab === item.key
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className='flex w-full max-w-xl items-center gap-3'>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Tìm theo tên hoặc mô tả'
                className='h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white'
              />
              <Button variant='secondary' onClick={() => {
                myGroupsQuery.refetch()
                groupsQuery.refetch()
                ownerJoinRequestsQuery.refetch()
              }}>
                Làm mới
              </Button>
            </div>
          </div>
        </section>

        {(activeTab === 'all' || activeTab === 'mine') && (
          <section className='space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
          <div className='flex items-end justify-between gap-4'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-400'>Không gian của bạn</p>
              <h2 className='mt-1 text-2xl font-bold text-slate-950'>Nhóm đã tham gia</h2>
            </div>
            <p className='text-sm text-slate-500'>{visibleMyGroups.length} nhóm hiển thị</p>
          </div>

          {myGroupsQuery.isLoading ? (
            <p className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500'>
              Đang tải danh sách nhóm của bạn...
            </p>
          ) : visibleMyGroups.length === 0 ? (
            <p className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500'>
              Không có nhóm nào khớp với bộ lọc hiện tại.
            </p>
          ) : (
            <>
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {displayedMyGroups.map((group) => {
                  const role = group.isOwner || group.ownerId === user?.id ? 'Quản trị' : 'Thành viên'
                  return (
                    <article key={group.id} className='flex flex-col overflow-visible rounded-[28px] border border-slate-200 bg-white'>
                      <div className='relative h-40 overflow-hidden rounded-t-[28px]'>
                        <img src={getCover(group)} alt={group.name} className='h-full w-full object-cover' />
                        <div className='absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent' />
                        <div className='absolute inset-x-0 bottom-0 p-4 text-white'>
                          <div className='mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200'>
                            <span>{role}</span>
                            <span className='h-1 w-1 rounded-full bg-white/70' />
                            <span>{formatPrivacy(group.privacy)}</span>
                          </div>
                          <h3 className='line-clamp-2 text-2xl font-bold'>{group.name}</h3>
                        </div>
                      </div>

                      <div className='flex flex-1 flex-col p-4'>
                        <p className='min-h-[48px] line-clamp-2 text-sm leading-6 text-slate-600'>{inferSummary(group)}</p>
                        <div className='mt-4 flex items-center text-sm text-slate-500'>
                          <span>{group.membersCount ?? 0} thành viên</span>
                        </div>
                        <div className='mt-4 flex gap-2'>
                          <Link to={`/groups/${group.id}`} className='w-[70%]'>
                            <Button fullWidth>Vào nhóm</Button>
                          </Link>
                          <div className='group-dropdown-menu relative w-[30%]'>
                            <Button 
                              variant='secondary' 
                              fullWidth 
                              onClick={(e) => {
                                e.preventDefault()
                                setOpenDropdownId(openDropdownId === group.id ? null : group.id)
                              }}
                            >
                              <svg className="mx-auto h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                              </svg>
                            </Button>
                            
                            {openDropdownId === group.id && (
                              <div className='absolute bottom-full right-0 z-10 mb-2 w-40 origin-bottom-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg'>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    setConfirmLeaveGroup({ id: group.id, name: group.name })
                                  }}
                                  className='block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 text-slate-700'
                                >
                                  Rời nhóm
                                </button>
                                {role === 'Quản trị' && (
                                  <button
                                    type='button'
                                    onClick={() => {
                                      setOpenDropdownId(null)
                                      setConfirmDeleteGroup({ id: group.id, name: group.name })
                                    }}
                                    className='mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-red-50 text-red-600'
                                  >
                                    Xóa nhóm
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              {hasMoreMyGroups && (
                <div className='flex justify-center pt-2'>
                  <Button variant='secondary' onClick={() => setShowAllMyGroups((prev) => !prev)}>
                    {showAllMyGroups ? 'Thu gọn' : 'Xem thêm'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
        )}

        {(activeTab === 'all' || activeTab === 'discover') && (
          <section className='space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-400'>Khám phá</p>
                <h2 className='mt-1 text-2xl font-bold text-slate-950'>Nhóm có thể tham gia</h2>
              </div>
              <p className='text-sm text-slate-500'>{visibleDiscoverGroups.length} nhóm hiển thị</p>
            </div>

            {groupsQuery.isLoading ? (
              <p className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500'>
                Đang tải danh sách nhóm...
              </p>
            ) : visibleDiscoverGroups.length === 0 ? (
              <p className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500'>
                Không có nhóm nào khớp với bộ lọc hiện tại.
              </p>
            ) : (
              <div className='space-y-3'>
                {visibleDiscoverGroups.map((group) => (
                  <article key={group.id} className='rounded-[24px] border border-slate-200 bg-slate-50 p-3 transition hover:bg-white'>
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='flex min-w-0 gap-3'>
                        <img src={getCover(group)} alt={group.name} className='h-16 w-16 rounded-[20px] object-cover' />
                        <div className='min-w-0'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='text-lg font-bold text-slate-950'>{group.name}</h3>
                          </div>
                          <p className='mt-1 line-clamp-2 text-sm leading-6 text-slate-600'>{inferSummary(group)}</p>
                          <div className='mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400'>
                            {group.membersCount ?? 0} thành viên
                          </div>
                        </div>
                      </div>

                      <div className='sm:w-[160px]'>
                        {group.isJoinRequested ? (
                          <Button fullWidth disabled variant='secondary'>
                            Đang chờ duyệt
                          </Button>
                        ) : (
                          <Button
                            fullWidth
                            loading={joinMutation.isPending}
                            onClick={() => joinMutation.mutate(group.id)}
                          >
                            Tham gia nhóm
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title='Tạo nhóm'
        size='2xl'
        footer={(
          <>
            <Button variant='secondary' onClick={closeCreateModal} disabled={createGroupMutation.isPending}>
              Hủy
            </Button>
            <Button
              onClick={() => createGroupMutation.mutate()}
              loading={createGroupMutation.isPending}
              disabled={!newGroupName.trim()}
            >
              Tạo nhóm
            </Button>
          </>
        )}
      >
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]'>
          <div className='space-y-4'>
            <div className='rounded-[24px] border border-slate-200 bg-slate-50/80 p-4'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>Thông tin cơ bản</p>
              <div className='mt-4 space-y-4'>
                <label className='block space-y-2'>
                  <span className='text-sm font-medium text-slate-700'>Tên nhóm</span>
                  <input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder='Ví dụ: Nhóm học AI'
                    className='h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100'
                  />
                </label>

                <label className='block space-y-2'>
                  <span className='text-sm font-medium text-slate-700'>Mô tả</span>
                  <textarea
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                    placeholder='Mô tả ngắn về mục tiêu, cách hoạt động hoặc chủ đề của nhóm.'
                    rows={3}
                    className='w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100'
                  />
                </label>
              </div>
            </div>

            <div className='rounded-[24px] border border-slate-200 bg-white p-4'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>Ảnh bìa và quyền riêng tư</p>
              
              <div className='mt-4 space-y-4'>
                <label className='block space-y-2'>
                  <span className='text-sm font-medium text-slate-700'>Quyền riêng tư</span>
                  <select
                    value={newGroupPrivacy}
                    onChange={(event) => setNewGroupPrivacy(event.target.value as GroupPrivacy)}
                    className='h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100'
                  >
                    <option value='PUBLIC'>Công khai</option>
                    <option value='PRIVATE'>Riêng tư</option>
                  </select>
                </label>

                <input
                  ref={coverInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    if (newGroupCoverPreviewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(newGroupCoverPreviewUrl)
                    }
                    setNewGroupCoverFile(file)
                    setNewGroupCoverUrl('')
                    setNewGroupCoverPreviewUrl(URL.createObjectURL(file))
                    event.currentTarget.value = ''
                  }}
                />

                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='secondary'
                    onClick={() => coverInputRef.current?.click()}
                    className='h-12 !rounded-2xl'
                  >
                    Chọn ảnh từ máy
                  </Button>
                  {(newGroupCoverUrl || newGroupCoverPreviewUrl) && (
                    <Button
                      variant='ghost'
                      className='h-12 !rounded-2xl'
                      onClick={() => {
                        if (newGroupCoverPreviewUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(newGroupCoverPreviewUrl)
                        }
                        setNewGroupCoverFile(null)
                        setNewGroupCoverUrl('')
                        setNewGroupCoverPreviewUrl('')
                      }}
                    >
                      Xóa ảnh
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className='rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-4 sm:p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>Xem trước</p>
                <h3 className='mt-1 text-lg font-bold text-slate-950'>Thẻ nhóm</h3>
              </div>
              <span className='rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm'>
                {formatPrivacy(newGroupPrivacy)}
              </span>
            </div>

            <div className='mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]'>
              <div className='relative h-44 bg-slate-100'>
                {createGroupCoverPreview ? (
                  <img src={createGroupCoverPreview} alt='Xem trước ảnh bìa nhóm' className='h-full w-full object-cover' />
                ) : (
                  <div className='flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_45%),linear-gradient(135deg,#e2e8f0,#f8fafc)] text-sm text-slate-400'>
                    Chưa có ảnh bìa
                  </div>
                )}
                <div className='absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent' />
                <div className='absolute inset-x-0 bottom-0 p-4 text-white'>
                  <div className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-200'>Nhóm học tập</div>
                  <div className='mt-1 line-clamp-2 text-2xl font-bold'>{newGroupName.trim() || 'Nhóm mới'}</div>
                </div>
              </div>

              <div className='space-y-3 p-4'>
                <p className='line-clamp-4 text-sm leading-6 text-slate-600'>
                  {newGroupDescription.trim() || 'Mô tả mục đích của nhóm để thành viên mới hiểu nhanh nội dung và cách hoạt động.'}
                </p>
                <div className='flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>
                  <span>{formatPrivacy(newGroupPrivacy)}</span>
                  <span>{newGroupCoverFile ? 'Đã chọn ảnh' : 'Chưa có ảnh'}</span>
                </div>
              </div>
            </div>

            <div className='mt-4 rounded-[24px] border border-blue-100 bg-white/80 p-4 text-sm text-slate-600'>
              Ảnh bìa từ máy chỉ được tải lên khi bạn bấm <span className='font-semibold text-slate-900'>Tạo nhóm</span>. Nếu hủy, sẽ không phát sinh file rác trên Cloudinary.
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        title='Yêu cầu tham gia đang chờ duyệt'
        size='2xl'
      >
        <div className='space-y-3'>
          {ownerJoinRequestsQuery.isLoading ? (
            <p className='text-sm text-slate-500'>Đang tải yêu cầu...</p>
          ) : pendingRequests.length === 0 ? (
            <p className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500'>
              Hiện chưa có yêu cầu nào cần duyệt.
            </p>
          ) : (
            pendingRequests.map((entry) => (
              <article
                key={`${entry.groupId}-${entry.requester.id}-${entry.requestedAt}`}
                className='flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <div className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>{entry.groupName}</div>
                  <div className='mt-1 text-lg font-bold text-slate-950'>{entry.requester.displayName}</div>
                  <div className='text-sm text-slate-500'>{new Date(entry.requestedAt).toLocaleString()}</div>
                </div>

                <div className='flex gap-2'>
                  <Button
                    loading={approveRequestMutation.isPending}
                    onClick={() => approveRequestMutation.mutate({ groupId: entry.groupId, userId: entry.requester.id })}
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant='secondary'
                    loading={rejectRequestMutation.isPending}
                    onClick={() => rejectRequestMutation.mutate({ groupId: entry.groupId, userId: entry.requester.id })}
                  >
                    Từ chối
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmLeaveGroup}
        onClose={() => setConfirmLeaveGroup(null)}
        onConfirm={() => {
          if (confirmLeaveGroup) {
            leaveMutation.mutate(confirmLeaveGroup.id, {
              onSettled: () => setConfirmLeaveGroup(null),
            })
          }
        }}
        title='Xác nhận rời nhóm?'
        description={`Bạn có chắc chắn muốn rời nhóm ${confirmLeaveGroup?.name}?`}
        confirmText='Rời nhóm'
        cancelText='Hủy'
        tone='warning'
        loading={leaveMutation.isPending}
      />

      <ConfirmDialog
        open={!!confirmDeleteGroup}
        onClose={() => setConfirmDeleteGroup(null)}
        onConfirm={() => {
          if (confirmDeleteGroup) {
            deleteGroupMutation.mutate(confirmDeleteGroup.id, {
              onSettled: () => setConfirmDeleteGroup(null),
            })
          }
        }}
        title='Xác nhận xóa nhóm?'
        description={`Bạn có chắc chắn muốn xóa nhóm ${confirmDeleteGroup?.name}? Hành động này không thể hoàn tác.`}
        confirmText='Xóa nhóm'
        cancelText='Hủy'
        tone='danger'
        loading={deleteGroupMutation.isPending}
      />
    </>
  )
}
