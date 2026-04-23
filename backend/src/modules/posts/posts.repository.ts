import { runQuery, runQueryOne } from '../../config/neo4j'
import { Post, UserPublic } from '../../types'

function normalizeUserIdParam(userId: string): string {
  return userId.trim().replace(/\s+/g, '-')
}

export const postsRepository = {
  async create(data: {
    postId: string
    content: string
    mediaUrls?: string[]
    visibility: string
    authorId: string
    groupId?: string
  }): Promise<Post> {
    const now = new Date().toISOString()
    const mediaUrls = data.mediaUrls ?? []
    const result = await runQueryOne<{ p: { properties: Post } }>(
      `MATCH (u:User {userId: $authorId})
       CREATE (p:Post {
         postId: $postId, content: $content,
         mediaUrls: $mediaUrls,
         visibility: $visibility, groupId: $groupId,
         isPinned: false, pinnedAt: null,
         createdAt: $now, updatedAt: $now
       })<-[:CREATED]-(u)
       RETURN p`,
      { ...data, groupId: data.groupId ?? null, mediaUrls, now }
    )
    return result!.p.properties
  },

  async attachDocuments(postId: string, userId: string, documentUrls: string[]): Promise<void> {
    if (!documentUrls.length) return
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (p:Post {postId: $postId})
       MATCH (u:User {userId: $userId})
       UNWIND $documentUrls AS fileUrl
       WITH p, u, fileUrl, $now AS now,
            coalesce(last(split(split(fileUrl, '?')[0], '/')), 'document') AS fileName,
            toLower(coalesce(last(split(fileUrl, '.')), 'file')) AS ext
       CREATE (d:Document {
         documentId: randomUUID(),
         title: fileName,
         fileName: fileName,
         fileUrl: fileUrl,
         fileType: split(ext, '?')[0],
         createdAt: now,
         updatedAt: now
       })
       MERGE (u)-[:UPLOADED_DOCUMENT]->(d)
       MERGE (p)-[:HAS_DOCUMENT]->(d)`,
      { postId, userId, documentUrls, now }
    )
  },

  async findById(postId: string, viewerId?: string): Promise<Post | null> {
    const result = await runQueryOne<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
      isLiked: boolean
      isSaved: boolean
      isShared: boolean
      likesCount: number
      commentsCount: number
      sharesCount: number
    }>(
      `MATCH (p:Post {postId: $postId})<-[:CREATED]-(u:User)
       OPTIONAL MATCH (g:Group {groupId: p.groupId})
       OPTIONAL MATCH (viewer:User {userId: $viewerId})
       WITH p, u, g, viewer
       WHERE viewer IS NULL OR (
         NOT EXISTS((viewer)-[:BLOCKED]->(u)) AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
       )
       RETURN p,
               u AS author,
               [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls,
               g.name AS groupName,
               g.coverUrl AS groupCoverUrl,
               EXISTS((viewer)-[:LIKED]->(p)) AS isLiked,
               EXISTS((viewer)-[:SAVED]->(p)) AS isSaved,
               EXISTS((viewer)-[:SHARED]->(p)) AS isShared,
               COUNT { ()-[:LIKED]->(p) } AS likesCount,
               COUNT { (p)-[:HAS_COMMENT]->() } AS commentsCount,
               COUNT { ()-[:SHARED]->(p) } AS sharesCount`,
      { postId, viewerId: viewerId ?? '' }
    )
    if (!result) return null
    return {
      ...result.p.properties,
      documentUrls: result.documentUrls,
      author: result.author.properties as unknown as UserPublic,
      groupName: result.groupName ?? undefined,
      groupCoverUrl: result.groupCoverUrl ?? undefined,
      isLiked: result.isLiked,
      isSaved: result.isSaved,
      isShared: result.isShared,
      likesCount: result.likesCount,
      commentsCount: result.commentsCount,
      sharesCount: result.sharesCount,
    }
  },

  async getFeed(viewerId: string, skip = 0, limit = 10): Promise<Post[]> {
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
      isLiked: boolean
      isSaved: boolean
      isShared: boolean
      likesCount: number
      commentsCount: number
      sharesCount: number
    }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (p:Post)<-[:CREATED]-(u:User)
       OPTIONAL MATCH (g:Group {groupId: p.groupId})
       WITH viewer, p, u, g, coalesce(p.visibility, p.privacy, 'PUBLIC') AS postVisibility
      WHERE (
         NOT EXISTS((viewer)-[:BLOCKED]->(u))
         AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
       )
       AND (
         u.userId = $viewerId OR
         (
           postVisibility IN ['PUBLIC', 'FRIENDS'] AND
           EXISTS {
             MATCH (viewer)-[fr]-(u)
             WHERE type(fr) IN ['FRIENDS_WITH']
           }
         ) OR (
           postVisibility = 'GROUP'
           AND p.groupId IS NOT NULL
           AND p.groupId <> ''
           AND p.groupId <> 'null'
           AND EXISTS {
             MATCH (viewer)-[:MEMBER_OF]->(:Group {groupId: p.groupId})
           }
          )
       )
       RETURN p,
               u AS author,
               [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls,
               g.name AS groupName,
               g.coverUrl AS groupCoverUrl,
               EXISTS((viewer)-[:LIKED]->(p)) AS isLiked,
               EXISTS((viewer)-[:SAVED]->(p)) AS isSaved,
               EXISTS((viewer)-[:SHARED]->(p)) AS isShared,
               COUNT { ()-[:LIKED]->(p) } AS likesCount,
               COUNT { (p)-[:HAS_COMMENT]->() } AS commentsCount,
               COUNT { ()-[:SHARED]->(p) } AS sharesCount
       ORDER BY p.createdAt DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { viewerId, skip, limit }
    )
    return results.map(r => ({
      ...r.p.properties,
      documentUrls: r.documentUrls,
      author: r.author.properties as unknown as UserPublic,
      groupName: r.groupName ?? undefined,
      groupCoverUrl: r.groupCoverUrl ?? undefined,
      isLiked: r.isLiked,
      isSaved: r.isSaved,
      isShared: r.isShared,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      sharesCount: r.sharesCount,
    }))
  },

  async countFeed(viewerId: string): Promise<number> {
    const result = await runQueryOne<{ total: number }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (p:Post)<-[:CREATED]-(u:User)
       WITH viewer, p, u, coalesce(p.visibility, p.privacy, 'PUBLIC') AS postVisibility
      WHERE (
         NOT EXISTS((viewer)-[:BLOCKED]->(u))
         AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
       )
       AND (
         u.userId = $viewerId OR
         (
           postVisibility IN ['PUBLIC', 'FRIENDS'] AND
           EXISTS {
             MATCH (viewer)-[fr]-(u)
             WHERE type(fr) IN ['FRIENDS_WITH']
           }
         ) OR (
           postVisibility = 'GROUP'
           AND p.groupId IS NOT NULL
           AND p.groupId <> ''
           AND p.groupId <> 'null'
           AND EXISTS {
             MATCH (viewer)-[:MEMBER_OF]->(:Group {groupId: p.groupId})
           }
          )
       )
       RETURN count(p) AS total`,
      { viewerId }
    )
    return result?.total ?? 0
  },

  async getUserPosts(userId: string, viewerId: string, skip = 0, limit = 10): Promise<Post[]> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedViewerId = normalizeUserIdParam(viewerId)
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
      isLiked: boolean
      isSaved: boolean
      isShared: boolean
      likesCount: number
      commentsCount: number
      sharesCount: number
    }>(
      `MATCH (u:User)-[:CREATED]->(p:Post)
       MATCH (viewer:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(viewer.userId, '')), ' ', '-') = $viewerId
       OPTIONAL MATCH (g:Group {groupId: p.groupId})
       WITH u, p, viewer, g, coalesce(p.visibility, p.privacy, 'PUBLIC') AS postVisibility
       WHERE NOT EXISTS((viewer)-[:BLOCKED]->(u))
         AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
         AND (p.groupId IS NULL OR p.groupId = '' OR p.groupId = 'null')
         AND postVisibility <> 'GROUP'
         AND (
              postVisibility = 'PUBLIC'
          OR (postVisibility = 'FRIENDS' AND EXISTS {
               MATCH (viewer)-[fr]-(u)
               WHERE type(fr) IN ['FRIENDS_WITH']
             })
          OR $userId = $viewerId
         )
        RETURN p,
               u AS author,
               [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls,
               g.name AS groupName,
               g.coverUrl AS groupCoverUrl,
               EXISTS((viewer)-[:LIKED]->(p)) AS isLiked,
               EXISTS((viewer)-[:SAVED]->(p)) AS isSaved,
               EXISTS((viewer)-[:SHARED]->(p)) AS isShared,
               COUNT { ()-[:LIKED]->(p) } AS likesCount,
               COUNT { (p)-[:HAS_COMMENT]->() } AS commentsCount,
               COUNT { ()-[:SHARED]->(p) } AS sharesCount
       ORDER BY coalesce(p.isPinned, false) DESC, coalesce(p.pinnedAt, '') DESC, p.createdAt DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { userId: normalizedUserId, viewerId: normalizedViewerId, skip, limit }
    )
    return results.map(r => ({
      ...r.p.properties,
      documentUrls: r.documentUrls,
      author: r.author.properties as unknown as UserPublic,
      groupName: r.groupName ?? undefined,
      groupCoverUrl: r.groupCoverUrl ?? undefined,
      isLiked: r.isLiked,
      isSaved: r.isSaved,
      isShared: r.isShared,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      sharesCount: r.sharesCount,
    }))
  },

  async getGroupPosts(groupId: string, viewerId: string, skip = 0, limit = 10): Promise<Post[]> {
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
      isLiked: boolean
      isSaved: boolean
      isShared: boolean
      likesCount: number
      commentsCount: number
      sharesCount: number
    }>(
      `MATCH (viewer:User {userId: $viewerId})-[:MEMBER_OF]->(g:Group {groupId: $groupId})
       MATCH (u:User)-[:CREATED]->(p:Post)
       WHERE p.groupId = $groupId AND p.visibility = 'GROUP'
         AND NOT EXISTS((viewer)-[:BLOCKED]->(u))
         AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
       RETURN p,
              u AS author,
              [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls,
              g.name AS groupName,
              g.coverUrl AS groupCoverUrl,
              EXISTS((viewer)-[:LIKED]->(p)) AS isLiked,
              EXISTS((viewer)-[:SAVED]->(p)) AS isSaved,
              EXISTS((viewer)-[:SHARED]->(p)) AS isShared,
              COUNT { ()-[:LIKED]->(p) } AS likesCount,
              COUNT { (p)-[:HAS_COMMENT]->() } AS commentsCount,
              COUNT { ()-[:SHARED]->(p) } AS sharesCount
       ORDER BY p.createdAt DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { groupId, viewerId, skip, limit }
    )

    return results.map(r => ({
      ...r.p.properties,
      documentUrls: r.documentUrls,
      author: r.author.properties as unknown as UserPublic,
      groupName: r.groupName ?? undefined,
      groupCoverUrl: r.groupCoverUrl ?? undefined,
      isLiked: r.isLiked,
      isSaved: r.isSaved,
      isShared: r.isShared,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      sharesCount: r.sharesCount,
    }))
  },

  async update(
    postId: string,
    data: {
      content?: string
      mediaUrls?: string[]
      visibility?: string
    }
  ): Promise<Post | null> {
    const now = new Date().toISOString()
    const setClauses = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `p.${k} = $${k}`)
      .join(', ')

    const result = await runQueryOne<{ p: { properties: Post } }>(
      `MATCH (p:Post {postId: $postId}) SET ${setClauses}, p.updatedAt = $now RETURN p`,
      { postId, ...data, now }
    )
    return result ? result.p.properties : null
  },

  async delete(postId: string): Promise<void> {
    await runQuery(
      `MATCH (p:Post)
       WHERE p.postId = $postId OR p.id = $postId
       DETACH DELETE p`,
      { postId }
    )
  },

  async getMediaUrls(postId: string): Promise<string[]> {
    const result = await runQueryOne<{
      mediaUrls: string[] | null
      documentUrls: string[] | null
    }>(
      `MATCH (p:Post)
       WHERE p.postId = $postId OR p.id = $postId
       RETURN p.mediaUrls AS mediaUrls, [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls`,
      { postId }
    )

    const values = [
      ...(Array.isArray(result?.mediaUrls) ? result.mediaUrls : []),
      ...(Array.isArray(result?.documentUrls) ? result.documentUrls : []),
    ]
    return Array.from(
      new Set(values.filter((url): url is string => typeof url === 'string' && url.trim().length > 0))
    )
  },

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const result = await runQueryOne<{ liked: boolean; likesCount: number }>(
      `MATCH (u:User {userId: $userId}), (p:Post {postId: $postId})
       OPTIONAL MATCH (u)-[existing:LIKED]->(p)
       WITH u, p, existing
       FOREACH (_ IN CASE WHEN existing IS NOT NULL THEN [1] ELSE [] END |
         DELETE existing
       )
       FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
         MERGE (u)-[r:LIKED]->(p)
         ON CREATE SET r.createdAt = $now
       )
       RETURN existing IS NULL AS liked, COUNT { ()-[:LIKED]->(p) } AS likesCount`,
      { postId, userId, now: new Date().toISOString() }
    )
    return result ?? { liked: false, likesCount: 0 }
  },

  async getReactions(postId: string): Promise<UserPublic[]> {
    const results = await runQuery<{ user: { properties: Record<string, unknown> } }>(
      `MATCH (u:User)-[:LIKED]->(p:Post {postId: $postId})
       RETURN u AS user
       ORDER BY u.displayName ASC`,
      { postId }
    )
    return results.map(r => r.user.properties as unknown as UserPublic)
  },

  async toggleSave(postId: string, userId: string): Promise<{ saved: boolean }> {
    const result = await runQueryOne<{ saved: boolean }>(
      `MATCH (u:User {userId: $userId}), (p:Post {postId: $postId})
       OPTIONAL MATCH (u)-[existing:SAVED]->(p)
       WITH u, p, existing
       FOREACH (_ IN CASE WHEN existing IS NOT NULL THEN [1] ELSE [] END |
         DELETE existing
       )
       FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
         MERGE (u)-[:SAVED]->(p)
       )
       RETURN existing IS NULL AS saved`,
      { postId, userId }
    )
    return result ?? { saved: false }
  },

  async togglePin(postId: string, userId: string): Promise<{ pinned: boolean }> {
    const now = new Date().toISOString()
    const row = await runQueryOne<{ currentlyPinned: boolean }>(
      `MATCH (:User {userId: $userId})-[:CREATED]->(p:Post {postId: $postId})
       WHERE p.groupId IS NULL OR p.groupId = '' OR p.groupId = 'null'
       RETURN coalesce(p.isPinned, false) AS currentlyPinned`,
      { postId, userId }
    )
    if (!row) return { pinned: false }

    if (row.currentlyPinned) {
      await runQuery(
        `MATCH (:User {userId: $userId})-[:CREATED]->(p:Post {postId: $postId})
         SET p.isPinned = false,
             p.pinnedAt = null,
             p.updatedAt = $now`,
        { postId, userId, now }
      )
      return { pinned: false }
    }

    await runQuery(
      `MATCH (:User {userId: $userId})-[:CREATED]->(p:Post)
       WHERE coalesce(p.isPinned, false) = true
       SET p.isPinned = false,
           p.pinnedAt = null,
           p.updatedAt = $now`,
      { userId, now }
    )

    await runQuery(
      `MATCH (:User {userId: $userId})-[:CREATED]->(p:Post {postId: $postId})
       SET p.isPinned = true,
           p.pinnedAt = $now,
           p.updatedAt = $now`,
      { postId, userId, now }
    )

    return { pinned: true }
  },

  async sharePost(postId: string, userId: string, sharedPostId: string, caption?: string, visibility?: string): Promise<{ shared: boolean; sharesCount: number }> {
    const shareCaption = caption ?? ''
    const shareVisibility = visibility ?? 'PUBLIC'
    const result = await runQueryOne<{ shared: boolean; sharesCount: number }>(
      `MATCH (u:User {userId: $userId})
       MATCH (:User)-[:CREATED]->(p:Post {postId: $postId})
       WITH u, p, EXISTS((u)-[:SHARED]->(p)) AS alreadyShared
       FOREACH (_ IN CASE WHEN NOT alreadyShared THEN [1] ELSE [] END |
         CREATE (sp:Post {
           postId: $sharedPostId,
           content: $shareCaption,
           mediaUrls: [],
           visibility: $shareVisibility,
           groupId: null,
           sharedFromPostId: p.postId,
           isPinned: false,
           pinnedAt: null,
           createdAt: $now,
           updatedAt: $now
         })
         CREATE (u)-[:CREATED]->(sp)
         MERGE (u)-[s:SHARED]->(p)
         ON CREATE SET s.createdAt = $now
       )
       RETURN NOT alreadyShared AS shared, COUNT { ()-[:SHARED]->(p) } AS sharesCount`,
      { postId, userId, sharedPostId, shareCaption, shareVisibility, now: new Date().toISOString() }
    )
    return result ?? { shared: false, sharesCount: 0 }
  },

  async getSavedPosts(userId: string, skip = 0, limit = 10): Promise<Post[]> {
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
    }>(
      `MATCH (u:User {userId: $userId})-[:SAVED]->(p:Post)<-[:CREATED]-(author:User)
       OPTIONAL MATCH (g:Group {groupId: p.groupId})
       RETURN p, author, [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls, g.name AS groupName, g.coverUrl AS groupCoverUrl
       ORDER BY p.createdAt DESC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { userId, skip, limit }
    )
    return results.map(r => ({
      ...r.p.properties,
      documentUrls: r.documentUrls,
      author: r.author.properties as unknown as UserPublic,
      groupName: r.groupName ?? undefined,
      groupCoverUrl: r.groupCoverUrl ?? undefined,
      isSaved: true,
    }))
  },

  async isAuthor(postId: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[:CREATED]->(p:Post {postId: $postId}) RETURN true AS exists`,
      { postId, userId }
    )
    return !!result?.exists
  },

  async countTotal(): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (p:Post) RETURN count(p) AS count`, {}
    )
    return result?.count ?? 0
  },

  async findManyByIds(postIds: string[]): Promise<Record<string, Post>> {
    if (!postIds.length) return {}
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
    }>(
      `MATCH (p:Post)<-[:CREATED]-(u:User)
       WHERE p.postId IN $postIds
       RETURN p, u AS author, [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls`,
      { postIds }
    )
    const map: Record<string, Post> = {}
    for (const r of results) {
      const post = {
        ...r.p.properties,
        documentUrls: r.documentUrls,
        author: r.author.properties as unknown as UserPublic,
      }
      map[post.postId] = post
    }
    return map
  },

  async getAuthorId(postId: string): Promise<string | null> {
    const result = await runQueryOne<{ authorId: string }>(
      `MATCH (u:User)-[:CREATED]->(p:Post)
       WHERE p.postId = $postId OR p.id = $postId
       RETURN u.userId AS authorId`,
      { postId }
    )
    return result?.authorId ?? null
  },

  async searchVisiblePosts(viewerId: string, keyword: string, limit = 12): Promise<Post[]> {
    const results = await runQuery<{
      p: { properties: Post }
      author: { properties: Record<string, unknown> }
      documentUrls: string[]
      groupName: string | null
      groupCoverUrl: string | null
      isLiked: boolean
      isSaved: boolean
      isShared: boolean
      likesCount: number
      commentsCount: number
      sharesCount: number
    }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (p:Post)<-[:CREATED]-(u:User)
       OPTIONAL MATCH (g:Group {groupId: p.groupId})
       WITH viewer, p, u, g, coalesce(p.visibility, p.privacy, 'PUBLIC') AS postVisibility
      WHERE toLower(coalesce(p.content, '')) CONTAINS toLower($keyword)
        AND NOT EXISTS((viewer)-[:BLOCKED]->(u))
        AND NOT EXISTS((u)-[:BLOCKED]->(viewer))
         AND (
           u.userId = $viewerId
           OR (
             postVisibility IN ['PUBLIC', 'FRIENDS']
             AND EXISTS {
               MATCH (viewer)-[fr]-(u)
               WHERE type(fr) IN ['FRIENDS_WITH']
             }
           )
           OR (
             postVisibility = 'GROUP'
             AND p.groupId IS NOT NULL
             AND p.groupId <> ''
             AND p.groupId <> 'null'
             AND EXISTS {
               MATCH (viewer)-[:MEMBER_OF]->(:Group {groupId: p.groupId})
             }
           )
         )
       RETURN p,
              u AS author,
              [(p)-[:HAS_DOCUMENT]->(d:Document) | d.fileUrl] AS documentUrls,
              g.name AS groupName,
              g.coverUrl AS groupCoverUrl,
              EXISTS((viewer)-[:LIKED]->(p)) AS isLiked,
              EXISTS((viewer)-[:SAVED]->(p)) AS isSaved,
              EXISTS((viewer)-[:SHARED]->(p)) AS isShared,
              COUNT { ()-[:LIKED]->(p) } AS likesCount,
              COUNT { (p)-[:HAS_COMMENT]->() } AS commentsCount,
              COUNT { ()-[:SHARED]->(p) } AS sharesCount
       ORDER BY p.createdAt DESC
       LIMIT toInteger($limit)`,
      { viewerId, keyword, limit }
    )

    return results.map(r => ({
      ...r.p.properties,
      documentUrls: r.documentUrls,
      author: r.author.properties as unknown as UserPublic,
      groupName: r.groupName ?? undefined,
      groupCoverUrl: r.groupCoverUrl ?? undefined,
      isLiked: r.isLiked,
      isSaved: r.isSaved,
      isShared: r.isShared,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      sharesCount: r.sharesCount,
    }))
  },
}



