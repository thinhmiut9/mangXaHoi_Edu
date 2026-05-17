import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'
import { uploadRawToCloudinary } from '../modules/uploads/uploads.utils'
import { deleteCloudinaryAsset } from '../utils/cloudinary'

type MetadataRow = {
  title: string
  fileName: string
  fileType?: string
  subject?: string
  school?: string
  major?: string
  cohort?: string
  description?: string
  tags?: string
}

type UserRow = {
  userId: string
}

type ExistingDocumentRow = {
  documentId: string
  title: string
  uploaderId: string
}

function resolveDataDir(): string {
  return path.resolve(process.cwd(), '..', 'Data_Train_HeGoiY_Now')
}

function resolveMetadataPath(): string {
  const envPath = process.env.IMPORT_METADATA_PATH?.trim()
  if (envPath) return path.resolve(envPath)
  return path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'metadata_tai_lieu (1).csv')
}

function resolveDocumentsDir(): string {
  const envPath = process.env.IMPORT_DOCUMENTS_DIR?.trim()
  if (envPath) return path.resolve(envPath)
  return path.join(resolveDataDir(), 'Data_Document')
}

function parseCsv(filePath: string): MetadataRow[] {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length <= 1) return []

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    return row as MetadataRow
  })
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

function normalizeFileType(fileName: string, fileType?: string): 'PDF' | 'DOC' | 'PPT' {
  const type = String(fileType || '').trim().toUpperCase()
  const ext = path.extname(fileName).toLowerCase()

  if (type === 'PDF' || ext === '.pdf') return 'PDF'
  if (type === 'DOC' || type === 'DOCX' || ext === '.doc' || ext === '.docx') return 'DOC'
  if (type === 'PPT' || type === 'PPTX' || ext === '.ppt' || ext === '.pptx') return 'PPT'

  throw new Error(`Unsupported file type for ${fileName}`)
}

function splitTags(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function sanitizeBaseFileName(name: string): string {
  const ext = (path.extname(name || '') || '').toLowerCase()
  return (
    path
      .basename(name || 'document', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120) || 'document'
  )
}

function pickUploader(userIds: string[], seedText: string): string {
  const digest = createHash('md5').update(seedText).digest('hex')
  const index = parseInt(digest.slice(0, 8), 16) % userIds.length
  return userIds[index]
}

async function listUsers(): Promise<string[]> {
  const rows = await runQuery<UserRow>(
    `
    MATCH (u:User)
    WHERE coalesce(u.role, 'USER') = 'USER'
      AND coalesce(u.status, 'ACTIVE') = 'ACTIVE'
    RETURN u.userId AS userId
    ORDER BY u.userId ASC
    `
  )
  return rows.map((row) => row.userId)
}

async function findByFileHash(fileHash: string): Promise<ExistingDocumentRow | null> {
  const rows = await runQuery<ExistingDocumentRow>(
    `
    MATCH (d:Document {fileHash: $fileHash})
    RETURN d.documentId AS documentId, d.title AS title, d.uploaderId AS uploaderId
    LIMIT 1
    `,
    { fileHash }
  )
  return rows[0] ?? null
}

async function createDocument(params: {
  documentId: string
  title: string
  fileName: string
  fileUrl: string
  fileHash: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  subject: string
  school: string
  major: string
  cohort: string
  description: string
  tags: string[]
  uploaderId: string
  createdAt: string
  updatedAt: string
}): Promise<void> {
  await runQuery(
    `
    MATCH (u:User {userId: $uploaderId})
    CREATE (d:Document {
      documentId: $documentId,
      title: $title,
      fileName: $fileName,
      fileUrl: $fileUrl,
      previewUrl: $fileUrl,
      fileHash: $fileHash,
      uploadSourceName: $fileName,
      duplicateOf: null,
      fileType: $fileType,
      subject: $subject,
      school: $school,
      major: $major,
      cohort: $cohort,
      description: $description,
      tags: $tags,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      viewsCount: 0,
      downloadsCount: 0,
      uploaderId: $uploaderId,
      createdAt: $createdAt,
      updatedAt: $updatedAt,
      reviewedBy: null,
      reviewedAt: null,
      moderationNote: null,
      sourceType: 'BULK_IMPORT'
    })
    MERGE (u)-[:UPLOADED_DOCUMENT]->(d)
    `,
    params
  )
}

async function main() {
  const documentsDir = resolveDocumentsDir()
  const metadataPath = resolveMetadataPath()

  if (!fs.existsSync(documentsDir)) {
    throw new Error(`Documents folder not found: ${documentsDir}`)
  }
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Metadata file not found: ${metadataPath}`)
  }

  console.log(`Documents folder: ${documentsDir}`)
  console.log(`Metadata file   : ${metadataPath}`)

  await verifyConnectivity()

  const metadataRows = parseCsv(metadataPath).filter((row) => row.fileName)
  const userIds = await listUsers()
  if (!userIds.length) {
    throw new Error('No active users found for uploader assignment.')
  }

  let imported = 0
  let skippedExisting = 0
  let missingFiles = 0
  const failures: string[] = []

  for (const row of metadataRows) {
    const localPath = path.join(documentsDir, row.fileName)
    if (!fs.existsSync(localPath)) {
      missingFiles += 1
      failures.push(`Missing file: ${row.fileName}`)
      continue
    }

    const buffer = fs.readFileSync(localPath)
    const fileHash = createHash('sha256').update(buffer).digest('hex')
    const existing = await findByFileHash(fileHash)
    if (existing) {
      skippedExisting += 1
      continue
    }

    const uploaderId = pickUploader(userIds, row.fileName)
    const now = new Date().toISOString()
    const base = sanitizeBaseFileName(row.fileName)
    const ext = (path.extname(row.fileName || '') || '').toLowerCase()
    const publicId = `${base}_${Date.now()}_${imported + 1}${ext}`

    let uploadedUrl = ''
    try {
      const uploaded = await uploadRawToCloudinary(buffer, 'documents', publicId, row.fileName)
      uploadedUrl = uploaded.url

      await createDocument({
        documentId: uuidv4(),
        title: row.title?.trim() || base,
        fileName: row.fileName,
        fileUrl: uploaded.url,
        fileHash,
        fileType: normalizeFileType(row.fileName, row.fileType),
        subject: row.subject?.trim() || '',
        school: row.school?.trim() || '',
        major: row.major?.trim() || '',
        cohort: row.cohort?.trim() || '',
        description: row.description?.trim() || '',
        tags: splitTags(row.tags),
        uploaderId,
        createdAt: now,
        updatedAt: now,
      })
      imported += 1
    } catch (error) {
      failures.push(`Failed: ${row.fileName} -> ${error instanceof Error ? error.message : String(error)}`)
      if (uploadedUrl) {
        await deleteCloudinaryAsset(uploadedUrl).catch(() => {})
      }
    }
  }

  console.log(`Imported documents      : ${imported}`)
  console.log(`Skipped existing hashes : ${skippedExisting}`)
  console.log(`Missing local files     : ${missingFiles}`)
  console.log(`Failures                : ${failures.length}`)
  for (const item of failures.slice(0, 20)) {
    console.log(`- ${item}`)
  }
}

main()
  .then(async () => {
    await closeDriver()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Import failed:', error)
    await closeDriver()
    process.exit(1)
  })
