const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const baseDir = __dirname
const edgeInputPath = path.join(baseDir, 'facebook_combined.txt')
const usersOutputPath = path.join(baseDir, 'facebook_users_import.csv')
const friendshipsOutputPath = path.join(baseDir, 'facebook_friendships_import.csv')
const cypherOutputPath = path.join(baseDir, 'import_facebook_combined.cypher')

const SOURCE = 'facebook_combined'
const BRIDGE_USER_ID = '2901fc71-a8a0-4634-a6af-6a0d980430d7'
const BRIDGE_EXTERNAL_IDS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
]
const now = '2026-04-25T00:00:00.000Z'
const passwordHash = 'imported_dataset_no_login'

const lastNames = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
  'Mai',
  'Đinh',
  'Trương',
  'Phan',
  'Tạ',
]

const middleNames = [
  'Văn',
  'Thị',
  'Minh',
  'Hoài',
  'Gia',
  'Quang',
  'Thanh',
  'Ngọc',
  'Tuấn',
  'Hữu',
  'Khánh',
  'Anh',
  'Bảo',
  'Đức',
  'Nhật',
  'Phúc',
]

const givenNames = [
  'An',
  'Bình',
  'Châu',
  'Dũng',
  'Duy',
  'Giang',
  'Hà',
  'Hải',
  'Hiếu',
  'Huy',
  'Hương',
  'Khang',
  'Linh',
  'Long',
  'Mai',
  'Nam',
  'Nhi',
  'Phương',
  'Quân',
  'Sơn',
  'Thảo',
  'Thịnh',
  'Trang',
  'Trí',
  'Tú',
  'Vy',
]

const bioTemplates = [
  'Yêu thích kết nối, chia sẻ trải nghiệm và khám phá những mối quan hệ mới.',
  'Quan tâm đến công nghệ, học hỏi mỗi ngày và xây dựng cộng đồng tích cực.',
  'Thích trò chuyện, làm việc nhóm và lan tỏa những điều hữu ích đến mọi người.',
  'Ưu tiên các mối quan hệ chân thành, giao tiếp rõ ràng và hỗ trợ lẫn nhau.',
  'Thường xuyên tìm kiếm ý tưởng mới, kết nối mới và cơ hội hợp tác phù hợp.',
  'Quan tâm đến bạn bè, cộng đồng và những hoạt động mang lại giá trị thực tế.',
  'Yêu thích môi trường cởi mở, nơi mọi người có thể chia sẻ và phát triển cùng nhau.',
  'Thích kết bạn, mở rộng mạng lưới quan hệ và học thêm từ những góc nhìn khác nhau.',
]

const locations = [
  'Ha Noi, Viet Nam',
  'Ho Chi Minh City, Viet Nam',
  'Da Nang, Viet Nam',
  'Can Tho, Viet Nam',
  'Hai Phong, Viet Nam',
  'Hue, Viet Nam',
  'Nha Trang, Viet Nam',
  'Da Lat, Viet Nam',
  'Vung Tau, Viet Nam',
  'Quy Nhon, Viet Nam',
  'Bien Hoa, Viet Nam',
  'Thu Duc, Ho Chi Minh City',
]

function csv(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function deterministicUuid(input) {
  const hash = crypto
    .createHash('sha1')
    .update(`${SOURCE}:${input}`)
    .digest()

  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80

  const hex = hash.subarray(0, 16).toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function vietnameseDisplayName(nodeId) {
  const n = Number(nodeId)
  const lastName = lastNames[n % lastNames.length]
  const middleName = middleNames[Math.floor(n / lastNames.length) % middleNames.length]
  const givenName = givenNames[Math.floor(n / (lastNames.length * middleNames.length)) % givenNames.length]

  return `${lastName} ${middleName} ${givenName}`
}

function userBio(nodeId) {
  const n = Number(nodeId)
  return bioTemplates[n % bioTemplates.length]
}

function userLocation(nodeId) {
  const n = Number(nodeId)
  return locations[n % locations.length]
}

const raw = fs.readFileSync(edgeInputPath, 'utf8')
const nodes = new Set()
const edges = []
const seenEdges = new Set()

function addEdge(startUserId, endUserId) {
  if (!startUserId || !endUserId || startUserId === endUserId) return

  const key = startUserId < endUserId
    ? `${startUserId}|${endUserId}`
    : `${endUserId}|${startUserId}`

  if (!seenEdges.has(key)) {
    seenEdges.add(key)
    edges.push([startUserId, endUserId])
  }
}

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed) continue

  const [left, right] = trimmed.split(/\s+/)
  if (!left || !right || left === right) continue

  nodes.add(left)
  nodes.add(right)
  addEdge(deterministicUuid(left), deterministicUuid(right))
}

