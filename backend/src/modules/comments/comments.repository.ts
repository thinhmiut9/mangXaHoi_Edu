import { runQuery, runQueryOne } from '../../config/neo4j'
import { Comment, UserPublic } from '../../types'

export const commentsRepository = {
  async create(data: { commentId: string; content: string; postId: string; authorId: string; parentId?: string }): Promise<Comment> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ c: { properties: Comment } }>(
      `MATCH (u:User {userId: $authorId}), (p:Post {postId: $postId})
       CREATE (c:Comment {
         commentId: $commentId, content: $content,
         parentId: $parentId,
         createdAt: $now, updatedAt: $now
       })
       CREATE (u)-[:WROTE]->(c)
       CREATE (p)-[:HAS_COMMENT]->(c)
       RETURN c`,
      { ...data, parentId: data.parentId ?? null, now }
    )
    return result!.c.properties
  },

  async findByPost(postId: string, viewerId: string, skip = 0, limit = 20): Promise<Comment[]> {
    const results = await runQuery<{
      c: { properties: Comment }
      author: { properties: Record<string, unknown> }
      isLiked: boolean
      likesCount: number
    }>(
      `MATCH (p:Post {postId: $postId})-[:HAS_COMMENT]->(c:Comment)
       MATCH (u:User)-[:WROTE]->(c)
       OPTIONAL MATCH (viewer:User {userId: $viewerId})
       RETURN c, u AS author,
              EXISTS((viewer)-[:LIKED]->(c)) AS isLiked,
              COUNT { ()-[:LIKED]->(c) } AS likesCount
       ORDER BY c.createdAt ASC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { postId, viewerId, skip, limit }
    )
    return results.map(r => ({
      ...r.c.properties,
      postId,
      author: r.author.properties as unknown as UserPublic,
      isLiked: r.isLiked,
      likesCount: r.likesCount,
    }))
  },

  async update(commentId: string, content: string): Promise<Comment | null> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ c: { properties: Comment } }>(
      `MATCH (c:Comment {commentId: $commentId}) SET c.content = $content, c.updatedAt = $now RETURN c`,
      { commentId, content, now }
    )
    return result ? result.c.properties : null
  },

  async delete(commentId: string): Promise<void> {
    await runQuery(
      `MATCH (c:Comment)
       WHERE c.commentId = $commentId OR c.id = $commentId
       DETACH DELETE c`,
      { commentId }
    )
  },

  async toggleLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const result = await runQueryOne<{ liked: boolean; likesCount: number }>(
      `MATCH (u:User {userId: $userId}), (c:Comment {commentId: $commentId})
       OPTIONAL MATCH (u)-[existing:LIKED]->(c)
       WITH u, c, existing
       FOREACH (_ IN CASE WHEN existing IS NOT NULL THEN [1] ELSE [] END |
         DELETE existing
       )
       FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
         MERGE (u)-[:LIKED]->(c)
       )
       RETURN existing IS NULL AS liked, COUNT { ()-[:LIKED]->(c) } AS likesCount`,
      { commentId, userId }
    )
    return result ?? { liked: false, likesCount: 0 }
  },

  async isAuthor(commentId: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[:WROTE]->(c:Comment {commentId: $commentId}) RETURN true AS exists`,
      { commentId, userId }
    )
    return !!result?.exists
  },

  async getPostAuthorId(postId: string): Promise<string | null> {
    const result = await runQueryOne<{ authorId: string }>(
      `MATCH (u:User)-[:CREATED]->(p:Post {postId: $postId})
       RETURN u.userId AS authorId`,
      { postId }
    )
    return result?.authorId ?? null
  },

  async getCommentAuthorId(commentId: string): Promise<string | null> {
    const result = await runQueryOne<{ authorId: string }>(
      `MATCH (u:User)-[:WROTE]->(c:Comment)
       WHERE c.commentId = $commentId OR c.id = $commentId
       RETURN u.userId AS authorId`,
      { commentId }
    )
    return result?.authorId ?? null
  },
}


