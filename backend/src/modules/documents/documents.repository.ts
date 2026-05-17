import { runQuery, runQueryOne } from '../../config/neo4j'
import { CreateDocumentDto, ListDocumentsQueryDto } from './documents.schema'

export interface DocumentRow {
  documentId: string
  title: string
  fileName: string
  fileUrl: string
  fileHash?: string
  uploadSourceName?: string
  duplicateOf?: string
  previewUrl?: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  subject?: string
  school?: string
  major?: string
  cohort?: string
  description?: string
  tags?: string[]
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  status: 'ACTIVE' | 'PENDING' | 'REJECTED'
  viewsCount: number
  downloadsCount: number
  isSaved?: boolean
  uploaderId: string
  uploaderName?: string
  uploaderAvatar?: string
  createdAt: string
  updatedAt: string
  reviewedBy?: string
  reviewedAt?: string
  moderationNote?: string
}

export interface DocumentFacets {
  schools: string[]
  majors: string[]
  cohorts: string[]
}

interface CreateDocumentData extends CreateDocumentDto {
  documentId: string
  fileName: string
  fileUrl: string
  fileHash: string
  uploadSourceName?: string
  duplicateOf?: string | null
  fileType: 'PDF' | 'DOC' | 'PPT'
  uploaderId: string
  createdAt: string
  updatedAt: string
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (value && typeof value === 'object') {
    const candidate = value as { toNumber?: () => number; low?: number }
    if (typeof candidate.toNumber === 'function') return candidate.toNumber()
    if (typeof candidate.low === 'number') return candidate.low
  }
  return 0
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}

function buildSchoolVariants(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const variants = [trimmed]

  if (/^đh\s+/i.test(trimmed)) {
    variants.push(trimmed.replace(/^đh\s+/i, 'Đại học '))
  }
  if (/^dh\s+/i.test(trimmed)) {
    variants.push(trimmed.replace(/^dh\s+/i, 'Đại học '))
  }
  if (/^đại học\s+/i.test(trimmed)) {
    variants.push(trimmed.replace(/^đại học\s+/i, 'ĐH '))
  }

  return uniqueStrings(variants)
}

function buildMajorVariants(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const variants = [trimmed]
  const lowered = trimmed.toLowerCase()

  if (lowered === 'cntt') variants.push('Công nghệ thông tin')
  if (lowered === 'công nghệ thông tin') variants.push('CNTT')
  if (lowered === 'truyển thông') variants.push('Truyền thông')
  if (lowered === 'truyền thông') variants.push('Truyển thông')

  return uniqueStrings(variants)
}

function canonicalSchoolLabel(value: string): string {
  const trimmed = value.trim()
  if (/^đh\s+/i.test(trimmed)) return trimmed.replace(/^đh\s+/i, 'Đại học ')
  if (/^dh\s+/i.test(trimmed)) return trimmed.replace(/^dh\s+/i, 'Đại học ')
  return trimmed
}

function canonicalMajorLabel(value: string): string {
  const trimmed = value.trim()
  const lowered = trimmed.toLowerCase()
  if (lowered === 'cntt') return 'Công nghệ thông tin'
  if (lowered === 'truyển thông') return 'Truyền thông'
  return trimmed
}

