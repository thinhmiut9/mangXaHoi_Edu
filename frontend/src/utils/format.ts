import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

export function timeAgo(dateString: string): string {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true, locale: vi })
  } catch {
    return dateString
  }
}

export function formatDate(dateString: string, fmt = 'dd/MM/yyyy HH:mm'): string {
  try {
    return format(parseISO(dateString), fmt, { locale: vi })
  } catch {
    return dateString
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}
