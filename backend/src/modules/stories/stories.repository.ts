import { runQuery, runQueryOne } from '../../config/neo4j'
import { Story, UserPublic } from '../../types'

export type StoryWithAuthor = Story & {
  author: UserPublic
  isViewed?: boolean
}

export type StoryViewer = {
  viewer: UserPublic
  viewedAt: string
}

export const storiesRepository = {
  async deactivateExpired(now: string): Promise<void> {
    await runQuery(
      `MATCH (s:Story)
       WHERE s.isActive = true AND s.expiresAt <= $now
       SET s.isActive = false`,
      { now }
    )
  },

  async create(data: {
    storyId: string
    type: 'IMAGE' | 'VIDEO'
    mediaUrl: string
    content?: string
    userId: string
    createdAt: string
    expiresAt: string
  }): Promise<StoryWithAuthor> {
    const result = await runQueryOne<{
      s: { properties: Story }
      author: { properties: Record<string, unknown> }
    }>(
      `MATCH (u:User {userId: $userId})
       CREATE (s:Story {
         storyId: $storyId,
         type: $type,
         mediaUrl: $mediaUrl,
         content: $content,
         createdAt: $createdAt,
         expiresAt: $expiresAt,
         isActive: true
       })
       CREATE (u)-[:CREATED_STORY {createdAt: $createdAt}]->(s)
       RETURN s, u AS author`,
      data
    )

    return {
      ...(result!.s.properties),
      author: result!.author.properties as unknown as UserPublic,
    }
  },

  async getFeed(viewerId: string, now: string): Promise<StoryWithAuthor[]> {
    const results = await runQuery<{
      s: { properties: Story }
      author: { properties: Record<string, unknown> }
      isViewed: boolean
    }>(
      `MATCH (viewer:User {userId: $viewerId})
       OPTIONAL MATCH (viewer)-[fr]-(friend:User)
       WHERE type(fr) IN ['FRIENDS_WITH', 'FRIEND_WITH']
       WITH viewer, collect(friend.userId) + [viewer.userId] AS visibleUserIds
       MATCH (author:User)-[:CREATED_STORY]->(s:Story)
       WHERE author.userId IN visibleUserIds
         AND s.isActive = true
         AND s.expiresAt > $now
       RETURN s,
              author,
              EXISTS((viewer)-[:VIEWED_STORY]->(s)) AS isViewed
       ORDER BY s.createdAt DESC`,
      { viewerId, now }
    )

    return results.map(r => ({
      ...r.s.properties,
      author: r.author.properties as unknown as UserPublic,
      isViewed: r.isViewed,
    }))
  },

  async findVisibleById(storyId: string, viewerId: string, now: string): Promise<StoryWithAuthor | null> {
    const result = await runQueryOne<{
      s: { properties: Story }
      author: { properties: Record<string, unknown> }
      isViewed: boolean
    }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (author:User)-[:CREATED_STORY]->(s:Story {storyId: $storyId})
       WHERE s.isActive = true
         AND s.expiresAt > $now
         AND (
           author.userId = $viewerId OR
           EXISTS {
             MATCH (viewer)-[fr]-(author)
             WHERE type(fr) IN ['FRIENDS_WITH', 'FRIEND_WITH']
           }
         )
       RETURN s,
              author,
              EXISTS((viewer)-[:VIEWED_STORY]->(s)) AS isViewed`,
      { storyId, viewerId, now }
    )

    if (!result) return null
    return {
      ...result.s.properties,
      author: result.author.properties as unknown as UserPublic,
      isViewed: result.isViewed,
    }
  },

  async markViewed(storyId: string, viewerId: string, at: string): Promise<void> {
    await runQuery(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (s:Story {storyId: $storyId})
       MERGE (viewer)-[r:VIEWED_STORY]->(s)
       ON CREATE SET r.at = $at`,
      { storyId, viewerId, at }
    )
  },

  async getViewers(storyId: string): Promise<StoryViewer[]> {
    const results = await runQuery<{
      viewer: { properties: Record<string, unknown> }
      viewedAt: string
    }>(
      `MATCH (author:User)-[:CREATED_STORY]->(s:Story {storyId: $storyId})
       MATCH (viewer:User)-[r:VIEWED_STORY]->(s)
       WHERE viewer.userId <> author.userId
       RETURN viewer, r.at AS viewedAt
       ORDER BY r.at DESC`,
      { storyId }
    )

    return results.map(r => ({
      viewer: r.viewer.properties as unknown as UserPublic,
      viewedAt: r.viewedAt,
    }))
  },
}