for (const externalId of BRIDGE_EXTERNAL_IDS) {
  if (nodes.has(externalId)) {
    addEdge(BRIDGE_USER_ID, deterministicUuid(externalId))
  }
}

const sortedNodes = [...nodes].sort((a, b) => Number(a) - Number(b))

const userHeader = [
  'userId',
  'externalId',
  'email',
  'displayName',
  'passwordHash',
  'bio',
  'avatarUrl',
  'coverUrl',
  'location',
  'role',
  'status',
  'profileVisibility',
  'source',
  'createdAt',
  'updatedAt',
  'lastOnlineAt',
]

const userRows = sortedNodes.map((nodeId) => {
  const userId = deterministicUuid(nodeId)
  return [
    userId,
    nodeId,
    `fb_${nodeId}@facebook-combined.local`,
    vietnameseDisplayName(nodeId),
    passwordHash,
    userBio(nodeId),
    '',
    '',
    userLocation(nodeId),
    'USER',
    'ACTIVE',
    'PUBLIC',
    SOURCE,
    now,
    now,
    now,
  ].map(csv).join(',')
})

const friendshipHeader = ['startUserId', 'endUserId']
const friendshipRows = edges.map(([startUserId, endUserId]) => (
  [startUserId, endUserId].map(csv).join(',')
))

const cypher = `// Import SNAP ego-Facebook dataset users and friendships.
// Put these files into Neo4j import directory, then run this file:
// - facebook_users_import.csv
// - facebook_friendships_import.csv
//
// facebook_friendships_import.csv follows the same edge-list form as your Neo4j export:
// startUserId,endUserId

CREATE CONSTRAINT user_userId IF NOT EXISTS
FOR (u:User) REQUIRE u.userId IS UNIQUE;

CREATE CONSTRAINT user_email IF NOT EXISTS
FOR (u:User) REQUIRE u.email IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///facebook_users_import.csv' AS row
MERGE (u:User {userId: row.userId})
SET u.externalId = row.externalId,
    u.email = row.email,
    u.displayName = row.displayName,
    u.passwordHash = row.passwordHash,
    u.bio = row.bio,
    u.avatarUrl = nullif(row.avatarUrl, ''),
    u.coverUrl = nullif(row.coverUrl, ''),
    u.location = row.location,
    u.role = row.role,
    u.status = row.status,
    u.profileVisibility = row.profileVisibility,
    u.source = row.source,
    u.createdAt = row.createdAt,
    u.updatedAt = row.updatedAt,
    u.lastOnlineAt = row.lastOnlineAt;

LOAD CSV WITH HEADERS FROM 'file:///facebook_friendships_import.csv' AS row
MATCH (a:User {userId: row.startUserId})
MATCH (b:User {userId: row.endUserId})
MERGE (a)-[r:FRIENDS_WITH]-(b)
SET r.since = coalesce(r.since, '${now}'),
    r.source = coalesce(r.source, '${SOURCE}');
`

fs.writeFileSync(usersOutputPath, `${userHeader.join(',')}\n${userRows.join('\n')}\n`, 'utf8')
fs.writeFileSync(friendshipsOutputPath, `${friendshipHeader.join(',')}\n${friendshipRows.join('\n')}\n`, 'utf8')
fs.writeFileSync(cypherOutputPath, cypher, 'utf8')

console.log(`Generated users: ${sortedNodes.length}`)
console.log(`Generated original friendships: ${seenEdges.size - BRIDGE_EXTERNAL_IDS.length}`)
console.log(`Generated bridge friendships for ${BRIDGE_USER_ID}: ${BRIDGE_EXTERNAL_IDS.length}`)
console.log(`Generated total friendships: ${edges.length}`)
console.log(`Wrote: ${path.basename(usersOutputPath)}`)
console.log(`Wrote: ${path.basename(friendshipsOutputPath)}`)
console.log(`Wrote: ${path.basename(cypherOutputPath)}`)
