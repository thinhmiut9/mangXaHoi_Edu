import fs from 'fs'
import path from 'path'

export interface RecommendationEntry {
  recommendedUserId: string
  rank: number
  similarityScore: number
}

type RecommendationMap = Map<string, RecommendationEntry[]>

class RecommendationFileService {
  private cache: RecommendationMap | null = null
  private cacheKey: string | null = null

  private resolveFilePath(): string {
    const configuredPath = process.env.NODE2VEC_RECOMMENDATIONS_FILE?.trim()
    if (configuredPath) {
      return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '../../../..', configuredPath)
    }

    return path.resolve(__dirname, '../../../../', 'Data_Train_HeGoiY_Now', 'node2vec_recommendations_all_users.csv')
  }

  private buildCache(filePath: string): RecommendationMap {
    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    const map: RecommendationMap = new Map()

    for (let i = 1; i < lines.length; i += 1) {
      const [userId, recommendedUserId, rankText, scoreText] = lines[i].split(',')
      if (!userId || !recommendedUserId) continue

      const entries = map.get(userId) ?? []
      entries.push({
        recommendedUserId,
        rank: Number(rankText) || entries.length + 1,
        similarityScore: Number(scoreText) || 0,
      })
      map.set(userId, entries)
    }

    for (const [, entries] of map) {
      entries.sort((a, b) => a.rank - b.rank || b.similarityScore - a.similarityScore)
    }

    return map
  }

  private load(): RecommendationMap | null {
    const filePath = this.resolveFilePath()
    if (!fs.existsSync(filePath)) return null

    const stat = fs.statSync(filePath)
    const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`
    if (this.cache && this.cacheKey === cacheKey) {
      return this.cache
    }

    this.cache = this.buildCache(filePath)
    this.cacheKey = cacheKey
    return this.cache
  }

  getRecommendations(userId: string): RecommendationEntry[] {
    const cache = this.load()
    if (!cache) return []
    return cache.get(userId) ?? []
  }

  hasData(): boolean {
    return this.getRecommendations('__nonexistent__').length > -1 && this.load() !== null
  }
}

export const recommendationFileService = new RecommendationFileService()
