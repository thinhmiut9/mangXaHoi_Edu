import { ChangeEvent, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { friendsApi } from '@/api/users'
import { postsApi } from '@/api/posts'
import { uploadsApi, chatApi, groupsApi } from '@/api/index'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PostCard } from '@/components/shared/PostCard'
import { ProfileSkeleton, PostSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

const TABS = ['Bài viết', 'Giới thiệu', 'Tài liệu', 'Bạn bè', 'Ảnh'] as const

type ProfileTab = typeof TABS[number]
type StatLabel = 'Bài viết' | 'Bạn bè' | 'Nhóm' | 'Tài liệu' | 'Kỹ năng'

type EditProfileForm = {
  displayName: string
  bio: string
  location: string
  avatar: string
  coverPhoto: string
  profileVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
}

const VISIBILITY_LABEL: Record<'PUBLIC' | 'FRIENDS' | 'PRIVATE', string> = {
  PUBLIC: 'Công khai',
  FRIENDS: 'Bạn bè',
  PRIVATE: 'Riêng tư',
}

const EMPTY_FORM: EditProfileForm = {
  displayName: '',
  bio: '',
  location: '',
  avatar: '',
  coverPhoto: '',
  profileVisibility: 'PUBLIC',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${Math.max(min, 1)} phút trước`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} giờ trước`
  const day = Math.floor(hour / 24)
  return `${day} ngày trước`
}

function compactText(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').replace(/\s+/g, ' ').trim()
  return raw || fallback
}

function previewText(value: string | undefined, fallback: string, max = 62): string {
  const v = compactText(value, fallback)
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

function getFileNameFromUrl(url: string): string {
  const noQuery = url.split('?')[0]
  const fileName = noQuery.split('/').pop() || ''
  if (!fileName) return 'Tài liệu đính kèm'
  try {
    return decodeURIComponent(fileName)
  } catch {
    return fileName
  }
}

function statIcon(label: string) {
  if (label === 'Bài viết') {
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4z" /></svg>
  }
  if (label === 'Bạn bè') {
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5" /><path d="M13 19c.4-2.1 2.5-3.6 5-3.6 1.3 0 2.5.4 3.5 1.1" /></svg>
  }
  if (label === 'Nhóm') {
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="8" y="13" width="8" height="7" rx="1.5" /></svg>
  }
  if (label === 'Tài liệu') {
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /></svg>
  }
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l2.7 5.5L21 8.3l-4.5 4.4 1 6.3L12 16.8 6.5 19l1-6.3L3 8.3l6.3-.8L12 2z" /></svg>
}

function statIconTone(label: string): string {
  if (label === 'Bài viết') return 'bg-blue-50 text-blue-600'
  if (label === 'Bạn bè') return 'bg-emerald-50 text-emerald-600'
  if (label === 'Nhóm') return 'bg-violet-50 text-violet-600'
  if (label === 'Tài liệu') return 'bg-amber-50 text-amber-600'
  return 'bg-pink-50 text-pink-600'
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, updateUser } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ProfileTab>('Bài viết')
  const [statModal, setStatModal] = useState<StatLabel | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditProfileForm>(EMPTY_FORM)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [coverPreview, setCoverPreview] = useState<string>('')

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => usersApi.getProfile(id!),
    enabled: !!id,
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', id],
    queryFn: () => postsApi.getUserPosts(id!),
    enabled: !!id,
  })

  const { data: userFriends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['profile-friends', id],
    queryFn: () => usersApi.getUserFriends(id!),
    enabled: !!id,
  })
  const { data: myGroups = [] } = useQuery({
    queryKey: ['my-groups'],
    queryFn: groupsApi.getMyGroups,
    enabled: Boolean(id && currentUser?.id === id),
  })

  const { data: requests } = useQuery({ queryKey: ['friend-requests'], queryFn: friendsApi.getRequests })
  const { data: sentRequests } = useQuery({ queryKey: ['friend-sent-requests'], queryFn: friendsApi.getSentRequests })
  const { data: friends } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.getFriends })
  const { data: blockedUsers } = useQuery({ queryKey: ['blocked-users'], queryFn: friendsApi.getBlockedUsers })

  const friendRequestMutation = useMutation({
    mutationFn: () => friendsApi.sendRequest(id!),
    onSuccess: () => {
      toast.success('Đã gửi lời mời kết bạn')
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const acceptMutation = useMutation({
    mutationFn: friendsApi.acceptRequest,
    onSuccess: () => {
      toast.success('Đã chấp nhận lời mời')
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: friendsApi.rejectRequest,
    onSuccess: () => {
      toast.success('Đã từ chối lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: friendsApi.cancelRequest,
    onSuccess: () => {
      toast.success('Đã thu hồi lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const unfriendMutation = useMutation({
    mutationFn: friendsApi.unfriend,
    onSuccess: () => {
      toast.success('Đã hủy kết bạn')
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      let avatar = editForm.avatar
      let coverPhoto = editForm.coverPhoto

      if (avatarFile) {
        const upload = await uploadsApi.uploadAvatar(avatarFile)
        avatar = upload.url
      }

      if (coverFile) {
        const upload = await uploadsApi.uploadImage(coverFile)
        coverPhoto = upload.url
      }

      return usersApi.updateProfile({
        displayName: editForm.displayName.trim(),
        bio: editForm.bio.trim(),
        location: editForm.location.trim(),
        avatar,
        coverPhoto,
        profileVisibility: editForm.profileVisibility,
      })
    },
    onSuccess: (updatedUser) => {
      toast.success('Cập nhật thông tin thành công')
      setEditOpen(false)
      setAvatarFile(null)
      setCoverFile(null)
      setAvatarPreview('')
      setCoverPreview('')

      if (currentUser?.id === id) {
        updateUser({
          displayName: updatedUser.displayName,
          bio: updatedUser.bio,
          location: updatedUser.location,
          avatar: updatedUser.avatar,
          coverPhoto: updatedUser.coverPhoto,
          profileVisibility: updatedUser.profileVisibility,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const openConversationMutation = useMutation({
    mutationFn: (targetId: string) => chatApi.getOrCreateConversation(targetId),
    onSuccess: (conversation) => {
      navigate(`/chat/${conversation.id}`)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const blockMutation = useMutation({
    mutationFn: (targetId: string) => friendsApi.blockUser(targetId),
    onSuccess: () => {
      toast.success('Đã chặn người dùng')
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const unblockMutation = useMutation({
    mutationFn: (targetId: string) => friendsApi.unblockUser(targetId),
    onSuccess: () => {
      toast.success('Đã bỏ chặn người dùng')
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', id] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const isOwnProfile = currentUser?.id === id
  const posts = postsData?.data ?? []
  const profileSkills = useMemo(() => {
    const raw = (profile as { skills?: unknown } | undefined)?.skills
    if (!Array.isArray(raw)) return []
    return raw.filter((skill): skill is string => typeof skill === 'string' && skill.trim().length > 0)
  }, [profile])
  const isFriend = !!friends?.some((u) => u.id === id)
  const hasSentRequest = !!sentRequests?.some((u) => u.id === id)
  const hasReceivedRequest = !!requests?.some((u) => u.id === id)
  const isBlocked = !!blockedUsers?.some((u) => u.id === id)

  const postImages = useMemo(
    () => posts.flatMap((post) => post.imageUrls ?? post.images ?? []).filter(Boolean),
    [posts]
  )
  const featuredDocuments = useMemo(
    () =>
      posts
        .flatMap((p) =>
          (p.documentUrls ?? p.mediaUrls ?? p.images ?? [])
            .filter((url) => typeof url === 'string' && url.length > 0)
            .map((url, idx) => ({
              id: `${p.id}-doc-${idx}`,
              fileName: getFileNameFromUrl(url),
              createdAt: p.createdAt,
            }))
        )
        .slice(0, 6),
    [posts]
  )

  const imageFromPosts = useMemo(
    () =>
      posts.filter((p) =>
        (p.imageUrls ?? p.images ?? []).some((url) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) || url.includes('/image/upload/'))
      ),
    [posts]
  )

  const recentActivities = useMemo(
    () => {
      const postActivities = posts.map((p) => {
        const hasDoc = (p.documentUrls ?? []).length > 0
        const hasImage = (p.imageUrls ?? p.images ?? []).length > 0
        const hasVideo = (p.videoUrls ?? []).length > 0
        const title = p.groupId && p.groupName
          ? `Đã đăng bài trong nhóm ${p.groupName}`
          : hasDoc
            ? 'Đã đăng tài liệu mới'
            : hasVideo
              ? 'Đã đăng video mới'
            : hasImage
              ? 'Đã đăng ảnh mới'
              : 'Đã đăng bài viết mới'
        return {
          id: `post-${p.id}`,
          title,
          at: p.createdAt,
        }
      })

      const groupActivities = (id && currentUser?.id === id ? myGroups : [])
        .map((g) => ({
          id: `group-${g.id}`,
          title: `Đang tham gia nhóm ${g.name}`,
          at: g.updatedAt || g.createdAt,
        }))

      return [...postActivities, ...groupActivities]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 5)
    },
    [posts, myGroups, id, currentUser?.id]
  )

  const profileStats = profile as (typeof profile & { postsCount?: number; friendsCount?: number; groupsCount?: number }) | undefined
  const joinedDate = (profile as { createdAt?: string } | undefined)?.createdAt
    ? new Date((profile as { createdAt?: string }).createdAt as string)
    : null
  const joinedLabel = joinedDate
    ? `Tham gia tháng ${joinedDate.getMonth() + 1}, ${joinedDate.getFullYear()}`
    : 'Tham gia gần đây'
  const statCards = [
    { label: 'Bài viết', value: profileStats?.postsCount ?? 0, color: 'bg-blue-500' },
    { label: 'Bạn bè', value: profileStats?.friendsCount ?? 0, color: 'bg-emerald-500' },
    { label: 'Nhóm', value: profileStats?.groupsCount ?? 0, color: 'bg-violet-500' },
    { label: 'Tài liệu', value: featuredDocuments.length, color: 'bg-amber-500' },
    { label: 'Kỹ năng', value: profileSkills.length, color: 'bg-pink-500' },
  ] as const

  const openEditModal = () => {
    if (!profile) return
    setEditForm({
      displayName: profile.displayName ?? '',
      bio: profile.bio ?? '',
      location: profile.location ?? '',
      avatar: profile.avatar ?? '',
      coverPhoto: profile.coverPhoto ?? '',
      profileVisibility: profile.profileVisibility ?? 'PUBLIC',
    })
    setAvatarFile(null)
    setCoverFile(null)
    setAvatarPreview('')
    setCoverPreview('')
    setEditOpen(true)
  }

  const onAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const onCoverFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <ProfileSkeleton />
        <PostSkeleton />
      </div>
    )
  }

  if (!profile) {
    return (
      <EmptyState
        title="Người dùng không tồn tại"
        description="Trang cá nhân này không tồn tại hoặc đã bị xóa."
        icon={<span className="text-3xl">👤</span>}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
      <section className="space-y-4 min-w-0">
        <div className="bg-white rounded-none sm:rounded-2xl sm:border border-border-light shadow-card overflow-hidden">
          {/* Cover photo */}
          <div className="h-28 sm:h-36 md:h-44 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 relative">
            {profile.coverPhoto && <img src={profile.coverPhoto} alt="Ảnh bìa" className="w-full h-full object-cover" />}
          </div>

          <div className="px-3 sm:px-4 md:px-5 pb-3">
            {/* Avatar + name row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
              {/* Avatar - floats out of cover */}
              <div className="-mt-10 sm:-mt-12 mb-2 sm:mb-0 shrink-0 border-[3px] border-white rounded-full shadow-md self-start">
                <Avatar src={profile.avatar} name={profile.displayName} size="2xl" online={true} />
              </div>

              {/* Name + info */}
              <div className="min-w-0 flex-1 pt-1 sm:pt-4">
                <h1 className="text-2xl sm:text-3xl md:text-[38px] leading-tight font-extrabold tracking-tight text-slate-900 break-words">
                  {profile.displayName}
                </h1>
                <p className="mt-0.5 text-slate-500 text-sm">@{profile.username || profile.email?.split('@')[0]}</p>
                {profile.bio && (
                  <p className="mt-1 text-sm text-slate-700 line-clamp-2">{profile.bio}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-slate-500">
                  {profile.school && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3L2 8l10 5 10-5-10-5z"/><path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/></svg>
                      <span className="truncate max-w-[120px]">{profile.school}</span>
                    </span>
                  )}
                  {profile.major && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 19V8l7-4 7 4v11"/></svg>
                      <span className="truncate max-w-[120px]">{profile.major}</span>
                    </span>
                  )}
                  {profile.location && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>
                      <span className="truncate max-w-[120px]">{profile.location}</span>
                    </span>
                  )}
                  {joinedDate && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {joinedLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons - separate row on mobile */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <>
                  <Button variant="secondary" size="sm" onClick={openEditModal}>Chỉnh sửa hồ sơ</Button>
                  <button
                    type="button"
                    aria-label="Tùy chọn"
                    className="h-9 w-9 rounded-lg border border-border-light bg-slate-50 text-slate-500 hover:bg-slate-100"
                  >
                    <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
                  </button>
                </>
              ) : (
                <>
                  {isBlocked ? (
                    <Button variant="secondary" size="sm" onClick={() => id && unblockMutation.mutate(id)} loading={unblockMutation.isPending}>Bỏ chặn</Button>
                  ) : (
                    <>
                      {hasReceivedRequest ? (
                        <>
                          <Button size="sm" onClick={() => id && acceptMutation.mutate(id)} loading={acceptMutation.isPending}>Chấp nhận</Button>
                          <Button variant="secondary" size="sm" onClick={() => id && rejectMutation.mutate(id)} loading={rejectMutation.isPending}>Từ chối</Button>
                        </>
                      ) : isFriend ? (
                        <Button variant="secondary" size="sm" onClick={() => id && unfriendMutation.mutate(id)} loading={unfriendMutation.isPending}>Hủy kết bạn</Button>
                      ) : hasSentRequest ? (
                        <Button variant="secondary" size="sm" onClick={() => id && cancelMutation.mutate(id)} loading={cancelMutation.isPending}>Đang chờ phản hồi</Button>
                      ) : (
                        <Button size="sm" onClick={() => friendRequestMutation.mutate()} loading={friendRequestMutation.isPending}>Thêm bạn bè</Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => id && openConversationMutation.mutate(id)} loading={openConversationMutation.isPending}>
                        Nhắn tin
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => id && blockMutation.mutate(id)} loading={blockMutation.isPending}>Chặn</Button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Stat cards - 3 cols on mobile, 5 on desktop */}
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {statCards.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setStatModal(s.label)}
                  className="rounded-xl border border-border-light bg-slate-50 px-2 py-2 sm:px-3 text-left hover:bg-slate-100 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5">
                    <span className={`inline-flex h-7 w-7 sm:h-8 sm:w-8 rounded-full items-center justify-center mb-1 sm:mb-0 ${statIconTone(s.label)}`}>
                      {statIcon(s.label)}
                    </span>
                    <div>
                      <p className="text-xl sm:text-2xl leading-none font-bold text-slate-900">{s.value}</p>
                      <p className="mt-0.5 text-[10px] sm:text-xs font-medium text-slate-600">{s.label}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab bar - scrollable on mobile */}
          <div className="border-t border-border-light flex overflow-x-auto scrollbar-hide px-2 sm:px-4">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex-1 text-center ${
                  tab === activeTab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'Bài viết' && (
          postsLoading ? (
            <PostSkeleton />
          ) : posts.length === 0 ? (
            <EmptyState title="Chưa có bài viết nào" description="Bài viết sẽ xuất hiện ở đây" icon={<span className="text-3xl">📝</span>} />
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} canPin={isOwnProfile} />)
          )
        )}

        {activeTab === 'Giới thiệu' && (
          <div className="bg-white rounded-2xl border border-border-light p-4 shadow-card space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Giới thiệu</h3>
            <p className="text-sm text-slate-600">Tên hiển thị: <span className="font-medium text-slate-900">{profile.displayName}</span></p>
            <p className="text-sm text-slate-600">Tiểu sử: <span className="font-medium text-slate-900">{profile.bio || 'Chưa cập nhật'}</span></p>
            <p className="text-sm text-slate-600">Trường: <span className="font-medium text-slate-900">{profile.school || 'Chưa cập nhật'}</span></p>
            <p className="text-sm text-slate-600">Chuyên ngành: <span className="font-medium text-slate-900">{profile.major || 'Chưa cập nhật'}</span></p>
            <p className="text-sm text-slate-600">Khóa: <span className="font-medium text-slate-900">{profile.cohort || 'Chưa cập nhật'}</span></p>
            <p className="text-sm text-slate-600">Nơi sinh sống: <span className="font-medium text-slate-900">{profile.location || 'Chưa cập nhật'}</span></p>
            <p className="text-sm text-slate-600">Quyền riêng tư: <span className="font-medium text-slate-900">{VISIBILITY_LABEL[profile.profileVisibility ?? 'PUBLIC']}</span></p>
          </div>
        )}

        {activeTab === 'Tài liệu' && (
          <div className="bg-white rounded-2xl border border-border-light p-4 shadow-card">
            {featuredDocuments.length === 0 ? (
              <EmptyState title="Chưa có tài liệu" description="Bạn có thể đăng bài kèm tài liệu để hiển thị tại đây." icon={<span className="text-3xl">📄</span>} />
            ) : (
              <div className="space-y-2">
                {featuredDocuments.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-border-light p-3">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{doc.fileName}</p>
                    <p className="text-xs text-slate-500 mt-1">{timeAgo(doc.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Bạn bè' && (
          friendsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)}</div>
          ) : userFriends.length === 0 ? (
            <EmptyState title="Chưa có bạn bè" description="Danh sách bạn bè sẽ hiển thị ở đây" icon={<span className="text-3xl">👥</span>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userFriends.map((friend) => (
                <Link key={friend.id} to={`/profile/${friend.id}`} className="bg-white rounded-xl shadow-card border border-border-light p-3 flex items-center gap-3 hover:bg-slate-50">
                  <Avatar src={friend.avatar} name={friend.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{friend.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{friend.bio || `@${friend.username}`}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {activeTab === 'Ảnh' && (
          postImages.length === 0 ? (
            <EmptyState title="Chưa có ảnh" description="Ảnh từ các bài viết sẽ hiển thị ở đây" icon={<span className="text-3xl">🖼️</span>} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {postImages.map((img, idx) => (
                <div key={`${img}-${idx}`} className="bg-white rounded-lg overflow-hidden border border-border-light">
                  <img src={img} alt={`Ảnh ${idx + 1}`} className="w-full h-36 sm:h-44 object-cover" />
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <aside className="hidden xl:block xl:sticky xl:top-4 self-start h-[calc(100vh-96px)] overflow-y-auto pr-1 space-y-3">
        <div className="bg-white rounded-2xl border border-border-light p-4 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">Kỹ năng</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profileSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-blue-50 text-blue-600 px-2.5 py-1 text-xs font-medium">{skill}</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-light p-4 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">Tài liệu nổi bật</h3>
          <div className="mt-3 space-y-2">
            {featuredDocuments.slice(0, 2).map((doc) => (
              <div key={doc.id} className="rounded-xl border border-border-light px-3 py-2">
                <p className="text-sm font-semibold text-slate-800 leading-5 break-words">
                  {previewText(doc.fileName, 'Tài liệu đính kèm', 54)}
                </p>
                <p className="text-xs text-slate-500 mt-1">{timeAgo(doc.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-light p-4 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">Hoạt động gần đây</h3>
          <div className="mt-3 space-y-2">
            {recentActivities.map((a) => (
              <div key={a.id} className="rounded-xl border border-border-light px-3 py-2">
                <p className="text-sm text-slate-800 leading-5 break-words">{a.title}</p>
                <p className="text-xs text-slate-500 mt-1">{timeAgo(a.at)}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Chỉnh sửa trang cá nhân"
        size="2xl"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button onClick={() => saveProfileMutation.mutate()} loading={saveProfileMutation.isPending} disabled={!editForm.displayName.trim()}>
              Lưu thay đổi
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Input
            label="Tên hiển thị"
            value={editForm.displayName}
            onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
            maxLength={50}
            required
          />

          <TextArea
            label="Tiểu sử"
            value={editForm.bio}
            onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
            rows={3}
            maxLength={300}
          />

          <Input
            label="Nơi sinh sống"
            value={editForm.location}
            onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
            maxLength={120}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary" htmlFor="profile-visibility">Quyền riêng tư hồ sơ</label>
            <select
              id="profile-visibility"
              value={editForm.profileVisibility}
              onChange={(e) => setEditForm((prev) => ({ ...prev, profileVisibility: e.target.value as EditProfileForm['profileVisibility'] }))}
              className="w-full h-10 rounded-md border border-border-main bg-white px-3 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="PUBLIC">Công khai</option>
              <option value="FRIENDS">Bạn bè</option>
              <option value="PRIVATE">Riêng tư</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Ảnh đại diện</p>
              <div className="flex items-center gap-3">
                <Avatar src={avatarPreview || editForm.avatar} name={editForm.displayName || 'User'} size="lg" />
                <input type="file" accept="image/*" onChange={onAvatarFileChange} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Ảnh bìa</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-md overflow-hidden bg-app-bg border border-border-light shrink-0">
                  {(coverPreview || editForm.coverPhoto) ? (
                    <img src={coverPreview || editForm.coverPhoto} alt="Preview cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">?</div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={onCoverFileChange} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!statModal}
        onClose={() => setStatModal(null)}
        title={statModal ? `${statModal}` : 'Chi tiết'}
        size="lg"
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {statModal === 'Bài viết' && (
            posts.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có bài viết.</p>
            ) : (
              posts.slice(0, 20).map((post) => (
                <div key={post.id} className="rounded-xl border border-border-light px-3 py-2">
                  <p className="text-sm font-medium text-slate-900 leading-5 break-words">
                    {previewText(post.content, 'Bài viết không có nội dung', 80)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{timeAgo(post.createdAt)}</p>
                </div>
              ))
            )
          )}

          {statModal === 'Bạn bè' && (
            userFriends.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có bạn bè.</p>
            ) : (
              userFriends.slice(0, 40).map((friend) => (
                <Link
                  key={friend.id}
                  to={`/profile/${friend.id}`}
                  onClick={() => setStatModal(null)}
                  className="flex items-center gap-3 rounded-xl border border-border-light px-3 py-2 hover:bg-slate-50"
                >
                  <Avatar src={friend.avatar} name={friend.displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{friend.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">@{friend.username}</p>
                  </div>
                </Link>
              ))
            )
          )}

          {statModal === 'Nhóm' && (
            (id && currentUser?.id === id && myGroups.length > 0) ? (
              myGroups.slice(0, 40).map((group) => (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  onClick={() => setStatModal(null)}
                  className="flex items-center gap-3 rounded-xl border border-border-light px-3 py-2 hover:bg-slate-50"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-border-light">
                    {group.coverPhoto ? (
                      <img src={group.coverPhoto} alt={group.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{group.name}</p>
                    <p className="text-xs text-slate-500">{group.membersCount} thành viên</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu nhóm để hiển thị.</p>
            )
          )}

          {statModal === 'Tài liệu' && (
            featuredDocuments.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có tài liệu.</p>
            ) : (
              featuredDocuments.slice(0, 30).map((doc) => (
                <div key={doc.id} className="rounded-xl border border-border-light px-3 py-2">
                  <p className="text-sm font-medium text-slate-900 break-words">{doc.fileName}</p>
                  <p className="text-xs text-slate-500 mt-1">{timeAgo(doc.createdAt)}</p>
                </div>
              ))
            )
          )}

          {statModal === 'Kỹ năng' && (
            profileSkills.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có kỹ năng.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profileSkills.map((skill) => (
                  <span key={skill} className="rounded-full bg-blue-50 text-blue-700 px-3 py-1.5 text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            )
          )}
        </div>
      </Modal>
    </div>
  )
}
