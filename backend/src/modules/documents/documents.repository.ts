import { runQuery, runQueryOne } from '../../config/neo4j'
import { CreateDocumentDto, ListDocumentsQueryDto } from './documents.schema'

export interface DocumentRow {
  documentId: string
  title: string
  fileName: string
  fileUrl: string
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
}

interface CreateDocumentData extends CreateDocumentDto {
  documentId: string
  fileName: string
  fileUrl: string
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

function buildWhere(query: ListDocumentsQueryDto, viewerId: string) {
  const where: string[] = [
    `coalesce(d.status, 'ACTIVE') = 'ACTIVE'`,
    `(d.uploaderId = $viewerId OR coalesce(d.visibility, 'PUBLIC') = 'PUBLIC')`,
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
    params.school = query.school
    where.push(`d.school = $school`)
  }
  if (query.major) {
    params.major = query.major
    where.push(`d.major = $major`)
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
         previewUrl: $fileUrl,
         fileType: $fileType,
         subject: $subject,
         school: $school,
         major: $major,
         cohort: $cohort,
         description: $description,
         tags: $tags,
         visibility: $visibility,
         status: 'ACTIVE',
         viewsCount: 0,
         downloadsCount: 0,
         uploaderId: $uploaderId,
         createdAt: $createdAt,
         updatedAt: $updatedAt
       })
       MERGE (u)-[:UPLOADED_DOCUMENT]->(d)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt
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
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       ${whereClause}
       WITH d, u
       ${orderBy}
       SKIP toInteger($skip)
       LIMIT toInteger($limit)
       RETURN d {
         .documentId, .title, .fileName, .fileUrl, .previewUrl, .fileType, .subject,
         .school, .major, .cohort, .description, .tags, .visibility, .status,
         .viewsCount, .downloadsCount, .uploaderId, .createdAt, .updatedAt,
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`,
      { ...params, skip, limit: query.limit }
    )

    const countRow = await runQueryOne<{ total: number }>(
      `MATCH (d:Document)
       OPTIONAL MATCH (u:User {userId: d.uploaderId})
       ${whereClause}
       RETURN count(d) AS total`,
      params
    )

    return {
      rows: rows.map(item => item.row),
      total: toSafeNumber(countRow?.total),
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
         isSaved: EXISTS { (:User {userId: $viewerId})-[:SAVED_DOCUMENT]->(d) },
         uploaderName: u.displayName,
         uploaderAvatar: u.avatarUrl
       } AS row`
      ,
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
}
