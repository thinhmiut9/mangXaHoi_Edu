import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

type UserRow = {
  userId: string
  email: string
  displayName: string
  role?: string | null
}

type AcademicProfile = {
  school: string
  major: string
}

const locations = [
  'Ha Noi, Viet Nam',
  'Hai Phong, Viet Nam',
  'Quang Ninh, Viet Nam',
  'Hue, Viet Nam',
  'Da Nang, Viet Nam',
  'Quang Ngai, Viet Nam',
  'Quy Nhon, Viet Nam',
  'Nha Trang, Viet Nam',
  'Gia Lai, Viet Nam',
  'Dak Lak, Viet Nam',
  'Ho Chi Minh, Viet Nam',
  'Binh Duong, Viet Nam',
  'Dong Nai, Viet Nam',
  'Can Tho, Viet Nam',
  'An Giang, Viet Nam',
  'Vung Tau, Viet Nam',
]

const academicProfiles: AcademicProfile[] = [
  { school: 'Đại học Bách khoa Hà Nội', major: 'Công nghệ thông tin' },
  { school: 'Đại học Công nghệ - ĐHQGHN', major: 'Khoa học máy tính' },
  { school: 'Học viện Công nghệ Bưu chính Viễn thông', major: 'Hệ thống thông tin' },
  { school: 'Đại học FPT', major: 'Kỹ thuật phần mềm' },
  { school: 'Đại học Kinh tế Quốc dân', major: 'Thương mại điện tử' },
  { school: 'Đại học Sư phạm Kỹ thuật Đà Nẵng', major: 'Công nghệ thông tin' },
  { school: 'Đại học Bách khoa - Đại học Đà Nẵng', major: 'Khoa học dữ liệu' },
  { school: 'Đại học Quy Nhơn', major: 'Hệ thống thông tin' },
  { school: 'Đại học Nha Trang', major: 'Công nghệ phần mềm' },
  { school: 'Đại học Cần Thơ', major: 'Mạng máy tính và truyền thông dữ liệu' },
  { school: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM', major: 'Khoa học máy tính' },
  { school: 'Đại học Bách khoa TP.HCM', major: 'Kỹ thuật máy tính' },
  { school: 'Đại học Khoa học Tự nhiên - ĐHQG TP.HCM', major: 'Khoa học dữ liệu' },
  { school: 'Đại học Ngân hàng TP.HCM', major: 'Hệ thống thông tin quản lý' },
  { school: 'Đại học Sài Gòn', major: 'Công nghệ thông tin' },
]

function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function pickBySeed<T>(items: T[], seed: number): T {
  return items[seed % items.length]
}

async function fillRandomUserProfiles(): Promise<void> {
  await verifyConnectivity()

  const users = await runQuery<UserRow>(
    `
    MATCH (u:User)
    WHERE coalesce(u.role, 'USER') = 'USER'
    RETURN u.userId AS userId,
           u.email AS email,
           u.displayName AS displayName,
           u.role AS role
    ORDER BY u.createdAt ASC, u.userId ASC
    `
  )

  if (users.length === 0) {
    console.log('No USER accounts found.')
    return
  }

  const now = new Date().toISOString()
  const rows = users.map((user) => {
    const seed = hashString(user.userId || user.email || user.displayName)
    const location = pickBySeed(locations, seed)
    const academicProfile = pickBySeed(academicProfiles, seed * 7 + 11)

    return {
      userId: user.userId,
      location,
      school: academicProfile.school,
      major: academicProfile.major,
    }
  })

  await runQuery(
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    SET u.location = row.location,
        u.school = row.school,
        u.major = row.major,
        u.updatedAt = $now
    RETURN count(u) AS updated
    `,
    { rows, now }
  )

  console.log(`Updated profile fields for ${rows.length} users.`)
  console.log('Sample rows:')
  for (const row of rows.slice(0, 10)) {
    console.log(`  ${row.userId} -> ${row.location} | ${row.school} | ${row.major}`)
  }
}

fillRandomUserProfiles()
  .catch(err => {
    console.error('Failed to fill random user profiles:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDriver()
  })
