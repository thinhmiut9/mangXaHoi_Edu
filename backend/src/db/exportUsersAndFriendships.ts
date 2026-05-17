import fs from 'fs'
import path from 'path'
import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

interface UserExportRow {
  userId: string
  email: string
  displayName: string
  interests?: string | null
  avatarUrl?: string | null
  coverUrl?: string | null
  location?: string | null
  school?: string | null
  major?: string | null
  cohort?: string | null
  role?: string | null
  status?: string | null
  profileVisibility?: string | null
  source?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lastOnlineAt?: string | null
}

interface FriendshipExportRow {
  startUserId: string
  endUserId: string
}

function resolveDataDir(): string {
  const configuredDir = process.env.EXPORT_DATA_DIR?.trim()
  if (configuredDir) {
    return path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(process.cwd(), configuredDir)
  }

  return path.resolve(process.cwd(), '..', 'Data_Train_HeGoiY_Now')
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function writeCsv<T extends object>(filePath: string, headers: string[], rows: T[]) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape((row as Record<string, unknown>)[header])).join(',')),
  ]

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

async function exportUsers(dataDir: string) {
  const users = await runQuery<UserExportRow>(
    `
    MATCH (u:User)
    RETURN
      u.userId AS userId,
      u.email AS email,
      u.displayName AS displayName,
      coalesce(u.interests, u.bio) AS interests,
      u.avatarUrl AS avatarUrl,
      u.coverUrl AS coverUrl,
      u.location AS location,
      u.school AS school,
      u.major AS major,
      u.cohort AS cohort,
      u.role AS role,
      u.status AS status,
      u.profileVisibility AS profileVisibility,
      u.source AS source,
      u.createdAt AS createdAt,
      u.updatedAt AS updatedAt,
      u.lastOnlineAt AS lastOnlineAt
    ORDER BY u.createdAt ASC, u.userId ASC
    `
  )

  const headers = [
    'userId',
    'email',
    'displayName',
    'interests',
    'avatarUrl',
    'coverUrl',
    'location',
    'school',
    'major',
    'cohort',
    'role',
    'status',
    'profileVisibility',
    'source',
    'createdAt',
    'updatedAt',
    'lastOnlineAt',
  ]

  const filePath = path.join(dataDir, 'user_now.csv')
  writeCsv(filePath, headers, users)
  console.log(`Exported users: ${users.length} -> ${filePath}`)
}

async function exportFriendships(dataDir: string) {
  const friendships = await runQuery<FriendshipExportRow>(
    `
    MATCH (a:User)-[:FRIENDS_WITH]-(b:User)
    WHERE a.userId < b.userId
    RETURN a.userId AS startUserId, b.userId AS endUserId
    ORDER BY startUserId ASC, endUserId ASC
    `
  )

  const headers = ['startUserId', 'endUserId']
  const filePath = path.join(dataDir, 'facebook_friendships_full_export.csv')
  writeCsv(filePath, headers, friendships)
  console.log(`Exported friendships: ${friendships.length} -> ${filePath}`)
}

async function main() {
  const dataDir = resolveDataDir()
  ensureDir(dataDir)

  console.log(`Export data directory: ${dataDir}`)
  await verifyConnectivity()
  await exportUsers(dataDir)
  await exportFriendships(dataDir)
}

main()
  .then(async () => {
    await closeDriver()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Export failed:', error)
    await closeDriver()
    process.exit(1)
  })
