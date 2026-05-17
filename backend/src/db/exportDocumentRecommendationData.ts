import fs from 'fs'
import path from 'path'
import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

type UserExportRow = {
  userId: string
  email: string
  displayName: string
  interests?: string | null
  school?: string | null
  major?: string | null
  cohort?: string | null
  role?: string | null
  status?: string | null
  profileVisibility?: string | null
}

type DocumentExportRow = {
  documentId: string
  title: string
  fileName?: string | null
  fileType?: string | null
  subject?: string | null
  school?: string | null
  major?: string | null
  cohort?: string | null
  description?: string | null
  tags?: string[] | null
  visibility?: string | null
  status?: string | null
  viewsCount?: number
  downloadsCount?: number
  uploaderId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  sourceType?: string | null
}

type UserDocumentInteractionRow = {
  userId: string
  documentId: string
  edgeType: string
  createdAt?: string | null
}

type MajorTemplate = {
  matchers: string[]
  subjects: Array<{
    subject: string
    tags: string[]
    titlePatterns: string[]
    fileTypes: string[]
  }>
}

// Disable synthetic training documents. Only real documents exported from Neo4j
// should be used in the training dataset.
const SYNTHETIC_TARGET_DOCUMENTS = 0
const SYNTHETIC_USERS_PER_DOCUMENT = 12

