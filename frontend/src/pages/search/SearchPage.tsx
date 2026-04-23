import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { friendsApi, usersApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { timeAgo } from '@/utils/format'

type SearchTab = 'ALL' | 'USERS' | 'POSTS' | 'GROUPS'

const RECENT_SEARCH_KEY = 'edusocial.recent.search'

function SearchIcon() {
  return (
    <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.9 14.32a8 8 0 111.41-1.41l3.69 3.69a1 1 0 01-1.42 1.42l-3.68-3.7zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm6 8a4 4 0 10-8 0v1h8v-1zm1-8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm1 8h3v-.75A3.25 3.25 0 0015.75 12h-.5A3.2 3.2 0 0116 14.25V16z" />
    </svg>
  )
}

function PostIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.5a2 2 0 00-.59-1.41l-2.5-2.5A2 2 0 0013.5 3H4zm8 1.5V7a1 1 0 001 1h2.5L12 4.5zM5 12a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1-4a1 1 0 000 2h3a1 1 0 100-2H6z" />
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M4.5 3A2.5 2.5 0 002 5.5v9A2.5 2.5 0 004.5 17h11a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0015.5 3h-11zm2 4a1 1 0 100 2h7a1 1 0 100-2h-7zm0 4a1 1 0 100 2h4a1 1 0 100-2h-4z" />
    </svg>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [debouncedInput, setDebouncedInput] = useState((searchParams.get('q') ?? '').trim())
  const [activeTab, setActiveTab] = useState<SearchTab>('ALL')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const queryClient = useQueryClient()
  const toast = useToast()

  const keyword = (searchParams.get('q') ?? '').trim()

  useEffect(() => {
    const value = searchParams.get('q') ?? ''
    setInput(value)
    setDebouncedInput(value.trim())
  }, [searchParams])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCH_KEY)
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch {
      setRecentSearches([])
    }
  }, [])

  const saveRecentSearch = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((v) => v.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
      try {
        localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = input.trim()
      setDebouncedInput(trimmed)
      if (trimmed.length >= 2) {
        setSearchParams({ q: trimmed }, { replace: true })
      } else if (!trimmed) {
        setSearchParams({}, { replace: true })
      }
    }, 320)
    return () => clearTimeout(timer)
  }, [input, setSearchParams])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search-all', debouncedInput],
    queryFn: () => usersApi.searchAll(debouncedInput, 12),
    enabled: debouncedInput.length >= 2,
  })

  const { data: requests } = useQuery({ queryKey: ['friend-requests'], queryFn: friendsApi.getRequests })
  const { data: sentRequests } = useQuery({ queryKey: ['friend-sent-requests'], queryFn: friendsApi.getSentRequests })
  const { data: friends } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.getFriends })
  const { data: suggestions } = useQuery({ queryKey: ['friend-suggestions'], queryFn: friendsApi.getSuggestions })

  const requestIds = useMemo(() => new Set((requests ?? []).map((u) => u.id)), [requests])
  const sentIds = useMemo(() => new Set((sentRequests ?? []).map((u) => u.id)), [sentRequests])
  const friendIds = useMemo(() => new Set((friends ?? []).map((u) => u.id)), [friends])

  const sendRequestMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onSuccess: () => {
      toast.success('Đã gửi lời mời kết bạn')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['search-all'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const acceptMutation = useMutation({
    mutationFn: friendsApi.acceptRequest,
    onSuccess: () => {
      toast.success('Đã chấp nhận lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['search-all'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: friendsApi.rejectRequest,
    onSuccess: () => {
      toast.success('Đã từ chối lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['search-all'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: friendsApi.cancelRequest,
    onSuccess: () => {
      toast.success('Đã thu hồi lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['search-all'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = input.trim()
    if (value.length < 2) return
    saveRecentSearch(value)
    setSearchParams({ q: value })
  }

  const userResults = data?.users ?? []
  const postResults = data?.posts ?? []
  const groupResults = data?.groups ?? []
  const totalResults = userResults.length + postResults.length + groupResults.length

  const showingUsers = activeTab === 'ALL' || activeTab === 'USERS'
  const showingPosts = activeTab === 'ALL' || activeTab === 'POSTS'
  const showingGroups = activeTab === 'ALL' || activeTab === 'GROUPS'

  return (
    <div className="space-y-5 pb-4">
      <section
        className="search-hero-panel relative overflow-hidden rounded-[28px] border p-4 shadow-[0_20px_60px_rgba(37,99,235,0.16)] md:p-6"
      >
        <div className="search-hero-glow search-hero-glow-left pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full blur-3xl" />
        <div className="search-hero-glow search-hero-glow-right pointer-events-none absolute -right-12 -top-8 h-48 w-48 rounded-full blur-3xl" />
        <div className="search-hero-glow search-hero-glow-bottom pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full blur-3xl" />

        <div className="relative">
          <div className="text-center">
            <p className="search-hero-tag mx-auto mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md">
              EduSocial Search
            </p>
            <h1 className="text-[28px] font-black leading-tight tracking-tight text-slate-900 md:text-4xl">
              Tìm kiếm bạn bè, nhóm và bài viết
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Trải nghiệm tìm kiếm hiện đại, tối giản và nhanh như ứng dụng mạng xã hội cao cấp.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mx-auto mt-4 max-w-2xl">
            <div className="search-hero-search-shell rounded-[22px] border p-2 shadow-[0_10px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl">
              <div className="search-hero-search-row flex items-center gap-2 rounded-2xl px-2">
                <div className="px-2">
                  <SearchIcon />
                </div>
                <input
                  type="search"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tìm theo tên, email, bài viết hoặc nhóm..."
                  className="search-hero-input h-12 flex-1 bg-transparent text-[15px] focus:outline-none"
                />
                <Button type="submit" className="h-11 rounded-xl bg-[#2563EB] px-4 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition-all hover:scale-[1.02] hover:brightness-105 active:scale-[0.98]">
                  Tìm
                </Button>
              </div>
            </div>
          </form>

          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'USERS', label: 'Người dùng' },
              { key: 'POSTS', label: 'Bài viết' },
              { key: 'GROUPS', label: 'Nhóm' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as SearchTab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab.key
                  ? 'search-tab-active bg-[#2563EB] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)]'
                  : 'search-tab-inactive'
                  }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="search-hero-count ml-auto rounded-full px-3 py-1 text-xs font-semibold">
              {keyword ? `${totalResults} kết quả` : 'Nhập ít nhất 2 ký tự'}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {!keyword ? (
            <EmptyState title="Nhập từ khóa để bắt đầu" description="Gợi ý: tên hiển thị, email, nội dung bài viết, tên nhóm." icon={<span className="text-2xl">🔎</span>} />
          ) : keyword.length < 2 ? (
            <EmptyState title="Từ khóa quá ngắn" description="Vui lòng nhập ít nhất 2 ký tự." icon={<span className="text-2xl">⌨️</span>} />
          ) : isLoading ? (
            <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Đang tìm kiếm kết quả phù hợp...</p>
            </div>
          ) : isError ? (
            <EmptyState title="Không thể tải kết quả" description="Có lỗi xảy ra, vui lòng thử lại." action={<Button variant="secondary" onClick={() => refetch()}>Thử lại</Button>} />
          ) : totalResults === 0 ? (
            <EmptyState title="Không tìm thấy kết quả" description={`Không có kết quả nào cho "${keyword}"`} />
          ) : (
            <div className="space-y-4">
              {showingUsers && (
                <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700"><UsersIcon /></span>
                      Người dùng
                    </h2>
                    <span className="text-sm text-slate-500">{userResults.length} kết quả</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {userResults.map((user) => {
                      const hasIncomingRequest = requestIds.has(user.id)
                      const isFriend = friendIds.has(user.id)
                      const isPending = sentIds.has(user.id)
                      const isSending = sendRequestMutation.isPending && sendRequestMutation.variables === user.id
                      const isAccepting = acceptMutation.isPending && acceptMutation.variables === user.id
                      const isRejecting = rejectMutation.isPending && rejectMutation.variables === user.id
                      const isCancelling = cancelMutation.isPending && cancelMutation.variables === user.id

                      return (
                        <div key={user.id} className="group rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(37,99,235,0.16)]">
                          <div className="flex items-start gap-3">
                            <Link to={`/profile/${user.id}`} className="relative">
                              <span className="absolute -inset-0.5 rounded-full bg-blue-200/60 blur-[2px]" />
                              <Avatar src={user.avatar} name={user.displayName} size="lg" />
                            </Link>

                            <div className="min-w-0 flex-1">
                              <Link to={`/profile/${user.id}`} className="block truncate text-base font-extrabold text-slate-900 hover:text-blue-700 hover:underline">
                                {user.displayName}
                              </Link>
                              <p className="truncate text-sm text-slate-500">{user.email}</p>
                              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{user.bio || `@${user.username}`}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {hasIncomingRequest ? (
                              <>
                                <Button size="sm" onClick={() => acceptMutation.mutate(user.id)} loading={isAccepting}>
                                  Chấp nhận
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => rejectMutation.mutate(user.id)} loading={isRejecting}>
                                  Từ chối
                                </Button>
                              </>
                            ) : isFriend ? (
                              <Button size="sm" variant="secondary" disabled>
                                Bạn bè
                              </Button>
                            ) : isPending ? (
                              <Button size="sm" variant="secondary" onClick={() => cancelMutation.mutate(user.id)} loading={isCancelling}>
                                Đang chờ phản hồi
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => sendRequestMutation.mutate(user.id)}
                                loading={isSending}
                                className="bg-[#2563EB] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] transition-all hover:scale-[1.03] active:scale-[0.98]"
                              >
                                Thêm bạn
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {showingPosts && (
                <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700"><PostIcon /></span>
                      Bài viết
                    </h2>
                    <span className="text-sm text-slate-500">{postResults.length} kết quả</span>
                  </div>

                  {postResults.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">Không có bài viết phù hợp.</p>
                  ) : (
                    <div className="space-y-3">
                      {postResults.map((post) => (
                        <Link
                          key={post.id}
                          to={`/posts/${post.id}`}
                          className="block rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(37,99,235,0.14)]"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Avatar src={post.author?.avatar} name={post.author?.displayName ?? ''} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{post.author?.displayName || 'Người dùng'}</p>
                              <p className="text-xs text-slate-500">{timeAgo(post.createdAt)}</p>
                            </div>
                            {post.groupId && (
                              <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                {post.groupName || 'Nhóm'}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-700">{post.content || '(Bài viết không có nội dung chữ)'}</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                            <span>{post.likesCount} thích</span>
                            <span>{post.commentsCount} bình luận</span>
                            <span>{post.sharesCount} chia sẻ</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showingGroups && (
                <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700"><GroupIcon /></span>
                      Nhóm
                    </h2>
                    <span className="text-sm text-slate-500">{groupResults.length} kết quả</span>
                  </div>

                  {groupResults.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">Không có nhóm phù hợp.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {groupResults.map((group) => (
                        <Link
                          key={group.id}
                          to={`/groups/${group.id}`}
                          className="block rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(37,99,235,0.14)]"
                        >
                          <div className="mb-2 flex items-center gap-3">
                            <div className="h-11 w-11 overflow-hidden rounded-xl bg-slate-100">
                              {group.coverUrl || group.coverPhoto ? (
                                <img src={group.coverUrl || group.coverPhoto} alt={group.name} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-extrabold text-slate-900">{group.name}</p>
                              <p className="text-xs text-slate-500">{group.membersCount} thành viên</p>
                            </div>
                            <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${group.privacy === 'PRIVATE' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {group.privacy === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-600">{group.description || 'Nhóm chưa có mô tả.'}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-extrabold text-slate-900">Tìm kiếm gần đây</h3>
            {recentSearches.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có lịch sử tìm kiếm.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setInput(item)
                      setSearchParams({ q: item })
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-extrabold text-slate-900">Gợi ý kết bạn</h3>
            {!suggestions?.length ? (
              <p className="text-sm text-slate-500">Chưa có gợi ý phù hợp.</p>
            ) : (
              <div className="space-y-2">
                {suggestions.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-2">
                    <Avatar src={user.avatar} name={user.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{user.displayName}</p>
                      <p className="truncate text-xs text-slate-500">{user.bio || user.username}</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg bg-[#2563EB] px-2.5 text-xs text-white"
                      onClick={() => sendRequestMutation.mutate(user.id)}
                    >
                      Kết bạn
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
