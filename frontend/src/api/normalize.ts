type Neo4jIntLike = { low?: number; high?: number; toNumber?: () => number }
type Neo4jDateLike = {
  year?: Neo4jIntLike | number
  month?: Neo4jIntLike | number
  day?: Neo4jIntLike | number
  hour?: Neo4jIntLike | number
  minute?: Neo4jIntLike | number
  second?: Neo4jIntLike | number
  nanosecond?: Neo4jIntLike | number
}

export interface FrontendUser {
  id: string
  userId?: string
  email: string
  username: string
  displayName: string
  interests?: string
  avatar?: string
  coverPhoto?: string
  location?: string
  school?: string
  major?: string
  cohort?: string
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'BLOCKED'
  profileVisibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  createdAt: string
  updatedAt?: string
  lastOnlineAt?: string
  rank?: number
  similarityScore?: number
  recommendationSource?: 'node2vec_file' | 'mutual_friends' | 'profile_rule_based'
  mutualCount?: number
}

function isCloudinaryImageUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/image/upload/')
  )
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const v = value as Neo4jIntLike
    if (typeof v.toNumber === 'function') return v.toNumber()
    if (typeof v.low === 'number') return v.low
  }
  return 0
}

export function toIsoString(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return new Date().toISOString()

  const dt = value as Neo4jDateLike
  const year = toNumber(dt.year)
  const month = toNumber(dt.month)
  const day = toNumber(dt.day)
  const hour = toNumber(dt.hour)
  const minute = toNumber(dt.minute)
  const second = toNumber(dt.second)
  const nanosecond = toNumber(dt.nanosecond)

  if (!year || !month || !day) return new Date().toISOString()

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, Math.floor(nanosecond / 1_000_000))).toISOString()
}

export function normalizeUser(raw: any): FrontendUser {
  const email = raw?.email ?? ''
  const avatar = raw?.avatarUrl ?? raw?.avatar
  const coverPhoto = raw?.coverUrl ?? raw?.coverPhoto
  // Sanitize userId: some Neo4j records may have spaces instead of hyphens in UUID
  const rawId = raw?.userId ?? raw?.id ?? ''
  const id = typeof rawId === 'string' ? rawId.trim().replace(/\s+/g, '-') : String(rawId)
  return {
    id,
    userId: id,
    email,
    username: raw?.username ?? (email.includes('@') ? email.split('@')[0] : ''),
    displayName: raw?.displayName ?? '',
    interests: raw?.interests ?? raw?.bio,
    avatar: isCloudinaryImageUrl(avatar) ? avatar : undefined,
    coverPhoto: isCloudinaryImageUrl(coverPhoto) ? coverPhoto : undefined,
    location: raw?.location,
    school: raw?.school,
    major: raw?.major,
    cohort: raw?.cohort,
    role: raw?.role ?? 'USER',
    status: raw?.status ?? 'ACTIVE',
    profileVisibility: raw?.profileVisibility,
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: raw?.updatedAt ? toIsoString(raw.updatedAt) : undefined,
    lastOnlineAt: raw?.lastOnlineAt ? toIsoString(raw.lastOnlineAt) : undefined,
    rank: raw?.rank !== undefined && raw?.rank !== null ? toNumber(raw.rank) : undefined,
    similarityScore: typeof raw?.similarityScore === 'number' ? raw.similarityScore : raw?.similarityScore ? Number(raw.similarityScore) : undefined,
    recommendationSource: raw?.recommendationSource,
    mutualCount: raw?.mutualCount !== undefined && raw?.mutualCount !== null ? toNumber(raw.mutualCount) : undefined,
  }
}
