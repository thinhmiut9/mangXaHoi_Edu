/**
 * Replace placeholder users named "User <number>" with random Vietnamese names.
 * Run: npm run db:randomize-placeholder-users
 */
import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

type PlaceholderUserRow = {
  userId: string
  displayName: string
  originalNumber: string
  interests?: string | null
}

const firstNames = [
  'An',
  'Anh',
  'Bao',
  'Binh',
  'Chi',
  'Dat',
  'Duc',
  'Dung',
  'Giang',
  'Ha',
  'Hai',
  'Hanh',
  'Hieu',
  'Hoang',
  'Hung',
  'Khanh',
  'Lan',
  'Linh',
  'Long',
  'Mai',
  'Minh',
  'Nam',
  'Nga',
  'Ngoc',
  'Nhi',
  'Phuc',
  'Phuong',
  'Quang',
  'Tam',
  'Thao',
  'Trang',
  'Trung',
  'Tuan',
  'Vy',
]

const lastNames = [
  'Nguyen',
  'Tran',
  'Le',
  'Pham',
  'Hoang',
  'Huynh',
  'Phan',
  'Vu',
  'Vo',
  'Dang',
  'Bui',
  'Do',
  'Ho',
  'Ngo',
  'Duong',
  'Ly',
]

const middleNames = [
  'Van',
  'Thi',
  'Minh',
  'Gia',
  'Thanh',
  'Quoc',
  'Ngoc',
  'Hoai',
  'Duy',
  'Tuan',
  'Thien',
  'Bao',
]

const interestsPool = [
  'Sinh vien yeu thich hoc tap va chia se tai lieu',
  'Dang hoc CNTT va quan tam den cong nghe moi',
  'Thich ket noi voi ban be cung truong',
  'Hay tham gia cac nhom hoc tap truc tuyen',
  'Quan tam den lap trinh, du lieu va AI',
  'Muon tim ban hoc cung mon va trao doi kinh nghiem',
  'Yeu thich doc sach, nghe nhac va hoc ngoai ngu',
  'Dang xay dung thoi quen hoc moi ngay',
]

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function buildNamePool(count: number): string[] {
  const names: string[] = []

  for (const lastName of lastNames) {
    for (const middleName of middleNames) {
      for (const firstName of firstNames) {
        names.push(`${lastName} ${middleName} ${firstName}`)
      }
    }
  }

  return shuffle(names).slice(0, count)
}

async function randomizePlaceholderUsers(): Promise<void> {
  await verifyConnectivity()

  const users = await runQuery<PlaceholderUserRow>(
    `MATCH (u:User)
     WHERE coalesce(u.displayName, '') =~ '^User [0-9]+$'
        OR coalesce(u.username, '') =~ '^[a-z]+_[a-z]+_[a-z]+_[0-9]+$'
     WITH u,
          CASE
            WHEN coalesce(u.displayName, '') =~ '^User [0-9]+$' THEN replace(u.displayName, 'User ', '')
            ELSE last(split(u.username, '_'))
          END AS originalNumber
     RETURN u.userId AS userId,
            u.displayName AS displayName,
            originalNumber,
            coalesce(u.interests, u.bio) AS interests
     ORDER BY toInteger(originalNumber) ASC`
  )

  if (users.length === 0) {
    console.log('No placeholder users found.')
    return
  }

  const names = buildNamePool(users.length)
  const now = new Date().toISOString()
  const rows = users.map((user, index) => {
    const isPlaceholderInterests = !user.interests || /^Day la user so [0-9]+$/i.test(user.interests.trim())

    return {
      userId: user.userId,
      displayName: names[index],
      interests: isPlaceholderInterests ? interestsPool[index % interestsPool.length] : user.interests,
      username: `${names[index].toLowerCase().replace(/\s+/g, '_')}_${user.originalNumber}`,
    }
  })

  await runQuery(
    `UNWIND $rows AS row
     MATCH (u:User {userId: row.userId})
     SET u.displayName = row.displayName,
         u.username = row.username,
         u.interests = row.interests,
         u.updatedAt = $now
     RETURN count(u) AS updated`,
    { rows, now }
  )

  console.log(`Updated ${rows.length} placeholder users:`)
  for (const row of rows) {
    console.log(`  ${row.userId}: ${row.displayName}`)
  }
}

randomizePlaceholderUsers()
  .catch(err => {
    console.error('Failed to randomize placeholder users:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDriver()
  })
