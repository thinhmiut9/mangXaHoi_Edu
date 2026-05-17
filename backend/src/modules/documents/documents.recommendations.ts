/**
 * documents.recommendations.ts
 *
 * Đọc file CSV gợi ý đã train sẵn (document_profile_recommendations_all_users.csv)
 * một lần khi server khởi động, lưu vào Map<userId, RecommendationEntry[]> để
 * lookup O(1) cho mỗi request.
 *
 * File CSV format (5 cột):
 *   userId, documentId, rank, similarityScore, recommendationSource
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

export interface RecommendationEntry {
  documentId: string
  rank: number
  similarityScore: number
  recommendationSource: string
}

// Map: userId → danh sách gợi ý (tất cả đều là real document UUID)
const cache = new Map<string, RecommendationEntry[]>()
let loaded = false

function getCsvPath(): string {
  // Data_Train_HeGoiY_Now nằm cùng cấp với thư mục backend/
  return path.resolve(__dirname, '../../../../Data_Train_HeGoiY_Now/document_profile_recommendations_all_users.csv')
}

export async function loadRecommendationsCache(): Promise<void> {
  if (loaded) return

  const csvPath = getCsvPath()

  if (!fs.existsSync(csvPath)) {
    console.warn(`[Recommendations] CSV not found at: ${csvPath}`)
    loaded = true
    return
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })

    let isHeader = true
    let lineCount = 0

    rl.on('line', (line: string) => {
      if (isHeader) { isHeader = false; return }

      const parts = line.split(',')
      if (parts.length < 5) return

      const userId = parts[0]?.trim()
      const documentId = parts[1]?.trim()
      const rank = parseInt(parts[2] ?? '0', 10)
      const similarityScore = parseFloat(parts[3] ?? '0')
      const recommendationSource = parts[4]?.trim() ?? ''

      if (!userId || !documentId) return

      if (!cache.has(userId)) cache.set(userId, [])
      cache.get(userId)!.push({ documentId, rank, similarityScore, recommendationSource })
      lineCount++
    })

    rl.on('close', () => {
      loaded = true
      console.log(`[Recommendations] Loaded ${lineCount} entries for ${cache.size} users`)
      resolve()
    })

    rl.on('error', (err: Error) => {
      console.error('[Recommendations] Failed to load CSV:', err)
      loaded = true
      resolve() // non-fatal: server vẫn chạy bình thường
    })
  })
}

/**
 * Lấy top-N gợi ý cho user, đã sắp xếp theo rank tăng dần.
 * Trả về [] nếu user không có trong training data.
 */
export function getRecommendationsForUser(userId: string, limit = 10): RecommendationEntry[] {
  const entries = cache.get(userId) ?? []
  return entries
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
}

export function isRecommendationCacheReady(): boolean {
  return loaded
}