function buildWhere(query: ListDocumentsQueryDto, viewerId: string) {
  const where: string[] = [
    `coalesce(d.status, 'ACTIVE') = 'ACTIVE'`,
    `coalesce(d.visibility, 'PUBLIC') = 'PUBLIC'`,
  ]
  const params: Record<string, unknown> = { viewerId }

  if (query.q) {
    params.q = query.q.toLowerCase()
    where.push(
      `(
        toLower(coalesce(d.title, '')) CONTAINS $q OR
        toLower(coalesce(d.subject, '')) CONTAINS $q OR
        toLower(coalesce(d.school, '')) CONTAINS $q OR
        toLower(coalesce(d.major, '')) CONTAINS $q OR
        toLower(coalesce(d.description, '')) CONTAINS $q OR
        any(tag IN coalesce(d.tags, []) WHERE toLower(tag) CONTAINS $q)
      )`
    )
  }

  if (query.school) {
    params.schoolValues = buildSchoolVariants(query.school)
    where.push(`d.school IN $schoolValues`)
  }
  if (query.major) {
    params.majorValues = buildMajorVariants(query.major)
    where.push(`d.major IN $majorValues`)
  }
  if (query.fileType) {
    params.fileType = query.fileType
    where.push(`d.fileType = $fileType`)
  }

  if (query.timeRange && query.timeRange !== 'ALL') {
    const now = Date.now()
    const days = query.timeRange === '7D' ? 7 : query.timeRange === '30D' ? 30 : 90
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
    params.cutoff = cutoff
    where.push(`coalesce(toString(d.createdAt), '') >= $cutoff`)
  }

  return { whereClause: `WHERE ${where.join(' AND ')}`, params }
}

function buildOrder(sortBy: ListDocumentsQueryDto['sortBy']) {
  if (sortBy === 'POPULAR') return `ORDER BY coalesce(d.viewsCount, 0) DESC, coalesce(toString(d.createdAt), '') DESC`
  if (sortBy === 'RATING') return `ORDER BY coalesce(d.downloadsCount, 0) DESC, coalesce(d.viewsCount, 0) DESC`
  return `ORDER BY coalesce(toString(d.createdAt), '') DESC`
}

