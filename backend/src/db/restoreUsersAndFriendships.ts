import fs from 'fs'
import path from 'path'
import bcrypt from 'bcrypt'
import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

type CsvRow = Record<string, string>

interface UserImportRow {
  userId: string
  email: string
  displayName: string
  bio?: string
  avatarUrl?: string
  coverUrl?: string
  location?: string
  role: string
  status: string
  profileVisibility: string
  source?: string
  createdAt: string
  updatedAt: string
  lastOnlineAt?: string
}

interface FriendshipImportRow {
  startUserId: string
  endUserId: string
}

const USER_BATCH_SIZE = 250
const FRIENDSHIP_BATCH_SIZE = 1000
const DEFAULT_PASSWORD = process.env.RESTORE_DEFAULT_PASSWORD?.trim() || 'Restored@123'
const DEFAULT_FRIENDSHIP_SINCE = '2026-04-25T00:00:00.000Z'
const DEFAULT_SOURCE = 'facebook_combined'

function resolveDataDir(): string {
  const configuredDir = process.env.RESTORE_DATA_DIR?.trim()
  if (configuredDir) {
    return path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(process.cwd(), configuredDir)
  }

  return path.resolve(process.cwd(), '..', 'Data_Train_HeGoiY_Now')
}

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []

  const [headers, ...records] = rows
  return records
    .filter(record => record.some(value => value !== ''))
    .map((record) => {
      const obj: CsvRow = {}
      for (let i = 0; i < headers.length; i += 1) {
        obj[headers[i]] = record[i] ?? ''
      }
      return obj
    })
}

function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function loadUsers(dataDir: string): UserImportRow[] {
  const filePath = path.join(dataDir, 'user_now.csv')
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))

  return rows.map((row) => ({
    userId: row.userId.trim(),
    email: row.email.trim().toLowerCase(),
    displayName: row.displayName.trim(),
    bio: emptyToNull(row.bio) ?? undefined,
    avatarUrl: emptyToNull(row.avatarUrl) ?? undefined,
    coverUrl: emptyToNull(row.coverUrl) ?? undefined,
    location: emptyToNull(row.location) ?? undefined,
    role: row.role?.trim() || 'USER',
    status: row.status?.trim() || 'ACTIVE',
    profileVisibility: row.profileVisibility?.trim() || 'PUBLIC',
    source: emptyToNull(row.source) ?? undefined,
    createdAt: row.createdAt.trim(),
    updatedAt: row.updatedAt.trim(),
    lastOnlineAt: emptyToNull(row.lastOnlineAt) ?? undefined,
  }))
}

function loadFriendships(dataDir: string): FriendshipImportRow[] {
  const filePath = path.join(dataDir, 'facebook_friendships_full_export.csv')
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))

  return rows
    .map((row) => ({
      startUserId: row.startUserId.trim(),
      endUserId: row.endUserId.trim(),
    }))
    .filter(row => row.startUserId && row.endUserId)
}

async function ensureConstraints(): Promise<void> {
  await runQuery(`
    CREATE CONSTRAINT user_userId IF NOT EXISTS
    FOR (u:User) REQUIRE u.userId IS UNIQUE
  `)

  await runQuery(`
    CREATE CONSTRAINT user_email IF NOT EXISTS
    FOR (u:User) REQUIRE u.email IS UNIQUE
  `)
}

async function importUsers(users: UserImportRow[], defaultPasswordHash: string): Promise<void> {
  const batches = chunk(users, USER_BATCH_SIZE)

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    await runQuery(
      `
      UNWIND $rows AS row
      MERGE (u:User {userId: row.userId})
      ON CREATE SET
        u.passwordHash = $defaultPasswordHash,
        u.createdAt = row.createdAt
      SET
        u.email = row.email,
        u.displayName = row.displayName,
        u.bio = row.bio,
        u.avatarUrl = row.avatarUrl,
        u.coverUrl = row.coverUrl,
        u.location = row.location,
        u.role = row.role,
        u.status = row.status,
        u.profileVisibility = row.profileVisibility,
        u.source = row.source,
        u.updatedAt = row.updatedAt,
        u.lastOnlineAt = row.lastOnlineAt,
        u.passwordHash = coalesce(u.passwordHash, $defaultPasswordHash)
      `,
      { rows: batch, defaultPasswordHash }
    )

    console.log(`Imported users batch ${index + 1}/${batches.length}`)
  }
}

async function importFriendships(friendships: FriendshipImportRow[]): Promise<void> {
  const batches = chunk(friendships, FRIENDSHIP_BATCH_SIZE)

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    await runQuery(
      `
      UNWIND $rows AS row
      MATCH (a:User {userId: row.startUserId})
      MATCH (b:User {userId: row.endUserId})
      MERGE (a)-[r:FRIENDS_WITH]-(b)
      ON CREATE SET
        r.since = $since,
        r.source = $source
      `,
      { rows: batch, since: DEFAULT_FRIENDSHIP_SINCE, source: DEFAULT_SOURCE }
    )

    console.log(`Imported friendships batch ${index + 1}/${batches.length}`)
  }
}

async function summarize(): Promise<void> {
  const [users] = await runQuery<{ totalUsers: number }>(
    `MATCH (u:User) RETURN count(u) AS totalUsers`
  )
  const [friendships] = await runQuery<{ totalFriendships: number }>(
    `MATCH ()-[r:FRIENDS_WITH]->() RETURN count(r) AS totalFriendships`
  )

  console.log(`Total users in Neo4j: ${users?.totalUsers ?? 0}`)
  console.log(`Total FRIENDS_WITH in Neo4j: ${friendships?.totalFriendships ?? 0}`)
}

async function main(): Promise<void> {
  const dataDir = resolveDataDir()
  const users = loadUsers(dataDir)
  const friendships = loadFriendships(dataDir)

  console.log(`Restore data directory: ${dataDir}`)
  console.log(`Users to import: ${users.length}`)
  console.log(`Friendships to import: ${friendships.length}`)
  console.log(`Default password for restored users: ${DEFAULT_PASSWORD}`)

  await verifyConnectivity()

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  await ensureConstraints()
  await importUsers(users, defaultPasswordHash)
  await importFriendships(friendships)
  await summarize()
}

main()
  .then(async () => {
    await closeDriver()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Restore failed:', error)
    await closeDriver()
    process.exit(1)
  })
