import type { FrontendUser } from '@/api/normalize'

function hasValue(value?: string) {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasRequiredRecommendationProfile(user?: FrontendUser | null) {
  if (!user || user.role !== 'USER') return true

  return hasValue(user.location) && hasValue(user.major) && hasValue(user.school)
}
