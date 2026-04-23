/**
 * Neo4j Constraints & Indexes Setup — aligned with actual DB schema
 * Run: npm run db:migrate
 */
import { runQuery, verifyConnectivity } from '../config/neo4j'

async function migrate(): Promise<void> {
  await verifyConnectivity()
  console.log('🔄 Running migrations...')

  const constraints = [
    // Unique constraints — sử dụng đúng tên field của DB
    `CREATE CONSTRAINT user_email        IF NOT EXISTS FOR (u:User)         REQUIRE u.email          IS UNIQUE`,
    `CREATE CONSTRAINT user_userId       IF NOT EXISTS FOR (u:User)         REQUIRE u.userId         IS UNIQUE`,
    `CREATE CONSTRAINT post_postId       IF NOT EXISTS FOR (p:Post)         REQUIRE p.postId         IS UNIQUE`,
    `CREATE CONSTRAINT comment_commentId IF NOT EXISTS FOR (c:Comment)      REQUIRE c.commentId      IS UNIQUE`,
    `CREATE CONSTRAINT group_groupId     IF NOT EXISTS FOR (g:Group)        REQUIRE g.groupId        IS UNIQUE`,
    `CREATE CONSTRAINT conv_convId       IF NOT EXISTS FOR (c:Conversation) REQUIRE c.conversationId IS UNIQUE`,
    `CREATE CONSTRAINT msg_messageId     IF NOT EXISTS FOR (m:Message)      REQUIRE m.messageId      IS UNIQUE`,
    `CREATE CONSTRAINT notif_notifId     IF NOT EXISTS FOR (n:Notification) REQUIRE n.notificationId IS UNIQUE`,
    `CREATE CONSTRAINT report_reportId   IF NOT EXISTS FOR (r:Report)       REQUIRE r.reportId       IS UNIQUE`,
    `CREATE CONSTRAINT story_storyId     IF NOT EXISTS FOR (s:Story)        REQUIRE s.storyId        IS UNIQUE`,
    `CREATE CONSTRAINT document_documentId IF NOT EXISTS FOR (d:Document)   REQUIRE d.documentId     IS UNIQUE`,
  ]

  const indexes = [
    // Full-text search
    `CREATE FULLTEXT INDEX user_search  IF NOT EXISTS FOR (u:User)  ON EACH [u.displayName, u.email]`,
    `CREATE FULLTEXT INDEX post_search  IF NOT EXISTS FOR (p:Post)  ON EACH [p.content]`,
    `CREATE FULLTEXT INDEX group_search IF NOT EXISTS FOR (g:Group) ON EACH [g.name, g.description]`,
    // Range indexes
    `CREATE INDEX post_created   IF NOT EXISTS FOR (p:Post)         ON (p.createdAt)`,
    `CREATE INDEX user_status    IF NOT EXISTS FOR (u:User)         ON (u.status)`,
    `CREATE INDEX report_status  IF NOT EXISTS FOR (r:Report)       ON (r.status)`,
    `CREATE INDEX story_expires  IF NOT EXISTS FOR (s:Story)        ON (s.expiresAt)`,
    `CREATE INDEX story_active   IF NOT EXISTS FOR (s:Story)        ON (s.isActive)`,
    `CREATE INDEX msg_convId     IF NOT EXISTS FOR (m:Message)      ON (m.conversationId)`,
    `CREATE INDEX document_status IF NOT EXISTS FOR (d:Document)    ON (d.status)`,
    `CREATE INDEX document_visibility IF NOT EXISTS FOR (d:Document) ON (d.visibility)`,
    `CREATE INDEX document_created IF NOT EXISTS FOR (d:Document)   ON (d.createdAt)`,
    `CREATE INDEX document_views IF NOT EXISTS FOR (d:Document)     ON (d.viewsCount)`,
    `CREATE INDEX document_downloads IF NOT EXISTS FOR (d:Document) ON (d.downloadsCount)`,
    `CREATE FULLTEXT INDEX document_search IF NOT EXISTS FOR (d:Document) ON EACH [d.title, d.description, d.subject, d.school, d.major, d.cohort]`,
  ]

  for (const cypher of [...constraints, ...indexes]) {
    try {
      await runQuery(cypher)
      const label = cypher.match(/FOR \([a-z]:([\w]+)\)/)?.[1] ?? '?'
      console.log(`  ✅ ${label}`)
    } catch {
      console.warn(`  ⚠️  Skipped (already exists): ${cypher.slice(0, 70)}...`)
    }
  }

  console.log('✅ Migration complete')
  process.exit(0)
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
