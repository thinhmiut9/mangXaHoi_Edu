import { v4 as uuidv4 } from 'uuid'
import { closeDriver, runQuery, runQueryOne, verifyConnectivity } from '../config/neo4j'

type ScopeUser = {
  userId: string
  email: string
  displayName: string
}

type GroupSeed = {
  groupId: string
  name: string
  description: string
  coverUrl: string
  privacy: 'PUBLIC' | 'PRIVATE'
  ownerId: string
  createdAt: string
  updatedAt: string
  memberIds: string[]
  requestIds: string[]
}

type PostSeed = {
  postId: string
  authorId: string
  content: string
  visibility: 'PUBLIC' | 'FRIENDS' | 'GROUP'
  groupId: string | null
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
}

type SharedPostSeed = {
  postId: string
  authorId: string
  originalPostId: string
  content: string
  visibility: 'PUBLIC' | 'FRIENDS'
  createdAt: string
  updatedAt: string
}

type CommentSeed = {
  commentId: string
  authorId: string
  postId: string
  parentId: string | null
  content: string
  createdAt: string
  updatedAt: string
}

type StorySeed = {
  storyId: string
  userId: string
  type: 'IMAGE' | 'VIDEO'
  mediaUrl: string
  content: string
  createdAt: string
  expiresAt: string
}

type DocumentSeed = {
  documentId: string
  uploaderId: string
  title: string
  fileName: string
  fileUrl: string
  previewUrl: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  subject: string
  school: string
  major: string
  cohort: string
  description: string
  tags: string[]
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  status: 'ACTIVE'
  viewsCount: number
  downloadsCount: number
  createdAt: string
  updatedAt: string
}

type PostDocumentSeed = {
  documentId: string
  uploaderId: string
  postId: string
  title: string
  fileName: string
  fileUrl: string
  previewUrl: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  description: string
  createdAt: string
  updatedAt: string
}

type ConversationSeed = {
  conversationId: string
  type: 'DIRECT' | 'GROUP'
  name: string | null
  creatorId: string | null
  avatarUrl: string | null
  directKey: string | null
  requestStatus: 'ACCEPTED' | 'PENDING'
  requesterId: string | null
  participantIds: string[]
  createdAt: string
  updatedAt: string
  lastMessageAt: string
}

type MessageSeed = {
  messageId: string
  conversationId: string
  senderId: string
  content: string
  type: 'TEXT'
  createdAt: string
}

type NotificationSeed = {
  notificationId: string
  recipientId: string
  senderId: string
  type: 'FRIEND_REQUEST' | 'POST_REACT' | 'POST_COMMENT' | 'MESSAGE' | 'NEW_POST' | 'GROUP_REQUEST' | 'FRIEND_ACCEPTED' | 'GROUP_INVITE' | 'ADMIN_ACTION' | 'MENTION'
  content: string
  entityId: string | null
  entityType: string | null
  isRead: boolean
  createdAt: string
}

type ReportSeed = {
  reportId: string
  reporterId: string
  targetId: string
  targetType: 'POST' | 'COMMENT' | 'USER' | 'GROUP'
  reason: string
  description: string
  status: 'OPEN'
  createdAt: string
}

type UserEdgeSeed = {
  fromUserId: string
  toUserId: string
  createdAt: string
}

type ContentDoc = {
  title: string
  fileName: string
  fileUrl: string
  previewUrl: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  subject: string
  school: string
  major: string
  cohort: string
  description: string
  tags: string[]
}

const TARGET_EMAIL = process.env.NEIGHBORHOOD_TARGET_EMAIL?.trim().toLowerCase() || 'nguyenduythinh1112@gmail.com'
const SEED_TAG = `neighborhood:${TARGET_EMAIL}`
const IMAGE_BASE = 'https://picsum.photos/seed'
const STORY_IMAGE_BASE = 'https://picsum.photos/seed/story'
const PDF_URLS = [
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'https://gahp.net/wp-content/uploads/2017/09/sample.pdf',
]
const DOC_URLS = [
  'https://calibre-ebook.com/downloads/demos/demo.docx',
]
const PPT_URLS = [
  'https://filesamples.com/samples/document/ppt/sample1.ppt',
]

const postTemplates = [
  'Hôm nay mình vừa hoàn thành một phần việc khá ổn, tranh thủ chia sẻ chút năng lượng tích cực với mọi người.',
  'Ai có tài liệu hoặc kinh nghiệm về chủ đề này thì để lại cho mình tham khảo với nhé.',
  'Một buổi tối ngồi tổng hợp lại kiến thức, thấy học theo nhóm đúng là hiệu quả hơn nhiều.',
  'Mình đang thử sắp xếp lại lịch học và công việc để đỡ bị cuốn theo deadline.',
  'Chia sẻ nhẹ một góc nhỏ trong ngày, hy vọng ai đó cũng đang tiến bộ từng chút như mình.',
  'Mình vừa cập nhật lại vài ghi chú quan trọng, lát nữa sẽ gửi vào nhóm cho mọi người.',
]

const commentTemplates = [
  'Bài này hay đấy, cảm ơn bạn đã chia sẻ.',
  'Mình cũng đang quan tâm phần này, đọc thấy khá hữu ích.',
  'Có đoạn nào bạn tổng hợp thêm thì tag mình với nhé.',
  'Quan điểm này hợp lý, nhất là khi làm việc nhóm.',
  'Mình lưu lại trước, tối đọc kỹ hơn.',
  'Nhìn gọn gàng và dễ theo dõi thật.',
]

const messageTemplates = [
  'Tối nay rảnh không, mình hỏi chút về bài hôm trước nhé.',
  'Mình vừa xem lại phần này, thấy có vài ý khá ổn.',
  'Có gì mai gặp mình trao đổi nhanh nhé.',
  'Nhóm mình đang chốt lịch, bạn xem giúp mình với.',
  'Mình gửi file rồi, bạn mở xem được không?',
  'Cảm ơn bạn, phần góp ý vừa rồi hữu ích thật.',
]

