import { runQuery, runQueryOne } from '../../config/neo4j'
import { Report, UserPublic } from '../../types'
import { v4 as uuidv4 } from 'uuid'

export const reportsRepository = {
  async create(data: {
    reporterId: string
    targetId: string
    targetType: string
    reason: string
    description?: string
  }): Promise<Report> {
    const now = new Date().toISOString()
    const reportId = uuidv4()
    const result = await runQueryOne<{ r: { properties: Report } }>(
      `MATCH (reporter:User {userId: $reporterId})
       OPTIONAL MATCH (postTarget:Post)
         WHERE postTarget.postId = $targetId OR postTarget.id = $targetId
       OPTIONAL MATCH (commentTarget:Comment)
         WHERE commentTarget.commentId = $targetId OR commentTarget.id = $targetId
       OPTIONAL MATCH (userTarget:User {userId: $targetId})
       OPTIONAL MATCH (groupTarget:Group {groupId: $targetId})
       CREATE (r:Report {
         reportId: $reportId, reason: $reason, description: $description,
         status: 'OPEN', targetId: $targetId, targetType: $targetType, createdAt: $now
       })
       CREATE (reporter)-[:REPORTED]->(r)
       FOREACH (_ IN CASE WHEN $targetType = 'POST' AND postTarget IS NOT NULL THEN [1] ELSE [] END |
         CREATE (r)-[:TARGETS]->(postTarget)
       )
       FOREACH (_ IN CASE WHEN $targetType = 'COMMENT' AND commentTarget IS NOT NULL THEN [1] ELSE [] END |
         CREATE (r)-[:TARGETS]->(commentTarget)
       )
       FOREACH (_ IN CASE WHEN $targetType = 'USER' AND userTarget IS NOT NULL THEN [1] ELSE [] END |
         CREATE (r)-[:TARGETS]->(userTarget)
       )
       FOREACH (_ IN CASE WHEN $targetType = 'GROUP' AND groupTarget IS NOT NULL THEN [1] ELSE [] END |
         CREATE (r)-[:TARGETS]->(groupTarget)
       )
       RETURN r`,
      { reportId, ...data, description: data.description ?? null, now }
    )
    return result!.r.properties
  },

  async list(status?: string, skip = 0, limit = 20): Promise<Report[]> {
    const whereClause = status ? `WHERE r.status = $status` : ''
    const results = await runQuery<{
      r: Report
      reporter: Record<string, unknown> | null
      target: Record<string, unknown> | null
    }>(
      `MATCH (r:Report) ${whereClause}
       OPTIONAL MATCH (reporter:User)-[:REPORTED]->(r)
       OPTIONAL MATCH (r)-[:TARGETS]->(targetNodeByRel)
       WITH r, reporter, targetNodeByRel, coalesce(r.targetType, '') AS reportTargetType, coalesce(r.targetId, '') AS reportTargetId
       OPTIONAL MATCH (postTarget:Post)
         WHERE toUpper(reportTargetType) = 'POST' AND (postTarget.postId = reportTargetId OR postTarget.id = reportTargetId)
       OPTIONAL MATCH (commentTarget:Comment)
         WHERE toUpper(reportTargetType) = 'COMMENT' AND (commentTarget.commentId = reportTargetId OR commentTarget.id = reportTargetId)
       OPTIONAL MATCH (userTarget:User {userId: reportTargetId})
         WHERE toUpper(reportTargetType) = 'USER'
       OPTIONAL MATCH (groupTarget:Group {groupId: reportTargetId})
         WHERE toUpper(reportTargetType) = 'GROUP'
       WITH r, reporter, reportTargetType, reportTargetId, coalesce(targetNodeByRel, postTarget, commentTarget, userTarget, groupTarget) AS targetNode
       OPTIONAL MATCH (targetAuthor:User)-[authorRel]->(targetNode)
         WHERE type(authorRel) IN ['CREATED', 'WROTE']
       OPTIONAL MATCH (targetGroup:Group {groupId: targetNode.groupId})
       RETURN r {
         .*,
         reportId: coalesce(r.reportId, r.id, ''),
         targetId: coalesce(r.targetId, targetNode.postId, targetNode.commentId, targetNode.userId, targetNode.groupId, targetNode.id, ''),
         targetType: CASE
           WHEN toUpper(reportTargetType) <> '' THEN toUpper(reportTargetType)
           WHEN targetNode:Post THEN 'POST'
           WHEN targetNode:Comment THEN 'COMMENT'
           WHEN targetNode:User THEN 'USER'
           WHEN targetNode:Group THEN 'GROUP'
           ELSE ''
         END,
         createdAt: coalesce(toString(r.createdAt), ''),
         resolvedAt: coalesce(toString(r.resolvedAt), '')
       } AS r,
       reporter {
         .userId, .email, .displayName, .avatarUrl, .status, .role
       } AS reporter,
       CASE
         WHEN targetNode IS NULL THEN null
         ELSE {
           targetId: coalesce(r.targetId, targetNode.postId, targetNode.commentId, targetNode.userId, targetNode.groupId, targetNode.id, ''),
           targetType: CASE
             WHEN toUpper(reportTargetType) <> '' THEN toUpper(reportTargetType)
             WHEN targetNode:Post THEN 'POST'
             WHEN targetNode:Comment THEN 'COMMENT'
             WHEN targetNode:User THEN 'USER'
             WHEN targetNode:Group THEN 'GROUP'
             ELSE ''
           END,
           content: coalesce(targetNode.content, targetNode.description, ''),
           name: coalesce(targetNode.name, targetNode.displayName, ''),
           avatarUrl: targetNode.avatarUrl,
           mediaUrls: coalesce(targetNode.mediaUrls, []),
           visibility: coalesce(targetNode.visibility, targetNode.privacy, ''),
           createdAt: coalesce(toString(targetNode.createdAt), ''),
           author: CASE
             WHEN targetAuthor IS NULL THEN null
             ELSE targetAuthor { .userId, .email, .displayName, .avatarUrl, .status, .role, createdAt: coalesce(toString(targetAuthor.createdAt), '') }
           END,
           group: CASE
             WHEN targetGroup IS NULL THEN null
             ELSE targetGroup { .groupId, .name, .coverUrl }
           END
         }
       END AS target
       ORDER BY coalesce(toString(r.createdAt), '') DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { status: status ?? null, skip, limit }
    )
    return results.map(r => ({
      ...r.r,
      reporter: r.reporter as unknown as UserPublic | undefined,
      target: r.target as Report['target'],
    }))
  },

  async getById(reportId: string): Promise<Report | null> {
    const result = await runQueryOne<{
      r: Report
      reporter: Record<string, unknown> | null
      target: Record<string, unknown> | null
    }>(
      `MATCH (r:Report)
       WHERE r.reportId = $reportId OR r.id = $reportId
       OPTIONAL MATCH (reporter:User)-[:REPORTED]->(r)
       WITH r, reporter, coalesce(r.targetType, '') AS reportTargetType, coalesce(r.targetId, '') AS reportTargetId
       OPTIONAL MATCH (r)-[:TARGETS]->(linkedTarget)
       OPTIONAL MATCH (postTarget:Post)
         WHERE toUpper(reportTargetType) = 'POST' AND (postTarget.postId = reportTargetId OR postTarget.id = reportTargetId)
       OPTIONAL MATCH (commentTarget:Comment)
         WHERE toUpper(reportTargetType) = 'COMMENT' AND (commentTarget.commentId = reportTargetId OR commentTarget.id = reportTargetId)
       OPTIONAL MATCH (userTarget:User {userId: reportTargetId})
         WHERE toUpper(reportTargetType) = 'USER'
       OPTIONAL MATCH (groupTarget:Group {groupId: reportTargetId})
         WHERE toUpper(reportTargetType) = 'GROUP'
       WITH r, reporter, reportTargetType, reportTargetId, coalesce(linkedTarget, postTarget, commentTarget, userTarget, groupTarget) AS targetNode
       OPTIONAL MATCH (targetAuthor:User)-[authorRel]->(targetNode)
         WHERE type(authorRel) IN ['CREATED', 'WROTE']
       OPTIONAL MATCH (targetGroup:Group {groupId: targetNode.groupId})
       RETURN r {
         .*,
         reportId: coalesce(r.reportId, r.id, ''),
         targetId: coalesce(r.targetId, reportTargetId, targetNode.postId, targetNode.commentId, targetNode.userId, targetNode.groupId, targetNode.id, ''),
         targetType: CASE
           WHEN toUpper(reportTargetType) <> '' THEN toUpper(reportTargetType)
           WHEN targetNode:Post THEN 'POST'
           WHEN targetNode:Comment THEN 'COMMENT'
           WHEN targetNode:User THEN 'USER'
           WHEN targetNode:Group THEN 'GROUP'
           ELSE ''
         END,
         createdAt: coalesce(toString(r.createdAt), ''),
         resolvedAt: coalesce(toString(r.resolvedAt), '')
       } AS r,
       reporter { .userId, .email, .displayName, .avatarUrl, .status, .role } AS reporter,
       CASE
         WHEN targetNode IS NULL THEN null
         ELSE {
           targetId: coalesce(r.targetId, targetNode.postId, targetNode.commentId, targetNode.userId, targetNode.groupId, targetNode.id, ''),
           targetType: CASE
             WHEN toUpper(reportTargetType) <> '' THEN toUpper(reportTargetType)
             WHEN targetNode:Post THEN 'POST'
             WHEN targetNode:Comment THEN 'COMMENT'
             WHEN targetNode:User THEN 'USER'
             WHEN targetNode:Group THEN 'GROUP'
             ELSE ''
           END,
           content: coalesce(targetNode.content, targetNode.description, ''),
           name: coalesce(targetNode.name, targetNode.displayName, ''),
           avatarUrl: targetNode.avatarUrl,
           mediaUrls: coalesce(targetNode.mediaUrls, []),
           visibility: coalesce(targetNode.visibility, targetNode.privacy, ''),
           createdAt: coalesce(toString(targetNode.createdAt), ''),
           author: CASE
             WHEN targetAuthor IS NULL THEN null
             ELSE targetAuthor { .userId, .email, .displayName, .avatarUrl, .status, .role, createdAt: coalesce(toString(targetAuthor.createdAt), '') }
           END,
           group: CASE
             WHEN targetGroup IS NULL THEN null
             ELSE targetGroup { .groupId, .name, .coverUrl }
           END
         }
       END AS target`,
      { reportId }
    )

    if (!result) return null
    return {
      ...result.r,
      reporter: result.reporter as unknown as UserPublic | undefined,
      target: result.target as Report['target'],
    }
  },

  async updateStatus(
    reportId: string,
    status: string,
    options?: { resolvedBy?: string; action?: string; note?: string }
  ): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (r:Report)
       WHERE r.reportId = $reportId OR r.id = $reportId
       SET r.status = $status,
           r.resolvedAt = CASE WHEN $status = 'RESOLVED' THEN $now ELSE null END,
           r.resolvedBy = CASE WHEN $status = 'RESOLVED' OR $status = 'REJECTED' THEN $resolvedBy ELSE null END,
           r.moderationAction = CASE WHEN $status = 'RESOLVED' THEN $action ELSE null END,
           r.moderationNote = CASE WHEN $status = 'RESOLVED' OR $status = 'REJECTED' THEN $note ELSE null END`,
      {
        reportId,
        status,
        now,
        resolvedBy: options?.resolvedBy ?? null,
        action: options?.action ?? null,
        note: options?.note ?? null,
      }
    )
  },

  async count(status?: string): Promise<number> {
    const whereClause = status ? `WHERE r.status = $status` : ''
    const result = await runQueryOne<{ count: number }>(
      `MATCH (r:Report) ${whereClause} RETURN count(r) AS count`,
      { status: status ?? null }
    )
    return result?.count ?? 0
  },
}


