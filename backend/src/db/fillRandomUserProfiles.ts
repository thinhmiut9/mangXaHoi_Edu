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

const cohorts = Array.from({ length: 16 }, (_, index) => `K${30 + index}`)

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
  { school: 'Đại học Công nghệ - ĐHQGHN', major: 'Khoa học dữ liệu' },
  { school: 'Học viện Công nghệ Bưu chính Viễn thông', major: 'Hệ thống thông tin' },
  { school: 'Đại học FPT', major: 'An toàn thông tin' },
  { school: 'Đại học Sư phạm Kỹ thuật Đà Nẵng', major: 'Kỹ thuật phần mềm' },
  { school: 'Đại học Kinh tế Quốc dân', major: 'Kinh tế' },
  { school: 'Đại học Kinh tế Quốc dân', major: 'Quản trị kinh doanh' },
  { school: 'Đại học Thương mại', major: 'Kinh doanh quốc tế' },
  { school: 'Đại học Lao động - Xã hội', major: 'Quản trị nhân lực' },
  { school: 'Học viện Ngân hàng', major: 'Tài chính ngân hàng' },
  { school: 'Đại học Kinh tế TP.HCM', major: 'Kế toán' },
  { school: 'Đại học Kinh tế - Luật', major: 'Kiểm toán' },
  { school: 'Đại học Tài chính - Marketing', major: 'Marketing' },
  { school: 'Đại học Văn Lang', major: 'Digital Marketing' },
  { school: 'Học viện Báo chí và Tuyên truyền', major: 'Truyền thông đa phương tiện' },
  { school: 'Đại học Khoa học Xã hội và Nhân văn - ĐHQGHN', major: 'Quan hệ công chúng' },
  { school: 'Đại học Y Hà Nội', major: 'Y khoa' },
  { school: 'Đại học Y Dược TP.HCM', major: 'Dược học' },
  { school: 'Đại học Điều dưỡng Nam Định', major: 'Điều dưỡng' },
  { school: 'Đại học Y tế Công cộng', major: 'Y tế công cộng' },
  { school: 'Đại học Luật Hà Nội', major: 'Luật kinh tế' },
  { school: 'Đại học Luật TP.HCM', major: 'Luật dân sự' },
  { school: 'Đại học Kinh tế - Luật', major: 'Luật thương mại' },
  { school: 'Đại học Sư phạm Hà Nội', major: 'Sư phạm' },
  { school: 'Đại học Sư phạm TP.HCM', major: 'Quản lý giáo dục' },
  { school: 'Đại học Quy Nhơn', major: 'Giáo dục tiểu học' },
  { school: 'Đại học Hà Nội', major: 'Ngôn ngữ Anh' },
  { school: 'Đại học Ngoại ngữ - ĐHQGHN', major: 'Ngôn ngữ Nhật' },
  { school: 'Đại học Ngoại ngữ - Đại học Đà Nẵng', major: 'Ngôn ngữ Hàn' },
  { school: 'Đại học Mở TP.HCM', major: 'Biên phiên dịch' },
  { school: 'Đại học Văn hóa Hà Nội', major: 'Quản trị du lịch' },
  { school: 'Đại học Kinh tế TP.HCM', major: 'Quản trị khách sạn' },
  { school: 'Đại học Duy Tân', major: 'Hướng dẫn du lịch' },
  { school: 'Đại học Xây dựng Hà Nội', major: 'Kỹ thuật xây dựng' },
  { school: 'Đại học Kiến trúc Hà Nội', major: 'Kiến trúc' },
  { school: 'Đại học Kiến trúc TP.HCM', major: 'Quản lý xây dựng' },
  { school: 'Học viện Nông nghiệp Việt Nam', major: 'Nông học' },
  { school: 'Đại học Cần Thơ', major: 'Công nghệ thực phẩm' },
  { school: 'Đại học Nông Lâm TP.HCM', major: 'Chăn nuôi' },
  { school: 'Đại học Nông Lâm Huế', major: 'Bảo vệ thực vật' },
  { school: 'Đại học Tài nguyên và Môi trường Hà Nội', major: 'Khoa học môi trường' },
  { school: 'Đại học Khoa học Tự nhiên - ĐHQG TP.HCM', major: 'Quản lý tài nguyên' },
  { school: 'Đại học Tài nguyên và Môi trường TP.HCM', major: 'Biến đổi khí hậu' },
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
      cohort: pickBySeed(cohorts, seed * 13 + 29),
    }
  })

  await runQuery(
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    SET u.location = row.location,
        u.school = row.school,
        u.major = row.major,
        u.cohort = row.cohort,
        u.updatedAt = $now
    RETURN count(u) AS updated
    `,
    { rows, now }
  )

  console.log(`Updated profile fields for ${rows.length} users.`)
  console.log('Sample rows:')
  for (const row of rows.slice(0, 10)) {
    console.log(`  ${row.userId} -> ${row.location} | ${row.school} | ${row.major} | ${row.cohort}`)
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