const storyCaptions = [
  'Một khoảnh khắc trong ngày.',
  'Checklist hôm nay gần xong rồi.',
  'Đang tập trung xử lý nốt phần việc cuối.',
  'Một chút update nhẹ với bạn bè.',
]

const reportReasons = [
  'Nội dung gây hiểu nhầm',
  'Bài đăng chưa phù hợp',
  'Bình luận dễ gây tranh cãi',
]

function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function sample<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]
}

function takeRandom<T>(rng: () => number, items: T[], count: number, exclude = new Set<T>()): T[] {
  const pool = items.filter(item => !exclude.has(item))
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}

function chance(rng: () => number, value: number): boolean {
  return rng() < value
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function isoPastDate(rng: () => number, daysBack: number, hourSpread = 20): string {
  const now = Date.now()
  const pastMs = randomInt(rng, 1, daysBack * 24 * 60) * 60 * 1000
  const jitter = randomInt(rng, 0, hourSpread * 60) * 60 * 1000
  const candidate = now - pastMs + jitter
  const safeTimestamp = Math.min(candidate, now - 60 * 1000)
  return new Date(safeTimestamp).toISOString()
}

function plusHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString()
}

function directKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

function makeImageUrl(seed: string, width = 1200, height = 800): string {
  return `${IMAGE_BASE}/${encodeURIComponent(seed)}/${width}/${height}`
}

function makeStoryUrl(seed: string): string {
  return `${STORY_IMAGE_BASE}/${encodeURIComponent(seed)}/1080/1920`
}

function pickDocumentAsset(rng: () => number): ContentDoc {
  const fileType = sample(rng, ['PDF', 'DOC', 'PPT'] as const)
  const fileUrl =
    fileType === 'PDF' ? sample(rng, PDF_URLS)
      : fileType === 'DOC' ? sample(rng, DOC_URLS)
        : sample(rng, PPT_URLS)

  const suffix = randomInt(rng, 1, 999)
  const title = sample(rng, [
    'Tổng hợp ghi chú môn học',
    'Slide thảo luận nhóm',
    'Tài liệu tham khảo nhanh',
    'Bộ đề và đáp án mẫu',
  ])

  return {
    title: `${title} ${suffix}`,
    fileName: `${title.replace(/\s+/g, '_').toLowerCase()}_${suffix}.${fileType.toLowerCase()}`,
    fileUrl,
    previewUrl: fileUrl,
    fileType,
    subject: sample(rng, ['Cơ sở dữ liệu', 'Kỹ thuật phần mềm', 'Mạng máy tính', 'Trí tuệ nhân tạo']),
    school: sample(rng, ['Đại học Quy Nhơn', 'Đại học Bách khoa', 'Đại học CNTT']),
    major: sample(rng, ['Công nghệ thông tin', 'Khoa học dữ liệu', 'Hệ thống thông tin']),
    cohort: sample(rng, ['K42', 'K43', 'K44', 'K45']),
    description: 'Tài liệu được chuẩn bị để ôn tập và trao đổi trong nhóm bạn bè.',
    tags: ['hoc-tap', 'tong-hop', 'tham-khao'],
  }
}

async function getScopeUsers(email: string): Promise<{ target: ScopeUser; friends: ScopeUser[] }> {
  const rows = await runQuery<{ user: ScopeUser; isTarget: boolean }>(
    `
    MATCH (target:User {email: $email})
    WITH target
    MATCH (u:User)
    WHERE u.userId = target.userId OR EXISTS { MATCH (target)-[:FRIENDS_WITH]-(u) }
    RETURN u { .userId, .email, .displayName } AS user, u.userId = target.userId AS isTarget
    ORDER BY isTarget DESC, u.displayName ASC
    `,
    { email }
  )

  const targetRow = rows.find(row => row.isTarget)
  if (!targetRow) {
    throw new Error(`Target user not found for email ${email}`)
  }

  return {
    target: targetRow.user,
    friends: rows.filter(row => !row.isTarget).map(row => row.user),
  }
}

async function getExistingFriendPairs(scopeIds: string[]): Promise<Set<string>> {
  const rows = await runQuery<{ a: string; b: string }>(
    `
    MATCH (a:User)-[:FRIENDS_WITH]-(b:User)
    WHERE a.userId IN $scopeIds AND b.userId IN $scopeIds
    RETURN a.userId AS a, b.userId AS b
    `,
    { scopeIds }
  )

  const pairs = new Set<string>()
  for (const row of rows) {
    pairs.add(directKey(row.a, row.b))
  }
  return pairs
}

async function getExistingDirectConversationKeys(scopeIds: string[]): Promise<Set<string>> {
  const rows = await runQuery<{ directKey: string }>(
    `
    MATCH (c:Conversation {type: 'DIRECT'})
    WHERE c.directKey IS NOT NULL
    OPTIONAL MATCH (c)-[:PARTICIPATES_IN]-(u:User)
    WITH c, collect(u.userId) AS participantIds
    WHERE any(id IN participantIds WHERE id IN $scopeIds)
    RETURN c.directKey AS directKey
    `,
    { scopeIds }
  )

  return new Set(rows.map(row => row.directKey).filter(Boolean))
}

async function cleanupSeed(seedTag: string): Promise<void> {
  await runQuery(`MATCH ()-[r]->() WHERE r.seedTag = $seedTag DELETE r`, { seedTag })
  await runQuery(`MATCH (n) WHERE n.seedTag = $seedTag DETACH DELETE n`, { seedTag })
}

