import fs from 'fs'
import path from 'path'
import { verifyConnectivity, closeDriver, runQuery } from '../config/neo4j'
import { cloudinaryV2 } from '../config/cloudinary'

type UserRow = { userId: string }
type PostRow = { postId: string }

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function getImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getImageFiles(fullPath))
      continue
    }
    if (entry.isFile() && allowedExt.has(path.extname(fullPath).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function randomPickMany<T>(items: T[], min: number, max: number): T[] {
  const count = Math.min(items.length, Math.floor(Math.random() * (max - min + 1)) + min)
  const shuffled = [...items].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

async function uploadImage(localPath: string, folder: string, publicId: string): Promise<string> {
  const ext = path.extname(localPath).replace('.', '').toLowerCase()
  const result = await cloudinaryV2.uploader.upload(localPath, {
    folder: `edusocial/${folder}`,
    public_id: publicId,
    overwrite: true,
    unique_filename: false,
    resource_type: 'image',
    quality: 'auto',
    fetch_format: 'auto',
    format: ext === 'jpeg' ? 'jpg' : ext,
  })
  return result.secure_url
}

async function destroyImageIfExists(folder: string, publicId: string): Promise<void> {
  const fullPublicId = `edusocial/${folder}/${publicId}`
  await cloudinaryV2.uploader.destroy(fullPublicId, { resource_type: 'image', invalidate: true })
}

async function seedCloudinaryImages(): Promise<void> {
  await verifyConnectivity()

  const root = process.env.DEMO_IMAGES_ROOT
    ? path.resolve(process.cwd(), process.env.DEMO_IMAGES_ROOT)
    : path.resolve(process.cwd(), 'demo-images')
  const avatarDir = path.join(root, 'users', 'avatars')
  const coverDir = path.join(root, 'users', 'covers')
  const postDir = path.join(root, 'posts')
  const allDir = path.join(root, 'all')

  const allFiles = getImageFiles(allDir)
  const avatarFiles = getImageFiles(avatarDir)
  const coverFiles = getImageFiles(coverDir)
  const postFiles = getImageFiles(postDir)
  const avatarPool = avatarFiles.length > 0 ? avatarFiles : allFiles
  const coverPool = coverFiles.length > 0 ? coverFiles : allFiles
  const postPool = postFiles.length > 0 ? postFiles : allFiles

  if (avatarPool.length === 0 || coverPool.length === 0 || postPool.length === 0) {
    console.log('Thiếu ảnh demo. Vui lòng thêm ảnh vào:')
    console.log(`- ${avatarDir}`)
    console.log(`- ${coverDir}`)
    console.log(`- ${postDir}`)
    console.log(`- Hoặc dùng thư mục chung: ${allDir}`)
    console.log('Định dạng hỗ trợ: .jpg .jpeg .png .webp .gif')
    return
  }

  console.log(
    `Bắt đầu upload: avatar=${avatarPool.length}, cover=${coverPool.length}, post=${postPool.length} | root=${root}`
  )

  const users = await runQuery<UserRow>('MATCH (u:User) RETURN u.userId AS userId ORDER BY u.createdAt ASC')
  const posts = await runQuery<PostRow>('MATCH (p:Post) RETURN p.postId AS postId ORDER BY p.createdAt ASC')

  const now = new Date().toISOString()

  for (const user of users) {
    const avatarFile = randomPick(avatarPool)
    const coverFile = randomPick(coverPool)

    const avatarUrl = await uploadImage(avatarFile, 'avatars', `avatar_${user.userId}`)
    const coverUrl = await uploadImage(coverFile, 'covers', `cover_${user.userId}`)

    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.avatarUrl = $avatarUrl,
           u.coverUrl = $coverUrl,
           u.updatedAt = $now`,
      { userId: user.userId, avatarUrl, coverUrl, now }
    )
  }

  for (const post of posts) {
    const selected = randomPickMany(postPool, 1, 3)
    const mediaUrls: string[] = []

    for (let slot = 0; slot < selected.length; slot += 1) {
      const file = selected[slot]
      const uploaded = await uploadImage(file, 'posts', `post_${post.postId}_${slot + 1}`)
      mediaUrls.push(uploaded)
    }

    for (let slot = selected.length + 1; slot <= 3; slot += 1) {
      await destroyImageIfExists('posts', `post_${post.postId}_${slot}`)
    }

    await runQuery(
      `MATCH (p:Post {postId: $postId})
       SET p.mediaUrls = $mediaUrls,
           p.updatedAt = $now`,
      { postId: post.postId, mediaUrls, now }
    )
  }

  console.log(`Hoàn tất: đã cập nhật ${users.length} user và ${posts.length} post với ảnh Cloudinary`)
}

seedCloudinaryImages()
  .catch(err => {
    console.error('Seed ảnh Cloudinary thất bại:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDriver()
  })
