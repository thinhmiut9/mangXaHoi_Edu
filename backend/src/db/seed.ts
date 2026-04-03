/**
 * Database Seed Script
 * Run: npm run db:seed
 * Creates: 1 admin user, 5 regular users, sample posts, friendships, groups
 */
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { runQuery } from '../config/neo4j'
import { verifyConnectivity, closeDriver } from '../config/neo4j'

const SALT_ROUNDS = 12

async function seed(): Promise<void> {
  await verifyConnectivity()
  console.log('🌱 Starting seed...')

  // Clear existing data (optional in dev)
  await runQuery(`MATCH (n) DETACH DELETE n`)
  console.log('  🗑️  Cleared existing data')

  const now = new Date().toISOString()
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS)
  const userPassword = await bcrypt.hash('User@1234', SALT_ROUNDS)

  // Create admin
  const adminId = uuidv4()
  await runQuery(
    `CREATE (u:User {
      id: $id, email: $email, username: $username, displayName: $displayName,
      passwordHash: $passwordHash, role: 'ADMIN', status: 'ACTIVE',
      bio: $bio, createdAt: $now, updatedAt: $now
    })`,
    {
      id: adminId,
      email: 'admin@edusocial.app',
      username: 'admin',
      displayName: 'Quản trị viên',
      passwordHash: adminPassword,
      bio: 'EduSocial Administrator',
      now,
    }
  )
  console.log('  ✅ Admin created: admin@edusocial.app / Admin@123')

  // Create sample users
  const sampleUsers = [
    { email: 'alice@example.com', username: 'alice_nguyen', displayName: 'Alice Nguyễn', bio: 'Sinh viên năm 3 CNTT 💻' },
    { email: 'bob@example.com', username: 'bob_tran', displayName: 'Bob Trần', bio: 'Yêu thích lập trình và cà phê ☕' },
    { email: 'charlie@example.com', username: 'charlie_le', displayName: 'Charlie Lê', bio: 'Học máy & AI enthusiast 🤖' },
    { email: 'diana@example.com', username: 'diana_pham', displayName: 'Diana Phạm', bio: 'Designer & Frontend developer 🎨' },
    { email: 'evan@example.com', username: 'evan_hoang', displayName: 'Evan Hoàng', bio: 'Backend developer | Node.js lover' },
  ]

  const userIds: string[] = []
  for (const u of sampleUsers) {
    const id = uuidv4()
    userIds.push(id)
    await runQuery(
      `CREATE (u:User {
        id: $id, email: $email, username: $username, displayName: $displayName,
        passwordHash: $passwordHash, role: 'USER', status: 'ACTIVE',
        bio: $bio, createdAt: $now, updatedAt: $now
      })`,
      { id, passwordHash: userPassword, now, ...u }
    )
    console.log(`  ✅ User: ${u.email} / User@1234`)
  }

  // Create friendships
  const friendPairs = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]]
  for (const [i, j] of friendPairs) {
    await runQuery(
      `MATCH (a:User {id: $a}), (b:User {id: $b})
       MERGE (a)-[:FRIENDS_WITH {since: $now}]-(b)`,
      { a: userIds[i], b: userIds[j], now }
    )
  }
  console.log('  ✅ Friendships created')

  // Create sample posts
  const samplePosts = [
    { authorIdx: 0, content: 'Chào mọi người! Mình vừa tham gia EduSocial. Rất vui được kết nối với các bạn yêu thích học tập! 🎉', privacy: 'PUBLIC' },
    { authorIdx: 1, content: 'Vừa hoàn thành khóa học Node.js nâng cao. Cảm giác thật tuyệt! Ai muốn học cùng không? 💡', privacy: 'PUBLIC' },
    { authorIdx: 2, content: 'Chia sẻ một số tài liệu về Machine Learning cho mọi người. Link trong comment nhé! 📚', privacy: 'FRIENDS' },
    { authorIdx: 3, content: 'Thiết kế UI cho ứng dụng mobile xong rồi. Feedback nhé mọi người! ✨', privacy: 'PUBLIC' },
  ]

  const postIds: string[] = []
  for (const p of samplePosts) {
    const id = uuidv4()
    postIds.push(id)
    await runQuery(
      `MATCH (u:User {id: $authorId})
       CREATE (p:Post {
         id: $id, content: $content, images: [], privacy: $privacy,
         authorId: $authorId, groupId: null,
         likesCount: 0, commentsCount: 0, sharesCount: 0,
         createdAt: $now, updatedAt: $now
       })<-[:HAS_POST]-(u)`,
      { id, authorId: userIds[p.authorIdx], content: p.content, privacy: p.privacy, now }
    )
  }
  console.log('  ✅ Posts created')

  // Add some likes
  await runQuery(
    `MATCH (u:User {id: $userId}), (p:Post {id: $postId})
     MERGE (u)-[:LIKED]->(p) SET p.likesCount = p.likesCount + 1`,
    { userId: userIds[1], postId: postIds[0] }
  )
  await runQuery(
    `MATCH (u:User {id: $userId}), (p:Post {id: $postId})
     MERGE (u)-[:LIKED]->(p) SET p.likesCount = p.likesCount + 1`,
    { userId: userIds[2], postId: postIds[0] }
  )

  // Create a sample comment
  await runQuery(
    `MATCH (u:User {id: $userId}), (p:Post {id: $postId})
     CREATE (c:Comment {
       id: $id, content: $content, postId: $postId, authorId: $userId,
       parentId: null, likesCount: 0, createdAt: $now, updatedAt: $now
     })
     SET p.commentsCount = p.commentsCount + 1`,
    {
      id: uuidv4(),
      userId: userIds[1],
      postId: postIds[0],
      content: 'Chào mừng đến EduSocial! Rất vui được kết nối với bạn 😊',
      now,
    }
  )
  console.log('  ✅ Comments created')

  // Create a sample group
  const groupId = uuidv4()
  await runQuery(
    `MATCH (u:User {id: $ownerId})
     CREATE (g:Group {
       id: $id, name: $name, description: $description,
       privacy: 'PUBLIC', ownerId: $ownerId, membersCount: 3,
       createdAt: $now, updatedAt: $now
     })
     MERGE (u)-[:MEMBER_OF {role: 'OWNER', joinedAt: $now}]->(g)`,
    {
      id: groupId,
      ownerId: userIds[0],
      name: 'Cộng đồng Lập trình EduSocial',
      description: 'Nhóm dành cho những người yêu thích lập trình và công nghệ',
      now,
    }
  )
  // Add members
  for (const uid of [userIds[1], userIds[2]]) {
    await runQuery(
      `MATCH (u:User {id: $userId}), (g:Group {id: $groupId})
       MERGE (u)-[:MEMBER_OF {role: 'MEMBER', joinedAt: $now}]->(g)`,
      { userId: uid, groupId, now }
    )
  }
  console.log('  ✅ Group created')

  console.log('\n🎉 Seed completed successfully!')
  console.log('\n📋 Test accounts:')
  console.log('   Admin: admin@edusocial.app / Admin@123')
  console.log('   User:  alice@example.com / User@1234')
  console.log('   User:  bob@example.com / User@1234')

  await closeDriver()
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