async function cleanupDuplicateSeededDirectConversations(seedTag: string): Promise<void> {
  await runQuery(
    `
    MATCH (seeded:Conversation {type: 'DIRECT', seedTag: $seedTag})
    WHERE seeded.directKey IS NOT NULL
    MATCH (existing:Conversation {type: 'DIRECT', directKey: seeded.directKey})
    WHERE existing.conversationId <> seeded.conversationId
    WITH DISTINCT seeded
    DETACH DELETE seeded
    `,
    { seedTag }
  )
}

async function clearHiddenDirectConversationsForScope(targetUserId: string, scopeIds: string[]): Promise<void> {
  await runQuery(
    `
    MATCH (u:User {userId: $targetUserId})-[hidden:HIDDEN_CONVERSATION]->(c:Conversation {type: 'DIRECT'})
    OPTIONAL MATCH (c)-[:PARTICIPATES_IN]-(participant:User)
    WITH hidden, collect(participant.userId) AS participantIds
    WHERE any(id IN participantIds WHERE id IN $scopeIds)
    DELETE hidden
    `,
    { targetUserId, scopeIds }
  )
}

async function createGroups(seedTag: string, groups: GroupSeed[]): Promise<void> {
  if (!groups.length) return

  await runQuery(
    `
    UNWIND $groups AS g
    MATCH (owner:User {userId: g.ownerId})
    CREATE (grp:Group {
      groupId: g.groupId,
      name: g.name,
      description: g.description,
      coverUrl: g.coverUrl,
      ownerId: g.ownerId,
      privacy: g.privacy,
      status: 'ACTIVE',
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      seedTag: $seedTag
    })
    CREATE (owner)-[:OWNER_OF {seedTag: $seedTag}]->(grp)
    CREATE (owner)-[:MEMBER_OF {role: 'OWNER', joinedAt: g.createdAt, seedTag: $seedTag}]->(grp)
    WITH grp, g
    UNWIND g.memberIds AS memberId
    MATCH (member:User {userId: memberId})
    WHERE member.userId <> g.ownerId
    CREATE (member)-[:MEMBER_OF {role: 'MEMBER', joinedAt: g.createdAt, seedTag: $seedTag}]->(grp)
    `,
    { groups, seedTag }
  )

  await runQuery(
    `
    UNWIND $groups AS g
    MATCH (grp:Group {groupId: g.groupId, seedTag: $seedTag})
    UNWIND g.requestIds AS requesterId
    MATCH (requester:User {userId: requesterId})
    CREATE (requester)-[:JOIN_REQUESTED {requestedAt: g.updatedAt, seedTag: $seedTag}]->(grp)
    `,
    { groups, seedTag }
  )
}

async function createPosts(seedTag: string, posts: PostSeed[]): Promise<void> {
  if (!posts.length) return
  await runQuery(
    `
    UNWIND $posts AS p
    MATCH (author:User {userId: p.authorId})
    CREATE (post:Post {
      postId: p.postId,
      content: p.content,
      mediaUrls: p.mediaUrls,
      visibility: p.visibility,
      groupId: p.groupId,
      isPinned: false,
      pinnedAt: null,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      seedTag: $seedTag
    })
    CREATE (author)-[:CREATED {createdAt: p.createdAt, seedTag: $seedTag}]->(post)
    `,
    { posts, seedTag }
  )
}

async function createSharedPosts(seedTag: string, posts: SharedPostSeed[]): Promise<void> {
  if (!posts.length) return
  await runQuery(
    `
    UNWIND $posts AS p
    MATCH (author:User {userId: p.authorId})
    MATCH (original:Post {postId: p.originalPostId})
    CREATE (sharedPost:Post {
      postId: p.postId,
      content: p.content,
      mediaUrls: [],
      visibility: p.visibility,
      groupId: null,
      isPinned: false,
      pinnedAt: null,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      seedTag: $seedTag
    })
    CREATE (author)-[:CREATED {createdAt: p.createdAt, seedTag: $seedTag}]->(sharedPost)
    CREATE (author)-[:SHARED {createdAt: p.createdAt, seedTag: $seedTag}]->(original)
    `,
    { posts, seedTag }
  )
}

async function createComments(seedTag: string, comments: CommentSeed[]): Promise<void> {
  if (!comments.length) return
  await runQuery(
    `
    UNWIND $comments AS c
    MATCH (author:User {userId: c.authorId})
    MATCH (post:Post {postId: c.postId})
    CREATE (comment:Comment {
      commentId: c.commentId,
      content: c.content,
      parentId: c.parentId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      seedTag: $seedTag
    })
    CREATE (author)-[:WROTE {createdAt: c.createdAt, seedTag: $seedTag}]->(comment)
    CREATE (post)-[:HAS_COMMENT {seedTag: $seedTag}]->(comment)
    `,
    { comments, seedTag }
  )
}

async function createPostDocuments(seedTag: string, documents: PostDocumentSeed[]): Promise<void> {
  if (!documents.length) return
  await runQuery(
    `
    UNWIND $documents AS d
    MATCH (uploader:User {userId: d.uploaderId})
    MATCH (post:Post {postId: d.postId})
    CREATE (doc:Document {
      documentId: d.documentId,
      title: d.title,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      previewUrl: d.previewUrl,
      fileType: d.fileType,
      subject: 'Tài liệu kèm bài viết',
      school: '',
      major: '',
      cohort: '',
      description: d.description,
      tags: ['post', 'tai-lieu'],
      visibility: 'FRIENDS',
      status: 'ACTIVE',
      viewsCount: 0,
      downloadsCount: 0,
      uploaderId: d.uploaderId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      reviewedBy: null,
      reviewedAt: null,
      moderationNote: null,
      seedTag: $seedTag
    })
    CREATE (uploader)-[:UPLOADED_DOCUMENT {seedTag: $seedTag}]->(doc)
    CREATE (post)-[:HAS_DOCUMENT {seedTag: $seedTag}]->(doc)
    `,
    { documents, seedTag }
  )
}

