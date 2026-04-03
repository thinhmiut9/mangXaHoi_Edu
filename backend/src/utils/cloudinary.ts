import { env } from '../config/env'

const cloudinaryPrefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`

export function isCloudinaryImageUrl(url: string): boolean {
  return url.startsWith(cloudinaryPrefix) && url.includes('/image/upload/')
}

export function isCloudinaryVideoUrl(url: string): boolean {
  return url.startsWith(cloudinaryPrefix) && url.includes('/video/upload/')
}

export function filterCloudinaryImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryImageUrl(url))
}

export function filterCloudinaryVideoUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && isCloudinaryVideoUrl(url))
}