const MAJOR_TEMPLATES: MajorTemplate[] = [
  {
    matchers: ['cong nghe thong tin', 'ky thuat phan mem', 'he thong thong tin', 'mang may tinh'],
    subjects: [
      {
        subject: 'Lap trinh co ban',
        tags: ['lap trinh', 'oop', 'thuc hanh'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          'Tong hop bai tap %SUBJECT%',
          'Tai lieu on thi %SUBJECT%',
          '%SUBJECT% - ly thuyet va thuc hanh',
        ],
        fileTypes: ['PDF', 'PDF', 'DOCX'],
      },
      {
        subject: 'Co so du lieu',
        tags: ['sql', 'database', 'truy van'],
        titlePatterns: [
          'De cuong on tap %SUBJECT%',
          '%SUBJECT% - bai tap co loi giai',
          'Bai giang %SUBJECT%',
          'Tai lieu thuc hanh %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Lap trinh web',
        tags: ['html', 'css', 'javascript'],
        titlePatterns: [
          'Slide mon %SUBJECT%',
          '%SUBJECT% - tong hop kien thuc',
          'Tai lieu on tap %SUBJECT%',
          'Bai tap lon %SUBJECT% mau',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
      {
        subject: 'Phan tich va thiet ke he thong',
        tags: ['uml', 'phan tich', 'thiet ke'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          '%SUBJECT% - de cuong cuoi ky',
          'Tai lieu tham khao %SUBJECT%',
          '%SUBJECT% - bai tap nhom',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Mang may tinh',
        tags: ['tcp/ip', 'network', 'cisco'],
        titlePatterns: [
          'Slide on thi %SUBJECT%',
          '%SUBJECT% - bai tap thuc hanh',
          'Bai giang %SUBJECT%',
          'Tai lieu tong hop %SUBJECT%',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
      {
        subject: 'Kiem thu phan mem',
        tags: ['testing', 'qa', 'testcase'],
        titlePatterns: [
          'Tai lieu hoc %SUBJECT%',
          '%SUBJECT% - quy trinh va testcase',
          'Tong hop kien thuc %SUBJECT%',
          'Bai giang %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
    ],
  },
  {
    matchers: ['khoa hoc du lieu', 'tri tue nhan tao', 'hoc may'],
    subjects: [
      {
        subject: 'Nhap mon khoa hoc du lieu',
        tags: ['data', 'phan tich', 'python'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          '%SUBJECT% - tong hop kien thuc',
          'Tai lieu on tap %SUBJECT%',
          'Bai tap %SUBJECT% co dap an',
        ],
        fileTypes: ['PDF', 'PDF', 'DOCX'],
      },
      {
        subject: 'Machine Learning',
        tags: ['ml', 'model', 'supervised learning'],
        titlePatterns: [
          'Slide mon %SUBJECT%',
          '%SUBJECT% - bai tap va huong dan',
          'Tai lieu hoc %SUBJECT%',
          '%SUBJECT% - tong hop cong thuc',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
      {
        subject: 'Tien xu ly du lieu',
        tags: ['cleaning', 'preprocessing', 'feature engineering'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          'Tai lieu thuc hanh %SUBJECT%',
          '%SUBJECT% - kinh nghiem lam bai',
          'De cuong on thi %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Thong ke ung dung',
        tags: ['statistics', 'xac suat', 'phan tich du lieu'],
        titlePatterns: [
          '%SUBJECT% - bai tap co loi giai',
          'Tong hop cong thuc %SUBJECT%',
          'Tai lieu on tap %SUBJECT%',
          'Bai giang %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Python cho phan tich du lieu',
        tags: ['python', 'pandas', 'numpy'],
        titlePatterns: [
          'Tai lieu thuc hanh %SUBJECT%',
          '%SUBJECT% - code mau va ghi chu',
          'Bai giang %SUBJECT%',
          'Tong hop bai tap %SUBJECT%',
        ],
        fileTypes: ['IPYNB', 'PDF', 'DOCX'],
      },
      {
        subject: 'Truc quan hoa du lieu',
        tags: ['visualization', 'matplotlib', 'dashboard'],
        titlePatterns: [
          'Slide hoc phan %SUBJECT%',
          '%SUBJECT% - bai tap lon tham khao',
          'Tai lieu hoc %SUBJECT%',
          'Tong hop kien thuc %SUBJECT%',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
    ],
  },
  {
    matchers: ['quan tri kinh doanh', 'ke toan', 'tai chinh'],
    subjects: [
      {
        subject: 'Nguyen ly quan tri',
        tags: ['quan tri', 'kinh doanh', 'case study'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          '%SUBJECT% - tong hop ly thuyet',
          'Tai lieu on thi %SUBJECT%',
          'De cuong mon %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Ke toan tai chinh',
        tags: ['ke toan', 'bao cao tai chinh', 'dinh khoan'],
        titlePatterns: [
          '%SUBJECT% - bai tap co loi giai',
          'Tong hop cong thuc %SUBJECT%',
          'Tai lieu hoc %SUBJECT%',
          'Bai giang %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Marketing can ban',
        tags: ['marketing', 'chien luoc', 'thuong hieu'],
        titlePatterns: [
          'Slide mon %SUBJECT%',
          '%SUBJECT% - de cuong on tap',
          'Tai lieu tong hop %SUBJECT%',
          'Bai tap nhom %SUBJECT% mau',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
      {
        subject: 'Phan tich tai chinh',
        tags: ['finance', 'chi so', 'bao cao'],
        titlePatterns: [
          'Bai giang %SUBJECT%',
          '%SUBJECT% - bai tap thuc hanh',
          'Tai lieu on tap %SUBJECT%',
          'Tong hop kien thuc %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Quan tri nhan su',
        tags: ['nhan su', 'hr', 'quan tri'],
        titlePatterns: [
          'Tai lieu hoc %SUBJECT%',
          '%SUBJECT% - case study tham khao',
          'Bai giang %SUBJECT%',
          'De cuong on thi %SUBJECT%',
        ],
        fileTypes: ['PDF', 'DOCX', 'PDF'],
      },
      {
        subject: 'Ky nang thuyet trinh',
        tags: ['presentation', 'ky nang mem', 'bao cao'],
        titlePatterns: [
          'Slide hoc phan %SUBJECT%',
          '%SUBJECT% - tai lieu tham khao',
          'Tong hop ky nang %SUBJECT%',
          'Bai giang %SUBJECT%',
        ],
        fileTypes: ['PPTX', 'PDF', 'DOCX'],
      },
    ],
  },
]

function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function pickTemplateForMajor(major: string): MajorTemplate {
  const majorNorm = normalizeComparable(major)
  return (
    MAJOR_TEMPLATES.find((template) =>
      template.matchers.some((matcher) => majorNorm.includes(normalizeComparable(matcher)))
    ) ?? {
      matchers: [],
      subjects: [
        {
          subject: 'Tong hop kien thuc can ban',
          tags: ['tong hop', 'on tap', 'ly thuyet'],
          titlePatterns: [
            'Tai lieu hoc %SUBJECT%',
            '%SUBJECT% - de cuong on tap',
            'Bai giang %SUBJECT%',
          ],
          fileTypes: ['PDF', 'DOCX'],
        },
        {
          subject: 'Tai lieu on tap',
          tags: ['on tap', 'ghi chu', 'tong hop'],
          titlePatterns: [
            'Tong hop kien thuc %SUBJECT%',
            '%SUBJECT% - bai tap tham khao',
            'Tai lieu mon %SUBJECT%',
          ],
          fileTypes: ['PDF', 'DOCX'],
        },
        {
          subject: 'Bai tap thuc hanh',
          tags: ['bai tap', 'thuc hanh', 'tham khao'],
          titlePatterns: [
            '%SUBJECT% - tai lieu thuc hanh',
            'Bai tap %SUBJECT% co dap an',
            'Tai lieu hoc %SUBJECT%',
          ],
          fileTypes: ['PDF', 'DOCX'],
        },
        {
          subject: 'De cuong mon hoc',
          tags: ['de cuong', 'on thi', 'mon hoc'],
          titlePatterns: [
            'De cuong on thi %SUBJECT%',
            '%SUBJECT% - tong hop ly thuyet',
            'Bai giang %SUBJECT%',
          ],
          fileTypes: ['PDF', 'DOCX'],
        },
      ],
    }
  )
}

function groupUsersByMajor(users: UserExportRow[]): Map<string, UserExportRow[]> {
  const map = new Map<string, UserExportRow[]>()
  for (const user of users) {
    const major = normalizeText(user.major)
    if (!major) continue
    const rows = map.get(major) ?? []
    rows.push(user)
    map.set(major, rows)
  }
  return map
}

function generateSyntheticDocuments(users: UserExportRow[], existingDocuments: DocumentExportRow[]): DocumentExportRow[] {
  if (existingDocuments.length >= SYNTHETIC_TARGET_DOCUMENTS) return []

  const documentsNeeded = SYNTHETIC_TARGET_DOCUMENTS - existingDocuments.length
  const byMajor = groupUsersByMajor(users)
  const sortedMajors = Array.from(byMajor.entries()).sort((a, b) => b[1].length - a[1].length)

  const results: DocumentExportRow[] = []
  let seq = 1

  for (const [major, majorUsers] of sortedMajors) {
    if (results.length >= documentsNeeded) break

    const template = pickTemplateForMajor(major)
    const docsPerMajor = Math.max(6, Math.round(documentsNeeded / Math.max(sortedMajors.length, 1)))
    const schoolCounts = new Map<string, number>()
    const cohortCounts = new Map<string, number>()
    for (const user of majorUsers) {
      const school = normalizeText(user.school)
      const cohort = normalizeText(user.cohort)
      if (school) schoolCounts.set(school, (schoolCounts.get(school) ?? 0) + 1)
      if (cohort) cohortCounts.set(cohort, (cohortCounts.get(cohort) ?? 0) + 1)
    }
    const school = Array.from(schoolCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    const cohort = Array.from(cohortCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    const uploaderId = majorUsers[0]?.userId ?? ''

    for (let index = 0; index < docsPerMajor && results.length < documentsNeeded; index += 1) {
      const subjectTemplate = template.subjects[index % template.subjects.length]
      const subject = subjectTemplate.subject
      const tags = subjectTemplate.tags
      const documentId = `synthetic-doc-${String(seq).padStart(4, '0')}`
      const cycle = Math.floor(index / template.subjects.length)
      const titlePattern = subjectTemplate.titlePatterns[(cycle + index) % subjectTemplate.titlePatterns.length]
      const titleBase = titlePattern.replace('%SUBJECT%', subject)
      const title = cycle > 0 ? `${titleBase} (${cycle + 1})` : titleBase
      const fileType = subjectTemplate.fileTypes[(cycle + index) % subjectTemplate.fileTypes.length]
      const extension = fileType.toLowerCase()
      const fileName = `${slugify(title) || documentId}.${extension}`
      const createdAt = new Date(Date.UTC(2026, 0, (seq % 28) + 1)).toISOString()
      const viewsCount = 8 + ((seq * 7) % 91)
      const downloadsCount = Math.min(viewsCount - 1, 2 + ((seq * 5) % 37))
      const descriptionParts = [
        `Tai lieu phuc vu mon ${subject}.`,
        major ? `Noi dung phu hop voi sinh vien nganh ${major}.` : '',
        school ? `Ngu canh tai lieu gan voi chuong trinh hoc tai ${school}.` : '',
        cohort ? `Co the tham khao cho nhom ${cohort}.` : '',
      ].filter(Boolean)

      results.push({
        documentId,
        title,
        fileName,
        fileType,
        subject,
        school,
        major,
        cohort,
        description: descriptionParts.join(' '),
        tags,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        viewsCount,
        downloadsCount,
        uploaderId,
        createdAt,
        updatedAt: createdAt,
        sourceType: 'SYNTHETIC_TRAINING',
      })
      seq += 1
    }
  }

  return results
}

function generateSyntheticInteractions(
  users: UserExportRow[],
  syntheticDocuments: DocumentExportRow[],
  existingInteractions: UserDocumentInteractionRow[],
): UserDocumentInteractionRow[] {
  if (!syntheticDocuments.length) return []

  const byMajor = groupUsersByMajor(users)
  const seen = new Set(existingInteractions.map((row) => `${row.userId}:${row.documentId}:${row.edgeType}`))
  const rows: UserDocumentInteractionRow[] = []

  for (const document of syntheticDocuments) {
    const majorUsers = byMajor.get(normalizeText(document.major)) ?? []
    const selectedUsers = majorUsers.slice(0, SYNTHETIC_USERS_PER_DOCUMENT)

    selectedUsers.forEach((user, index) => {
      const viewKey = `${user.userId}:${document.documentId}:VIEWED_DOCUMENT`
      if (!seen.has(viewKey)) {
        rows.push({
          userId: user.userId,
          documentId: document.documentId,
          edgeType: 'VIEWED_DOCUMENT',
          createdAt: document.createdAt ?? '',
        })
        seen.add(viewKey)
      }

      if (index % 3 === 0) {
        const saveKey = `${user.userId}:${document.documentId}:SAVED_DOCUMENT`
        if (!seen.has(saveKey)) {
          rows.push({
            userId: user.userId,
            documentId: document.documentId,
            edgeType: 'SAVED_DOCUMENT',
            createdAt: document.createdAt ?? '',
          })
          seen.add(saveKey)
        }
      }
    })
  }

  return rows
}

type FriendshipRow = {
  startUserId: string
  endUserId: string
}

type GraphNodeRow = {
  nodeId: string
  nodeType: 'USER' | 'DOCUMENT' | 'MAJOR' | 'SUBJECT' | 'SCHOOL' | 'TAG'
  entityId: string
  label: string
}

type GraphEdgeRow = {
  source: string
  target: string
  edgeType: string
  weight: number
}

function resolveDataDir(): string {
  return path.resolve(process.cwd(), '..', 'Data_Train_HeGoiY_Now')
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (Array.isArray(value)) {
    text = value.join('|')
  }
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

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function pushNodeIfMissing(
  nodes: GraphNodeRow[],
  seen: Set<string>,
  nodeType: GraphNodeRow['nodeType'],
  rawLabel: string,
): string | null {
  const label = normalizeText(rawLabel)
  if (!label) return null

  const entityId = slugify(label)
  if (!entityId) return null

  const nodeId = `${nodeType[0]}_${entityId}`
  if (!seen.has(nodeId)) {
    seen.add(nodeId)
    nodes.push({
      nodeId,
      nodeType,
      entityId,
      label,
    })
  }
  return nodeId
}

async function exportUsers(): Promise<UserExportRow[]> {
  const rows = await runQuery<UserExportRow>(
    `
    MATCH (u:User)
    WHERE coalesce(u.role, 'USER') = 'USER'
      AND coalesce(u.status, 'ACTIVE') = 'ACTIVE'
    RETURN
      u.userId AS userId,
      u.email AS email,
      u.displayName AS displayName,
      u.interests AS interests,
      u.school AS school,
      u.major AS major,
      u.cohort AS cohort,
      u.role AS role,
      u.status AS status,
      u.profileVisibility AS profileVisibility
    ORDER BY u.userId ASC
    `
  )

  return rows
}

async function exportDocuments(): Promise<DocumentExportRow[]> {
  const rows = await runQuery<DocumentExportRow>(
    `
    MATCH (d:Document)
    WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
    RETURN
      d.documentId AS documentId,
      d.title AS title,
      d.fileName AS fileName,
      d.fileType AS fileType,
      d.subject AS subject,
      d.school AS school,
      d.major AS major,
      d.cohort AS cohort,
      d.description AS description,
      d.tags AS tags,
      d.visibility AS visibility,
      d.status AS status,
      d.viewsCount AS viewsCount,
      d.downloadsCount AS downloadsCount,
      d.uploaderId AS uploaderId,
      d.createdAt AS createdAt,
      d.updatedAt AS updatedAt
    ORDER BY d.createdAt ASC, d.documentId ASC
    `
  )

  return rows.map((row) => ({
    ...row,
    tags: normalizeTagList(row.tags),
  }))
}

async function exportInteractions(): Promise<UserDocumentInteractionRow[]> {
  return runQuery<UserDocumentInteractionRow>(
    `
    MATCH (u:User)-[r]->(d:Document)
    WHERE coalesce(u.role, 'USER') = 'USER'
      AND coalesce(u.status, 'ACTIVE') = 'ACTIVE'
      AND coalesce(d.status, 'ACTIVE') = 'ACTIVE'
      AND type(r) IN ['VIEWED_DOCUMENT', 'SAVED_DOCUMENT', 'UPLOADED_DOCUMENT']
    RETURN
      u.userId AS userId,
      d.documentId AS documentId,
      type(r) AS edgeType,
      coalesce(r.createdAt, '') AS createdAt
    ORDER BY u.userId ASC, d.documentId ASC, edgeType ASC
    `
  )
}

async function exportFriendships(): Promise<FriendshipRow[]> {
  return runQuery<FriendshipRow>(
    `
    MATCH (a:User)-[:FRIENDS_WITH]-(b:User)
    WHERE coalesce(a.role, 'USER') = 'USER'
      AND coalesce(b.role, 'USER') = 'USER'
      AND coalesce(a.status, 'ACTIVE') = 'ACTIVE'
      AND coalesce(b.status, 'ACTIVE') = 'ACTIVE'
      AND a.userId < b.userId
    RETURN
      a.userId AS startUserId,
      b.userId AS endUserId
    ORDER BY startUserId ASC, endUserId ASC
    `
  )
}

function buildGraph(
  users: UserExportRow[],
  documents: DocumentExportRow[],
  interactions: UserDocumentInteractionRow[],
  friendships: FriendshipRow[],
): { nodes: GraphNodeRow[]; edges: GraphEdgeRow[] } {
  const nodes: GraphNodeRow[] = []
  const edges: GraphEdgeRow[] = []
  const seenNodes = new Set<string>()

  for (const user of users) {
    nodes.push({
      nodeId: `U_${user.userId}`,
      nodeType: 'USER',
      entityId: user.userId,
      label: user.displayName,
    })
  }
  for (const document of documents) {
    nodes.push({
      nodeId: `D_${document.documentId}`,
      nodeType: 'DOCUMENT',
      entityId: document.documentId,
      label: document.title || document.fileName || document.documentId,
    })
  }
  for (const node of nodes) {
    seenNodes.add(node.nodeId)
  }

  for (const user of users) {
    const userNodeId = `U_${user.userId}`
    const majorNodeId = pushNodeIfMissing(nodes, seenNodes, 'MAJOR', user.major ?? '')
    const schoolNodeId = pushNodeIfMissing(nodes, seenNodes, 'SCHOOL', user.school ?? '')

    if (majorNodeId) {
      edges.push({ source: userNodeId, target: majorNodeId, edgeType: 'HAS_MAJOR', weight: 2 })
    }
    if (schoolNodeId) {
      edges.push({ source: userNodeId, target: schoolNodeId, edgeType: 'STUDIES_AT', weight: 1 })
    }
  }

  for (const document of documents) {
    const documentNodeId = `D_${document.documentId}`
    const majorNodeId = pushNodeIfMissing(nodes, seenNodes, 'MAJOR', document.major ?? '')
    const schoolNodeId = pushNodeIfMissing(nodes, seenNodes, 'SCHOOL', document.school ?? '')
    const subjectNodeId = pushNodeIfMissing(nodes, seenNodes, 'SUBJECT', document.subject ?? '')

    if (majorNodeId) {
      edges.push({ source: documentNodeId, target: majorNodeId, edgeType: 'FOR_MAJOR', weight: 2 })
    }
    if (schoolNodeId) {
      edges.push({ source: documentNodeId, target: schoolNodeId, edgeType: 'FROM_SCHOOL', weight: 1 })
    }
    if (subjectNodeId) {
      edges.push({ source: documentNodeId, target: subjectNodeId, edgeType: 'HAS_SUBJECT', weight: 2 })
    }
    for (const tag of document.tags ?? []) {
      const tagNodeId = pushNodeIfMissing(nodes, seenNodes, 'TAG', tag)
      if (tagNodeId) {
        edges.push({ source: documentNodeId, target: tagNodeId, edgeType: 'HAS_TAG', weight: 2 })
      }
    }
  }

  const interactionWeights: Record<string, number> = {
    VIEWED_DOCUMENT: 1,
    SAVED_DOCUMENT: 2,
    UPLOADED_DOCUMENT: 3,
  }

  for (const row of interactions) {
    edges.push({
      source: `U_${row.userId}`,
      target: `D_${row.documentId}`,
      edgeType: row.edgeType,
      weight: interactionWeights[row.edgeType] ?? 1,
    })
  }

  for (const row of friendships) {
    edges.push({
      source: `U_${row.startUserId}`,
      target: `U_${row.endUserId}`,
      edgeType: 'FRIENDS_WITH',
      weight: 1,
    })
  }

  return { nodes, edges }
}

async function main() {
  const dataDir = resolveDataDir()
  ensureDir(dataDir)

  console.log(`Export data directory: ${dataDir}`)
  await verifyConnectivity()

  const [users, exportedDocuments] = await Promise.all([
    exportUsers(),
    exportDocuments(),
  ])

  const syntheticDocuments = generateSyntheticDocuments(users, exportedDocuments)
  const documents = [...exportedDocuments, ...syntheticDocuments]

  writeCsv(
    path.join(dataDir, 'document_train_users.csv'),
    ['userId', 'email', 'displayName', 'interests', 'school', 'major', 'cohort', 'role', 'status', 'profileVisibility'],
    users,
  )
  writeCsv(
    path.join(dataDir, 'document_train_documents.csv'),
    ['documentId', 'title', 'fileName', 'fileType', 'subject', 'school', 'major', 'cohort', 'description', 'tags', 'visibility', 'status', 'viewsCount', 'downloadsCount', 'uploaderId', 'createdAt', 'updatedAt', 'sourceType'],
    documents,
  )

  console.log(`Exported users: ${users.length}`)
  console.log(`Exported real documents: ${exportedDocuments.length}`)
  console.log(`Generated synthetic documents: ${syntheticDocuments.length}`)
  console.log(`Exported documents total: ${documents.length}`)
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