async function createStandaloneDocuments(seedTag: string, documents: DocumentSeed[]): Promise<void> {
  if (!documents.length) return
  await runQuery(
    `
    UNWIND $documents AS d
    MATCH (uploader:User {userId: d.uploaderId})
    CREATE (doc:Document {
      documentId: d.documentId,
      title: d.title,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      previewUrl: d.previewUrl,
      fileType: d.fileType,
      subject: d.subject,
      school: d.school,
      major: d.major,
      cohort: d.cohort,
      description: d.description,
      tags: d.tags,
      visibility: d.visibility,
      status: d.status,
      viewsCount: d.viewsCount,
      downloadsCount: d.downloadsCount,
      uploaderId: d.uploaderId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      reviewedBy: null,
      reviewedAt: null,
      moderationNote: null,
      seedTag: $seedTag
    })
    CREATE (uploader)-[:UPLOADED_DOCUMENT {seedTag: $seedTag}]->(doc)
    `,
    { documents, seedTag }
  )
}

async function createStories(seedTag: string, stories: StorySeed[]): Promise<void> {
  if (!stories.length) return
  await runQuery(
    `
    UNWIND $stories AS s
    MATCH (author:User {userId: s.userId})
    CREATE (story:Story {
      storyId: s.storyId,
      type: s.type,
      mediaUrl: s.mediaUrl,
      content: s.content,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isActive: true,
      seedTag: $seedTag
    })
    CREATE (author)-[:CREATED_STORY {createdAt: s.createdAt, seedTag: $seedTag}]->(story)
    `,
    { stories, seedTag }
  )
}

async function createConversations(seedTag: string, conversations: ConversationSeed[]): Promise<void> {
  if (!conversations.length) return
  await runQuery(
    `
    UNWIND $conversations AS c
    CREATE (conv:Conversation {
      conversationId: c.conversationId,
      type: c.type,
      name: c.name,
      creatorId: c.creatorId,
      avatarUrl: c.avatarUrl,
      directKey: c.directKey,
      requestStatus: c.requestStatus,
      requesterId: c.requesterId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessageAt: c.lastMessageAt,
      seedTag: $seedTag
    })
    WITH conv, c
    UNWIND c.participantIds AS participantId
    MATCH (u:User {userId: participantId})
    CREATE (u)-[:PARTICIPATES_IN {seedTag: $seedTag}]->(conv)
    `,
    { conversations, seedTag }
  )
}

async function createMessages(seedTag: string, messages: MessageSeed[]): Promise<void> {
  if (!messages.length) return
  await runQuery(
    `
    UNWIND $messages AS m
    MATCH (sender:User {userId: m.senderId})
    MATCH (conv:Conversation {conversationId: m.conversationId})
    CREATE (msg:Message {
      messageId: m.messageId,
      conversationId: m.conversationId,
      content: m.content,
      type: m.type,
      mediaUrl: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      thumbnailUrl: null,
      createdAt: m.createdAt,
      seedTag: $seedTag
    })
    CREATE (sender)-[:SENT {createdAt: m.createdAt, seedTag: $seedTag}]->(msg)
    CREATE (msg)-[:IN_CONVERSATION {seedTag: $seedTag}]->(conv)
    SET conv.updatedAt = CASE WHEN conv.updatedAt < m.createdAt THEN m.createdAt ELSE conv.updatedAt END,
        conv.lastMessageAt = CASE WHEN conv.lastMessageAt < m.createdAt THEN m.createdAt ELSE conv.lastMessageAt END
    `,
    { messages, seedTag }
  )
}

async function createNotifications(seedTag: string, notifications: NotificationSeed[]): Promise<void> {
  if (!notifications.length) return
  await runQuery(
    `
    UNWIND $notifications AS n
    MATCH (recipient:User {userId: n.recipientId})
    CREATE (notification:Notification {
      notificationId: n.notificationId,
      type: n.type,
      senderId: n.senderId,
      content: n.content,
      entityId: n.entityId,
      entityType: n.entityType,
      isRead: n.isRead,
      createdAt: n.createdAt,
      seedTag: $seedTag
    })
    CREATE (recipient)-[:HAS_NOTIFICATION {seedTag: $seedTag}]->(notification)
    `,
    { notifications, seedTag }
  )
}

async function createReports(seedTag: string, reports: ReportSeed[]): Promise<void> {
  if (!reports.length) return
  await runQuery(
    `
    UNWIND $reports AS r
    MATCH (reporter:User {userId: r.reporterId})
    OPTIONAL MATCH (postTarget:Post {postId: r.targetId})
    OPTIONAL MATCH (commentTarget:Comment {commentId: r.targetId})
    OPTIONAL MATCH (userTarget:User {userId: r.targetId})
    OPTIONAL MATCH (groupTarget:Group {groupId: r.targetId})
    CREATE (report:Report {
      reportId: r.reportId,
      reason: r.reason,
      description: r.description,
      status: r.status,
      targetId: r.targetId,
      targetType: r.targetType,
      createdAt: r.createdAt,
      seedTag: $seedTag
    })
    CREATE (reporter)-[:REPORTED {seedTag: $seedTag}]->(report)
    FOREACH (_ IN CASE WHEN r.targetType = 'POST' AND postTarget IS NOT NULL THEN [1] ELSE [] END |
      CREATE (report)-[:TARGETS {seedTag: $seedTag}]->(postTarget)
    )
    FOREACH (_ IN CASE WHEN r.targetType = 'COMMENT' AND commentTarget IS NOT NULL THEN [1] ELSE [] END |
      CREATE (report)-[:TARGETS {seedTag: $seedTag}]->(commentTarget)
    )
    FOREACH (_ IN CASE WHEN r.targetType = 'USER' AND userTarget IS NOT NULL THEN [1] ELSE [] END |
      CREATE (report)-[:TARGETS {seedTag: $seedTag}]->(userTarget)
    )
    FOREACH (_ IN CASE WHEN r.targetType = 'GROUP' AND groupTarget IS NOT NULL THEN [1] ELSE [] END |
      CREATE (report)-[:TARGETS {seedTag: $seedTag}]->(groupTarget)
    )
    `,
    { reports, seedTag }
  )
}

