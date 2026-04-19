import { env } from '../config/env'

const cloudinaryPrefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`

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