export const documentsRepository = {
  async create(data: CreateDocumentData): Promise<DocumentRow> {
    const result = await runQueryOne<{ d: DocumentRow; uploaderName: string; uploaderAvatar: string }>(
      `MATCH (u:User {userId: $uploaderId})
       CREATE (d:Document {
         documentId: $documentId,
         title: $title,
         fileName: $fileName,
         fileUrl: $fileUrl,
         fileHash: $fileHash,
         uploadSourceName: $uploadSourceName,
         duplicateOf: $duplicateOf,
         previewUrl: $fileUrl,
         fileType: $fileType,
         subject: $subject,
         school: $school,
         major: $major,
         cohort: $cohort,
         description: $description,
         tags: $tags,
         visibility: $visibility,
         status: 'PENDING',
         viewsCount: 0,
         downloadsCount: 0,
         uploaderId: $uploaderId,
         createdAt: $createdAt,
         updatedAt: $updatedAt,
         reviewedBy: null,
         reviewedAt: null,
         moderationNote: null
       })
       MERGE (u)-[:UPLOADED_DOCUMENT]->(d)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote
       } AS d,
       u.displayName AS uploaderName,
       u.avatarUrl AS uploaderAvatar`,
      {
        ...data,
        title: data.title?.trim() || data.fileName,
        subject: data.subject?.trim() ?? '',
        school: data.school?.trim() ?? '',
        major: data.major?.trim() ?? '',
        cohort: data.cohort?.trim() ?? '',
        description: data.description?.trim() ?? '',
        tags: (data.tags ?? []).map(tag => tag.trim()).filter(Boolean),
      }
    )

    return {
      ...(result?.d as DocumentRow),
      uploaderName: result?.uploaderName ?? '',
      uploaderAvatar: result?.uploaderAvatar ?? '',
    }
  },

  async list(viewerId: string, query: ListDocumentsQueryDto) {
    const skip = (query.page - 1) * query.limit
    const { whereClause, params } = buildWhere(query, viewerId)
    const orderBy = buildOrder(query.sortBy)

    const rows = await runQuery<{ row: DocumentRow }>(
      `MATCH (d:Document)
       ${whereClause}
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WITH d, u
       ${orderBy}
       SKIP toInteger($skip)
       LIMIT toInteger($limit)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { ...params, skip, limit: query.limit }
    )

    const countRow = await runQueryOne<{ total: number }>(
      `MATCH (d:Document)
       ${whereClause}
       RETURN count(d) AS total`,
      params
    )

    return {
      rows: rows.map(item => item.row),
      total: toSafeNumber(countRow?.total),
    }
  },

  async getFacets(): Promise<DocumentFacets> {
    const rows = await runQuery<{ school?: string; major?: string; cohort?: string }>(
      `MATCH (d:Document)
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND coalesce(d.visibility, 'PUBLIC') = 'PUBLIC'
       RETURN d.school AS school, d.major AS major, d.cohort AS cohort`
    )

    const collect = (field: 'school' | 'major' | 'cohort') => {
      const rawValues = rows
        .map((row) => row[field])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      const normalizedValues =
        field === 'school'
          ? rawValues.map(canonicalSchoolLabel)
          : field === 'major'
            ? rawValues.map(canonicalMajorLabel)
            : rawValues.map((value) => value.trim())

      return Array.from(new Set(normalizedValues)).sort((a, b) => a.localeCompare(b))
    }

    return {
      schools: collect('school'),
      majors: collect('major'),
      cohorts: collect('cohort'),
    }
  },

  async findAccessibleById(viewerId: string, documentId: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $viewerId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { viewerId, documentId }
    )
    return result?.row ?? null
  },

  async incrementViews(viewerId: string, documentId: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $viewerId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       MERGE (viewer)-[viewed:VIEWED_DOCUMENT]->(d)
       ON CREATE SET
         viewed.createdAt = $now,
         d.viewsCount = coalesce(d.viewsCount, 0) + 1,
         d.updatedAt = $now
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { viewerId, documentId, now: new Date().toISOString() }
    )
    return result?.row ?? null
  },

  async incrementDownloads(viewerId: string, documentId: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $viewerId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       SET d.downloadsCount = coalesce(d.downloadsCount, 0) + 1,
           d.updatedAt = $now
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { viewerId, documentId, now: new Date().toISOString() }
    )
    return result?.row ?? null
  },

  async toggleSave(documentId: string, userId: string): Promise<{ saved: boolean }> {
    const result = await runQueryOne<{ saved: boolean }>(
      `MATCH (u:User {userId: $userId}), (d:Document {documentId: $documentId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $userId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       OPTIONAL MATCH (u)-[existing:SAVED_DOCUMENT]->(d)
       WITH u, d, existing
       FOREACH (_ IN CASE WHEN existing IS NOT NULL THEN [1] ELSE [] END |
         DELETE existing
       )
       FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
         MERGE (u)-[:SAVED_DOCUMENT]->(d)
       )
       RETURN existing IS NULL AS saved`,
      { documentId, userId }
    )
    return result ?? { saved: false }
  },

  async getSavedDocuments(userId: string, skip: number, limit: number) {
    const rows = await runQuery<{ row: DocumentRow }>(
      `MATCH (:User {userId: $userId})-[:SAVED_DOCUMENT]->(d:Document)
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $userId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       WITH d, u
       ORDER BY coalesce(toString(d.updatedAt), toString(d.createdAt), '') DESC
       SKIP toInteger($skip)
       LIMIT toInteger($limit)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: true,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { userId, skip, limit }
    )
    const countRow = await runQueryOne<{ total: number }>(
      `MATCH (:User {userId: $userId})-[:SAVED_DOCUMENT]->(d:Document)
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND (d.uploaderId = $userId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')
       RETURN count(d) AS total`,
      { userId }
    )
    return {
      rows: rows.map((item) => item.row),
      total: toSafeNumber(countRow?.total),
    }
  },

  async getUploadedDocuments(userId: string, skip: number, limit: number) {
    const rows = await runQuery<{ row: DocumentRow }>(
      `MATCH (:User {userId: $userId})-[:UPLOADED_DOCUMENT]->(d:Document)
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       WITH d, u
       ORDER BY coalesce(toString(d.updatedAt), toString(d.createdAt), '') DESC
       SKIP toInteger($skip)
       LIMIT toInteger($limit)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         isSaved: EXISTS { (:User {userId: $userId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { userId, skip, limit }
    )
    const countRow = await runQueryOne<{ total: number }>(
      `MATCH (:User {userId: $userId})-[:UPLOADED_DOCUMENT]->(d:Document)
       RETURN count(d) AS total`,
      { userId }
    )
    return {
      rows: rows.map((item) => item.row),
      total: toSafeNumber(countRow?.total),
    }
  },

  async listForAdmin(status: 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED', skip: number, limit: number) {
    const whereClause = status === 'ALL' ? '' : `WHERE coalesce(d.status, 'PENDING') = $status`
    const rows = await runQuery<{ row: DocumentRow }>(
      `MATCH (d:Document)
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       ${whereClause}
       WITH d, u
       ORDER BY
         CASE WHEN coalesce(d.status, 'PENDING') = 'PENDING' THEN 0 ELSE 1 END,
         coalesce(toString(d.createdAt), '') DESC
       SKIP toInteger($skip)
       LIMIT toInteger($limit)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .fileHash, .uploadSourceName, .duplicateOf, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { status, skip, limit }
    )
    const countRow = await runQueryOne<{ total: number }>(
      `MATCH (d:Document)
       ${whereClause}
       RETURN count(d) AS total`,
      { status }
    )
    return {
      rows: rows.map((item) => item.row),
      total: toSafeNumber(countRow?.total),
    }
  },

  async findById(documentId: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .fileHash, .uploadSourceName, .duplicateOf, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { documentId }
    )
    return result?.row ?? null
  },

  async findOwnedById(userId: string, documentId: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (:User {userId: $userId})-[:UPLOADED_DOCUMENT]->(d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { userId, documentId }
    )
    return result?.row ?? null
  },

  async findByFileHash(fileHash: string): Promise<DocumentRow | null> {
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (d:Document {fileHash: $fileHash})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .fileHash, .uploadSourceName, .duplicateOf, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row
       ORDER BY
         CASE coalesce(d.status, 'PENDING')
           WHEN 'ACTIVE' THEN 0
           WHEN 'PENDING' THEN 1
           ELSE 2
         END,
         coalesce(toString(d.createdAt), '') DESC
       LIMIT 1`,
      { fileHash }
    )
    return result?.row ?? null
  },

  async updateStatus(
    documentId: string,
    status: 'ACTIVE' | 'REJECTED',
    options: { reviewedBy: string; moderationNote?: string }
  ): Promise<DocumentRow | null> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ row: DocumentRow }>(
      `MATCH (d:Document {documentId: $documentId})
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       SET d.status = $status,
           d.updatedAt = $now,
           d.reviewedBy = $reviewedBy,
           d.reviewedAt = $now,
           d.moderationNote = $moderationNote
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         .reviewedBy, .reviewedAt, .moderationNote,
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      {
        documentId,
        status,
        now,
        reviewedBy: options.reviewedBy,
        moderationNote: options.moderationNote?.trim() || null,
      }
    )
    return result?.row ?? null
  },

  async delete(documentId: string): Promise<void> {
    await runQuery(
      `MATCH (d:Document {documentId: $documentId})
       DETACH DELETE d`,
      { documentId }
    )
  },

  async getByIds(viewerId: string, documentIds: string[]): Promise<DocumentRow[]> {
    if (documentIds.length === 0) return []

    const rows = await runQuery<{ row: DocumentRow }>(
      `UNWIND $documentIds AS docId
       MATCH (d:Document {documentId: docId})
       WHERE coalesce(d.status, 'ACTIVE') = 'ACTIVE'
         AND coalesce(d.visibility, 'PUBLIC') = 'PUBLIC'
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { documentIds, viewerId }
    )

    return rows.map(r => r.row)
  },
}