async function createScopedUserEdges(
  seedTag: string,
  type: 'REQUESTED' | 'BLOCKED',
  edges: UserEdgeSeed[],
): Promise<void> {
  if (!edges.length) return
  const relationKey = type
  const propKey = type === 'REQUESTED' || type === 'BLOCKED' ? 'createdAt' : 'createdAt'
  await runQuery(
    `
    UNWIND $edges AS edge
    MATCH (a:User {userId: edge.fromUserId})
    MATCH (b:User {userId: edge.toUserId})
    CREATE (a)-[:${relationKey} {${propKey}: edge.createdAt, seedTag: $seedTag}]->(b)
    `,
    { edges, seedTag }
  )
}

async function createUserToTargetEdges(
  seedTag: string,
  query: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (!rows.length) return
  await runQuery(query, { rows, seedTag })
}

async function recalculateCounts(seedTag: string): Promise<void> {
  await runQuery(
    `
    MATCH (p:Post {seedTag: $seedTag})
    SET p.likesCount = COUNT { ()-[:LIKED]->(p) },
        p.commentsCount = COUNT { (p)-[:HAS_COMMENT]->(:Comment) },
        p.sharesCount = COUNT { ()-[:SHARED]->(p) }
    `,
    { seedTag }
  )

  await runQuery(
    `
    MATCH (d:Document {seedTag: $seedTag})
    SET d.viewsCount = COUNT { ()-[:VIEWED_DOCUMENT]->(d) }
    `,
    { seedTag }
  )
}

async function summarize(seedTag: string): Promise<void> {
  const rows = await runQuery<{ label: string; count: number }>(
    `
    CALL {
      MATCH (n) WHERE n.seedTag = $seedTag
      UNWIND labels(n) AS label
      RETURN label, count(*) AS count
    }
    RETURN label, count
    ORDER BY label
    `,
    { seedTag }
  )
  console.log('Seed summary:')
  for (const row of rows) {
    console.log(`- ${row.label}: ${row.count}`)
  }
}

