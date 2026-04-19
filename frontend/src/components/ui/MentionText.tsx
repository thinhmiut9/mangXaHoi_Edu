import { Link } from 'react-router-dom'

interface MentionTextProps {
  content: string
  className?: string
}

/**
 * Render nội dung text, parse mention token @[Name](userId) thành link màu sắc
 * Ví dụ: "Chào @[Nguyễn A](abc-123)!" → "Chào <Link>@Nguyễn A</Link>!"
 */
export function MentionText({ content, className }: MentionTextProps) {
  if (!content) return null

  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = mentionRegex.exec(content)) !== null) {
    const [fullMatch, displayName, userId] = match
    const start = match.index

    // Thêm text trước mention
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{content.slice(lastIndex, start)}</span>
      )
    }

    // Thêm mention dạng link
    parts.push(
      <Link
        key={`mention-${userId}-${start}`}
        to={`/profile/${userId}`}
        className="text-primary-600 font-semibold hover:underline"
        onClick={e => e.stopPropagation()}
      >
        @{displayName}
      </Link>
    )

    lastIndex = start + fullMatch.length
  }

  // Thêm phần text còn lại
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-end`}>{content.slice(lastIndex)}</span>
    )
  }

  return (
    <span className={className}>
      {parts.length > 0 ? parts : content}
    </span>
  )
}
