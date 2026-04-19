import { runQuery } from '../config/neo4j'

/**
 * Parse all mention tokens from content.
 * Format: @[DisplayName](userId)
 * Returns array of unique userIds mentioned.
 */
export function extractMentionTokens(content: string): { displayName: string; userId: string }[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const results: { displayName: string; userId: string }[] = []
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const displayName = match[1]
    const userId = match[2]
    if (!seen.has(userId)) {
      seen.add(userId)
      results.push({ displayName, userId })
    }
  }
  return results
}

/**
 * Extract unique userIds that are mentioned in content.
 * Validates they exist in DB to avoid spurious notifications.
 */
export async function extractMentionedUserIds(content: string): Promise<string[]> {
  const tokens = extractMentionTokens(content)
  if (tokens.length === 0) return []

  const userIds = tokens.map(t => t.userId)

  // Validate that these users actually exist in the DB
  const results = await runQuery<{ userId: string }>(
    `MATCH (u:User) WHERE u.userId IN $userIds AND u.status = 'ACTIVE'
     RETURN u.userId AS userId`,
    { userIds }
  )

  return results.map(r => r.userId)
}