async function main(): Promise<void> {
  await verifyConnectivity()

  const scope = await getScopeUsers(TARGET_EMAIL)
  const scopeUsers = [scope.target, ...scope.friends]
  const scopeIds = scopeUsers.map(user => user.userId)
  const rng = mulberry32(hashString(scope.target.userId))
  const existingFriendPairs = await getExistingFriendPairs(scopeIds)
  const existingDirectKeys = await getExistingDirectConversationKeys(scopeIds)

  await cleanupSeed(SEED_TAG)

  const target = scope.target
  const friends = scope.friends

  const groups: GroupSeed[] = []
  const targetGroupMembers = takeRandom(rng, friends.map(f => f.userId), 10)
  const targetGroupRequests = takeRandom(rng, friends.map(f => f.userId), 3, new Set(targetGroupMembers))
  groups.push({
    groupId: uuidv4(),
    name: 'Nhóm học tập cùng Thịnh',
    description: 'Nhóm nhỏ để trao đổi bài vở, tài liệu và cập nhật tiến độ.',
    coverUrl: makeImageUrl('group-thinh'),
    privacy: 'PUBLIC',
    ownerId: target.userId,
    createdAt: isoPastDate(rng, 20),
    updatedAt: isoPastDate(rng, 10),
    memberIds: targetGroupMembers,
    requestIds: targetGroupRequests,
  })

  const secondOwner = sample(rng, friends)
  const secondGroupMembers = takeRandom(rng, friends.map(f => f.userId), 8, new Set([secondOwner.userId]))
  const secondGroupRequests = takeRandom(rng, scopeIds, 2, new Set([secondOwner.userId, ...secondGroupMembers]))
  groups.push({
    groupId: uuidv4(),
    name: 'Góc chia sẻ tài liệu nhanh',
    description: 'Nơi mọi người thả tài liệu, ghi chú và lịch thảo luận ngắn.',
    coverUrl: makeImageUrl('group-docs'),
    privacy: 'PRIVATE',
    ownerId: secondOwner.userId,
    createdAt: isoPastDate(rng, 25),
    updatedAt: isoPastDate(rng, 6),
    memberIds: secondGroupMembers,
    requestIds: secondGroupRequests,
  })

  const groupMembership = new Map<string, string[]>()
  for (const group of groups) {
    groupMembership.set(group.groupId, [group.ownerId, ...group.memberIds])
  }

  const posts: PostSeed[] = []
  const postDocuments: PostDocumentSeed[] = []
  const sharedPosts: SharedPostSeed[] = []
  const comments: CommentSeed[] = []
  const stories: StorySeed[] = []
  const standaloneDocuments: DocumentSeed[] = []
  const notifications: NotificationSeed[] = []
  const reports: ReportSeed[] = []

  const usersForPosts = [target, ...takeRandom(rng, friends, 20)]
  for (const user of usersForPosts) {
    const count = user.userId === target.userId ? 4 : randomInt(rng, 1, 2)
    for (let i = 0; i < count; i += 1) {
      const createdAt = isoPastDate(rng, 28)
      const useGroup = chance(rng, 0.22)
      const allowedGroups = groups.filter(group => groupMembership.get(group.groupId)?.includes(user.userId))
      const selectedGroup = useGroup && allowedGroups.length ? sample(rng, allowedGroups) : null
      const visibility: 'PUBLIC' | 'FRIENDS' | 'GROUP' = selectedGroup
        ? 'GROUP'
        : chance(rng, 0.5)
          ? 'PUBLIC'
          : 'FRIENDS'

      const postId = uuidv4()
      posts.push({
        postId,
        authorId: user.userId,
        content: `${sample(rng, postTemplates)} ${user.userId === target.userId ? 'Mình note lại để lát còn xem tiếp.' : ''}`.trim(),
        visibility,
        groupId: selectedGroup?.groupId ?? null,
        mediaUrls: chance(rng, 0.35) ? [makeImageUrl(`post-${postId}`)] : [],
        createdAt,
        updatedAt: createdAt,
      })

      if (chance(rng, 0.18)) {
        const doc = pickDocumentAsset(rng)
        postDocuments.push({
          documentId: uuidv4(),
          uploaderId: user.userId,
          postId,
          title: doc.title,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          previewUrl: doc.previewUrl,
          fileType: doc.fileType,
          description: 'Tài liệu đính kèm từ bài viết seed cục bộ.',
          createdAt,
          updatedAt: createdAt,
        })
      }
    }
  }

  const shareCandidates = takeRandom(rng, posts, Math.min(8, posts.length))
  for (const original of shareCandidates) {
    const sharerPool = scopeUsers.filter(user => user.userId !== original.authorId)
    if (!sharerPool.length) continue
    const sharer = sample(rng, sharerPool)
    const createdAt = plusHours(original.createdAt, randomInt(rng, 5, 96))
    sharedPosts.push({
      postId: uuidv4(),
      authorId: sharer.userId,
      originalPostId: original.postId,
      content: 'Chia sẻ lại để mọi người tiện theo dõi.',
      visibility: chance(rng, 0.6) ? 'PUBLIC' : 'FRIENDS',
      createdAt,
      updatedAt: createdAt,
    })
  }

  const allPostIds = new Set(posts.map(post => post.postId))
  const commentParents: string[] = []
  for (const post of posts) {
    const commenters = takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 0, 3))
    for (const commenterId of commenters) {
      const commentId = uuidv4()
      const createdAt = plusHours(post.createdAt, randomInt(rng, 1, 72))
      comments.push({
        commentId,
        authorId: commenterId,
        postId: post.postId,
        parentId: null,
        content: sample(rng, commentTemplates),
        createdAt,
        updatedAt: createdAt,
      })
      commentParents.push(commentId)

      if (chance(rng, 0.22)) {
        const replier = sample(rng, scopeUsers)
        const replyAt = plusHours(createdAt, randomInt(rng, 1, 18))
        comments.push({
          commentId: uuidv4(),
          authorId: replier.userId,
          postId: post.postId,
          parentId: commentId,
          content: 'Mình trả lời thêm một chút để rõ ý hơn.',
          createdAt: replyAt,
          updatedAt: replyAt,
        })
      }
    }
  }

  const storyUsers = [target, ...takeRandom(rng, friends, 10)]
  for (const user of storyUsers) {
    const createdAt = isoPastDate(rng, 2)
    stories.push({
      storyId: uuidv4(),
      userId: user.userId,
      type: 'IMAGE',
      mediaUrl: makeStoryUrl(user.userId),
      content: sample(rng, storyCaptions),
      createdAt,
      expiresAt: plusHours(createdAt, 24),
    })
  }

  const docUsers = [target, ...takeRandom(rng, friends, 6)]
  for (const user of docUsers) {
    const doc = pickDocumentAsset(rng)
    const createdAt = isoPastDate(rng, 24)
    standaloneDocuments.push({
      documentId: uuidv4(),
      uploaderId: user.userId,
      title: doc.title,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      previewUrl: doc.previewUrl,
      fileType: doc.fileType,
      subject: doc.subject,
      school: doc.school,
      major: doc.major,
      cohort: doc.cohort,
      description: doc.description,
      tags: doc.tags,
      visibility: chance(rng, 0.6) ? 'PUBLIC' : 'FRIENDS',
      status: 'ACTIVE',
      viewsCount: 0,
      downloadsCount: randomInt(rng, 0, 6),
      createdAt,
      updatedAt: createdAt,
    })
  }

  const directConversations: ConversationSeed[] = []
  const groupConversations: ConversationSeed[] = []
  const messages: MessageSeed[] = []
  const directFriends = takeRandom(rng, friends, 12)
  for (const friend of directFriends) {
    const pairKey = directKey(target.userId, friend.userId)
    if (existingDirectKeys.has(pairKey)) continue
    const createdAt = isoPastDate(rng, 18)
    const conversationId = uuidv4()
    directConversations.push({
      conversationId,
      type: 'DIRECT',
      name: null,
      creatorId: null,
      avatarUrl: null,
      directKey: pairKey,
      requestStatus: 'ACCEPTED',
      requesterId: target.userId,
      participantIds: [target.userId, friend.userId],
      createdAt,
      updatedAt: createdAt,
      lastMessageAt: createdAt,
    })

    let cursor = createdAt
    const totalMessages = randomInt(rng, 4, 8)
    for (let i = 0; i < totalMessages; i += 1) {
      cursor = plusHours(cursor, randomInt(rng, 1, 14))
      const senderId = i % 2 === 0 ? target.userId : friend.userId
      messages.push({
        messageId: uuidv4(),
        conversationId,
        senderId,
        content: sample(rng, messageTemplates),
        type: 'TEXT',
        createdAt: cursor,
      })
    }
  }

  const groupParticipants = [target.userId, ...takeRandom(rng, friends.map(friend => friend.userId), 5)]
  const groupConversationId = uuidv4()
  const groupCreatedAt = isoPastDate(rng, 15)
  groupConversations.push({
    conversationId: groupConversationId,
    type: 'GROUP',
    name: 'Nhóm chat trao đổi nhanh',
    creatorId: target.userId,
    avatarUrl: makeImageUrl('chat-group', 800, 800),
    directKey: null,
    requestStatus: 'ACCEPTED',
    requesterId: null,
    participantIds: groupParticipants,
    createdAt: groupCreatedAt,
    updatedAt: groupCreatedAt,
    lastMessageAt: groupCreatedAt,
  })

  let groupCursor = groupCreatedAt
  for (let i = 0; i < 12; i += 1) {
    groupCursor = plusHours(groupCursor, randomInt(rng, 1, 10))
    messages.push({
      messageId: uuidv4(),
      conversationId: groupConversationId,
      senderId: sample(rng, groupParticipants),
      content: sample(rng, messageTemplates),
      type: 'TEXT',
      createdAt: groupCursor,
    })
  }

  const requestedEdges: UserEdgeSeed[] = []
  const blockedEdges: UserEdgeSeed[] = []
  const nonFriendPairs: Array<{ a: string; b: string }> = []
  for (let i = 0; i < friends.length; i += 1) {
    for (let j = i + 1; j < friends.length; j += 1) {
      const a = friends[i].userId
      const b = friends[j].userId
      if (!existingFriendPairs.has(directKey(a, b))) {
        nonFriendPairs.push({ a, b })
      }
    }
  }

  for (const pair of takeRandom(rng, nonFriendPairs, Math.min(4, nonFriendPairs.length))) {
    requestedEdges.push({
      fromUserId: chance(rng, 0.5) ? pair.a : pair.b,
      toUserId: chance(rng, 0.5) ? pair.b : pair.a,
      createdAt: isoPastDate(rng, 10),
    })
  }

  const requestedPairKeys = new Set(requestedEdges.map(edge => `${edge.fromUserId}:${edge.toUserId}`))
  for (const pair of takeRandom(rng, nonFriendPairs, Math.min(2, nonFriendPairs.length))) {
    const candidates = chance(rng, 0.5)
      ? { fromUserId: pair.a, toUserId: pair.b }
      : { fromUserId: pair.b, toUserId: pair.a }
    if (requestedPairKeys.has(`${candidates.fromUserId}:${candidates.toUserId}`)) continue
    blockedEdges.push({
      ...candidates,
      createdAt: isoPastDate(rng, 7),
    })
  }

  const postLikes = posts.flatMap(post =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 1, 6), new Set([post.authorId]))
      .map(userId => ({ userId, postId: post.postId, createdAt: plusHours(post.createdAt, randomInt(rng, 1, 120)) }))
  )

  const postSaves = posts.flatMap(post =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 0, 3), new Set([post.authorId]))
      .map(userId => ({ userId, postId: post.postId }))
  )

  const commentLikes = comments.flatMap(comment =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 0, 2), new Set([comment.authorId]))
      .map(userId => ({ userId, commentId: comment.commentId }))
  )

  const documentViews = standaloneDocuments.flatMap(doc =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 1, 4))
      .map(userId => ({ userId, documentId: doc.documentId, createdAt: plusHours(doc.createdAt, randomInt(rng, 2, 72)) }))
  )

  const documentSaves = standaloneDocuments.flatMap(doc =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 0, 2), new Set([doc.uploaderId]))
      .map(userId => ({ userId, documentId: doc.documentId }))
  )

  const storyViews = stories.flatMap(story =>
    takeRandom(rng, scopeUsers.map(user => user.userId), randomInt(rng, 1, 5), new Set([story.userId]))
      .map(userId => ({ userId, storyId: story.storyId, at: plusHours(story.createdAt, randomInt(rng, 1, 12)) }))
  )

  const readStates = [...directConversations, ...groupConversations].flatMap(conversation =>
    conversation.participantIds.map(userId => ({
      userId,
      conversationId: conversation.conversationId,
      at: plusHours(conversation.createdAt, randomInt(rng, 4, 48)),
    }))
  )

  const hiddenStates = directConversations
    .filter(() => chance(rng, 0.18))
    .map(conversation => ({
      userId: sample(rng, conversation.participantIds),
      conversationId: conversation.conversationId,
      hiddenAt: plusHours(conversation.createdAt, randomInt(rng, 10, 40)),
    }))

  for (const like of postLikes.slice(0, 18)) {
    const recipientId = posts.find(post => post.postId === like.postId)?.authorId
    if (!recipientId || recipientId === like.userId) continue
    notifications.push({
      notificationId: uuidv4(),
      recipientId,
      senderId: like.userId,
      type: 'POST_REACT',
      content: 'đã thích bài viết của bạn.',
      entityId: like.postId,
      entityType: 'POST',
      isRead: chance(rng, 0.35),
      createdAt: like.createdAt,
    })
  }

  for (const comment of comments.slice(0, 16)) {
    const recipientId = posts.find(post => post.postId === comment.postId)?.authorId
    if (!recipientId || recipientId === comment.authorId) continue
    notifications.push({
      notificationId: uuidv4(),
      recipientId,
      senderId: comment.authorId,
      type: 'POST_COMMENT',
      content: 'đã bình luận bài viết của bạn.',
      entityId: comment.postId,
      entityType: 'POST',
      isRead: chance(rng, 0.3),
      createdAt: comment.createdAt,
    })
  }

  for (const message of messages.slice(0, 20)) {
    const conversation = [...directConversations, ...groupConversations].find(item => item.conversationId === message.conversationId)
    if (!conversation) continue
    const recipientId = conversation.participantIds.find(userId => userId !== message.senderId) ?? conversation.participantIds[0]
    if (recipientId === message.senderId) continue
    notifications.push({
      notificationId: uuidv4(),
      recipientId,
      senderId: message.senderId,
      type: 'MESSAGE',
      content: 'đã gửi cho bạn một tin nhắn mới.',
      entityId: conversation.conversationId,
      entityType: 'CONVERSATION',
      isRead: chance(rng, 0.45),
      createdAt: message.createdAt,
    })
  }

  for (const edge of requestedEdges) {
    notifications.push({
      notificationId: uuidv4(),
      recipientId: edge.toUserId,
      senderId: edge.fromUserId,
      type: 'FRIEND_REQUEST',
      content: 'đã gửi cho bạn một lời mời kết bạn.',
      entityId: edge.fromUserId,
      entityType: 'USER',
      isRead: chance(rng, 0.25),
      createdAt: edge.createdAt,
    })
  }

  for (const group of groups) {
    for (const requesterId of group.requestIds) {
      notifications.push({
        notificationId: uuidv4(),
        recipientId: group.ownerId,
        senderId: requesterId,
        type: 'GROUP_REQUEST',
        content: 'đã gửi yêu cầu tham gia nhóm của bạn.',
        entityId: group.groupId,
        entityType: 'GROUP',
        isRead: chance(rng, 0.2),
        createdAt: group.updatedAt,
      })
    }
  }

  const reportTargetsPosts = takeRandom(rng, posts, Math.min(2, posts.length))
  for (const post of reportTargetsPosts) {
    const reporter = sample(rng, scopeUsers.filter(user => user.userId !== post.authorId))
    reports.push({
      reportId: uuidv4(),
      reporterId: reporter.userId,
      targetId: post.postId,
      targetType: 'POST',
      reason: sample(rng, reportReasons),
      description: 'Seed report để kiểm tra luồng moderation.',
      status: 'OPEN',
      createdAt: plusHours(post.createdAt, randomInt(rng, 4, 60)),
    })
  }

  if (comments.length) {
    const comment = sample(rng, comments)
    const reporter = sample(rng, scopeUsers.filter(user => user.userId !== comment.authorId))
    reports.push({
      reportId: uuidv4(),
      reporterId: reporter.userId,
      targetId: comment.commentId,
      targetType: 'COMMENT',
      reason: 'Bình luận chưa phù hợp',
      description: 'Seed report cho comment.',
      status: 'OPEN',
      createdAt: plusHours(comment.createdAt, randomInt(rng, 3, 36)),
    })
  }

  const userReportTarget = sample(rng, friends)
  reports.push({
    reportId: uuidv4(),
    reporterId: target.userId,
    targetId: userReportTarget.userId,
    targetType: 'USER',
    reason: 'Tài khoản cần xem xét',
    description: 'Seed report cho user để test trang admin.',
    status: 'OPEN',
    createdAt: isoPastDate(rng, 5),
  })

  await createGroups(SEED_TAG, groups)
  await createPosts(SEED_TAG, posts)
  await createSharedPosts(SEED_TAG, sharedPosts)
  await createComments(SEED_TAG, comments)
  await createPostDocuments(SEED_TAG, postDocuments)
  await createStandaloneDocuments(SEED_TAG, standaloneDocuments)
  await createStories(SEED_TAG, stories)
  await createConversations(SEED_TAG, [...directConversations, ...groupConversations])
  await createMessages(SEED_TAG, messages)
  await cleanupDuplicateSeededDirectConversations(SEED_TAG)
  await clearHiddenDirectConversationsForScope(target.userId, scopeIds)

  await createScopedUserEdges(SEED_TAG, 'REQUESTED', requestedEdges)
  await createScopedUserEdges(SEED_TAG, 'BLOCKED', blockedEdges)

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (p:Post {postId: row.postId})
    CREATE (u)-[:LIKED {createdAt: row.createdAt, seedTag: $seedTag}]->(p)
    `,
    postLikes
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (p:Post {postId: row.postId})
    CREATE (u)-[:SAVED {seedTag: $seedTag}]->(p)
    `,
    postSaves
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (c:Comment {commentId: row.commentId})
    CREATE (u)-[:LIKED {seedTag: $seedTag}]->(c)
    `,
    commentLikes
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (d:Document {documentId: row.documentId})
    CREATE (u)-[:VIEWED_DOCUMENT {createdAt: row.createdAt, viewedAt: row.createdAt, count: 1, seedTag: $seedTag}]->(d)
    `,
    documentViews
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (d:Document {documentId: row.documentId})
    CREATE (u)-[:SAVED_DOCUMENT {seedTag: $seedTag}]->(d)
    `,
    documentSaves
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (s:Story {storyId: row.storyId})
    CREATE (u)-[:VIEWED_STORY {at: row.at, viewedAt: row.at, seedTag: $seedTag}]->(s)
    `,
    storyViews
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (c:Conversation {conversationId: row.conversationId})
    CREATE (u)-[:READ {at: row.at, seedTag: $seedTag}]->(c)
    `,
    readStates
  )

  await createUserToTargetEdges(
    SEED_TAG,
    `
    UNWIND $rows AS row
    MATCH (u:User {userId: row.userId})
    MATCH (c:Conversation {conversationId: row.conversationId})
    CREATE (u)-[:HIDDEN_CONVERSATION {hiddenAt: row.hiddenAt, seedTag: $seedTag}]->(c)
    `,
    hiddenStates
  )

  await createNotifications(SEED_TAG, notifications)
  await createReports(SEED_TAG, reports)
  await recalculateCounts(SEED_TAG)
  await summarize(SEED_TAG)

  console.log(`Target email: ${TARGET_EMAIL}`)
  console.log(`Scope users: ${scopeUsers.length} (target + direct friends)`)
}

main()
  .then(async () => {
    await closeDriver()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Neighborhood generation failed:', error)
    await closeDriver()
    process.exit(1)
  })
