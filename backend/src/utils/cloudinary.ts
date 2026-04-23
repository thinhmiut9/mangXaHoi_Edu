import { env } from '../config/env'
import { cloudinaryV2 } from '../config/cloudinary'

const cloudinaryPrefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`
export type CloudinaryResourceType = 'image' | 'video' | 'raw'

export function isCloudinaryImageUrl(url: string): boolean {
  return url.startsWith(cloudinaryPrefix) && url.includes('/image/upload/')
}

export function isCloudinaryVideoUrl(url: string): boolean {
  return url.startsWith(cloudinaryPrefix) && url.includes('/video/upload/')
}

export function isCloudinaryRawUrl(url: string): boolean {
  return url.startsWith(cloudinaryPrefix) && url.includes('/raw/upload/')
}

export function isCloudinaryMediaUrl(url: string): boolean {
  return isCloudinaryImageUrl(url) || isCloudinaryVideoUrl(url) || isCloudinaryRawUrl(url)
}

export function filterCloudinaryImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryImageUrl(url))
}

export function filterCloudinaryVideoUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryVideoUrl(url))
}

export function filterCloudinaryRawUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryRawUrl(url))
}

export function filterCloudinaryMediaUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryMediaUrl(url))
}

export function parseCloudinaryAsset(url: string): { resourceType: CloudinaryResourceType; publicId: string } | null {
  if (!isCloudinaryMediaUrl(url)) return null

  let pathname = ''
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }

  let resourceType: CloudinaryResourceType | null = null
  if (pathname.includes('/image/upload/')) resourceType = 'image'
  if (pathname.includes('/video/upload/')) resourceType = 'video'
  if (pathname.includes('/raw/upload/')) resourceType = 'raw'
  if (!resourceType) return null

  const uploadIndex = pathname.indexOf('/upload/')
  if (uploadIndex === -1) return null

  const afterUpload = pathname.slice(uploadIndex + '/upload/'.length)
  const segments = afterUpload.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment))
  const publicSegments = versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments
  if (publicSegments.length === 0) return null

  const joinedPublicPath = publicSegments.join('/')
  const publicId = resourceType === 'raw' ? joinedPublicPath : joinedPublicPath.replace(/\.[^/.]+$/, '')
  if (!publicId) return null

  return { resourceType, publicId }
}

export function buildSignedRawAccessUrl(fileUrl: string, asAttachment = false): string | null {
  const asset = parseCloudinaryAsset(fileUrl)
  if (!asset || asset.resourceType !== 'raw') return null

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 10

  return cloudinaryV2.utils.private_download_url(asset.publicId, '', {
    resource_type: 'raw',
    type: 'upload',
    expires_at: expiresAt,
    attachment: asAttachment,
  })
}
