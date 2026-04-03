import { verifyConnectivity, closeDriver, runQuery } from '../config/neo4j'
import { cloudinaryV2 } from '../config/cloudinary'

type UserRow = { userId: string }
type PostRow = { postId: string }
type CloudinaryResource = { secure_url?: string }

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function randomPickMany<T>(items: T[], min: number, max: number): T[] {
  const count = Math.min(items.length, Math.floor(Math.random() * (max - min + 1)) + min)
  const shuffled = [...items].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

async function getAllCloudinaryImageUrls(prefix?: string): Promise<string[]> {
  const urls: string[] = []
  let nextCursor: string | undefined

  do {
    const result = await cloudinaryV2.api.resources({
      type: 'upload',
      resource_type: 'image',
      max_results: 500,
      next_cursor: nextCursor,
      prefix,
    })

    const resources = (result.resources ?? []) as CloudinaryResource[]
    for (const resource of resources) {
      if (resource.secure_url && resource.secure_url.includes('/image/upload/')) {
        urls.push(resource.secure_url)
      }
    }

    nextCursor = result.next_cursor
  } while (nextCursor)

  return urls
}

async function assignFromCloudinary(): Promise<void> {
  await verifyConnectivity()

  const prefix = process.env.CLOUDINARY_ASSIGN_PREFIX?.trim() || undefined
  const urls = await getAllCloudinaryImageUrls(prefix)

  if (urls.length === 0) {
    console.log('Không tìm thấy ảnh nào trên Cloudinary để gán.')
    if (prefix) {
      console.log(`Prefix hiện tại: ${prefix}`)
    }
    return
  }

  const users = await runQuery<UserRow>('MATCH (u:User) RETURN u.userId AS userId ORDER BY u.createdAt ASC')
  const posts = await runQuery<PostRow>('MATCH (p:Post) RETURN p.postId AS postId ORDER BY p.createdAt ASC')
  const now = new Date().toISOString()

  for (const user of users) {
    const avatarUrl = randomPick(urls)
    const coverUrl = randomPick(urls)
    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.avatarUrl = $avatarUrl,
           u.coverUrl = $coverUrl,
           u.updatedAt = $now`,
      { userId: user.userId, avatarUrl, coverUrl, now }
    )
  }

  for (const post of posts) {
    const mediaUrls = randomPickMany(urls, 1, 3)
    await runQuery(
      `MATCH (p:Post {postId: $postId})
       SET p.mediaUrls = $mediaUrls,
           p.updatedAt = $now`,
      { postId: post.postId, mediaUrls, now }
    )
  }

  console.log(`Đã gán ngẫu nhiên từ Cloudinary: ${urls.length} ảnh, ${users.length} user, ${posts.length} post`)
}

assignFromCloudinary()
  .catch(err => {
    console.error('Gán ảnh từ Cloudinary thất bại:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDriver()
  })
