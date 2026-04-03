import { ChangeEvent, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { friendsApi } from '@/api/users'
import { postsApi } from '@/api/posts'
import { uploadsApi, chatApi } from '@/api/index'
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

const TABS = ['Bài viết', 'Giới thiệu', 'Bạn bè', 'Ảnh'] as const

type ProfileTab = typeof TABS[number]

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

export default function ProfilePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, updateUser } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ProfileTab>('Bài viết')

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

  const { data: requests } = useQuery({ queryKey: ['friend-requests'], queryFn: friendsApi.getRequests })
  const { data: sentRequests } = useQuery({ queryKey: ['friend-sent-requests'], queryFn: friendsApi.getSentRequests })
  const { data: friends } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.getFriends })

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

  const isOwnProfile = currentUser?.id === id
  const posts = postsData?.data ?? []
  const isFriend = !!friends?.some(u => u.id === id)
  const hasSentRequest = !!sentRequests?.some(u => u.id === id)
  const hasReceivedRequest = !!requests?.some(u => u.id === id)

  const postImages = useMemo(() => posts.flatMap(post => post.images ?? []).filter(Boolean), [posts])

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
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-card border border-border-light overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden">
          {profile.coverPhoto && <img src={profile.coverPhoto} alt="Ảnh bìa" className="w-full h-full object-cover" />}
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-12 mb-3">
            <div className="border-4 border-white rounded-full shadow-md">
              <Avatar src={profile.avatar} name={profile.displayName} size="2xl" />
            </div>
            <div className="flex gap-2 mt-14">
              {isOwnProfile ? (
                <Button variant="secondary" size="sm" onClick={openEditModal}>Chỉnh sửa trang cá nhân</Button>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => id && openConversationMutation.mutate(id)}
                    loading={openConversationMutation.isPending}
                  >
                    Nhắn tin
                  </Button>
                </>
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-text-primary">{profile.displayName}</h1>
          <p className="text-text-secondary text-sm">@{profile.username}</p>
          {profile.bio && <p className="text-text-primary mt-2 text-sm">{profile.bio}</p>}
          {profile.location && <p className="text-text-secondary mt-1 text-sm">Sống tại: {profile.location}</p>}
          <p className="text-text-secondary mt-1 text-sm">Quyền riêng tư hồ sơ: {VISIBILITY_LABEL[profile.profileVisibility ?? 'PUBLIC']}</p>

          <div className="flex gap-6 mt-3 text-sm">
            {[
              { label: 'Bài viết', value: (profile as typeof profile & { postsCount?: number }).postsCount ?? 0 },
              { label: 'Bạn bè', value: (profile as typeof profile & { friendsCount?: number }).friendsCount ?? 0 },
              { label: 'Nhóm', value: (profile as typeof profile & { groupsCount?: number }).groupsCount ?? 0 },
            ].map(stat => (
              <div key={stat.label}>
                <span className="font-bold text-text-primary">{stat.value}</span>
                <span className="text-text-secondary ml-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex border-t border-border-light">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === activeTab
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-text-secondary hover:bg-hover-bg'
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
          posts.map(post => <PostCard key={post.id} post={post} />)
        )
      )}

      {activeTab === 'Giới thiệu' && (
        <div className="bg-white rounded-lg shadow-card border border-border-light p-4 space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">Giới thiệu</h3>
          <p className="text-sm text-text-secondary">Tên hiển thị: <span className="text-text-primary font-medium">{profile.displayName}</span></p>
          <p className="text-sm text-text-secondary">Username: <span className="text-text-primary font-medium">@{profile.username}</span></p>
          <p className="text-sm text-text-secondary">Tiểu sử: <span className="text-text-primary font-medium">{profile.bio || 'Chưa cập nhật'}</span></p>
          <p className="text-sm text-text-secondary">Nơi sinh sống: <span className="text-text-primary font-medium">{profile.location || 'Chưa cập nhật'}</span></p>
          <p className="text-sm text-text-secondary">Quyền riêng tư: <span className="text-text-primary font-medium">{VISIBILITY_LABEL[profile.profileVisibility ?? 'PUBLIC']}</span></p>
        </div>
      )}

      {activeTab === 'Bạn bè' && (
        friendsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)}</div>
        ) : userFriends.length === 0 ? (
          <EmptyState title="Chưa có bạn bè" description="Danh sách bạn bè sẽ hiển thị ở đây" icon={<span className="text-3xl">👥</span>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userFriends.map(friend => (
              <Link key={friend.id} to={`/profile/${friend.id}`} className="bg-white rounded-lg shadow-card border border-border-light p-3 flex items-center gap-3 hover:bg-hover-bg">
                <Avatar src={friend.avatar} name={friend.displayName} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{friend.displayName}</p>
                  <p className="text-xs text-text-secondary truncate">{friend.bio || `@${friend.username}`}</p>
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
            onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
            maxLength={50}
            required
          />

          <TextArea
            label="Tiểu sử"
            value={editForm.bio}
            onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
            rows={3}
            maxLength={300}
          />

          <Input
            label="Nơi sinh sống"
            value={editForm.location}
            onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
            maxLength={120}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary" htmlFor="profile-visibility">Quyền riêng tư hồ sơ</label>
            <select
              id="profile-visibility"
              value={editForm.profileVisibility}
              onChange={(e) => setEditForm(prev => ({ ...prev, profileVisibility: e.target.value as EditProfileForm['profileVisibility'] }))}
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
    </div>
  )
}
