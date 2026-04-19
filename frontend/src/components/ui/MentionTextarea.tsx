import { useEffect, useRef, useState, useCallback } from 'react'
import { usersApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'

interface MentionUser {
  userId: string
  displayName: string
  avatarUrl?: string
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  'aria-label'?: string
  autoFocus?: boolean
}

/**
 * Textarea thông minh hỗ trợ gắn thẻ người dùng bằng @
 * Mention được lưu dưới dạng @[DisplayName](userId) trong value
 */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  disabled,
  onKeyDown,
  'aria-label': ariaLabel,
  autoFocus,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lấy gợi ý user khi query thay đổi
  useEffect(() => {
    if (!query && query.length === 0) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await usersApi.mentionSearch(query)
        setSuggestions(results)
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        textareaRef.current && !textareaRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    onChange(val)

    // Tìm @ gần con trỏ nhất
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\w.]*)$/)

    if (atMatch) {
      const start = cursor - atMatch[0].length
      setMentionStart(start)
      setQuery(atMatch[1])
      setShowDropdown(true)
      setSelectedIndex(0)
    } else {
      setShowDropdown(false)
      setMentionStart(null)
      setQuery('')
    }
  }

  const insertMention = useCallback(
    (user: MentionUser) => {
      if (mentionStart === null) return
      const textarea = textareaRef.current
      const cursor = textarea?.selectionStart ?? value.length
      // Xóa phần @query trước cursor
      const before = value.slice(0, mentionStart)
      const after = value.slice(cursor)
      const token = `@[${user.displayName}](${user.userId})`
      const newValue = before + token + ' ' + after
      onChange(newValue)
      setShowDropdown(false)
      setMentionStart(null)
      setQuery('')
      // Di chuyển cursor sau token
      setTimeout(() => {
        if (textarea) {
          const pos = before.length + token.length + 1
          textarea.focus()
          textarea.setSelectionRange(pos, pos)
        }
      }, 0)
    },
    [mentionStart, value, onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowDropdown(false)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-border-light rounded-xl shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Gợi ý người dùng"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-text-muted">Đang tìm kiếm...</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              {query ? 'Không tìm thấy người dùng' : 'Nhập tên để tìm kiếm'}
            </div>
          ) : (
            suggestions.map((user, idx) => (
              <button
                key={user.userId}
                role="option"
                aria-selected={idx === selectedIndex}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer
                  ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-app-bg'}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(user)
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{user.displayName}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Input 1 dòng (không phải textarea) hỗ trợ mention, dùng cho comment reply
 */
interface MentionInputProps extends Omit<MentionTextareaProps, 'rows'> {
  onSubmit?: () => void
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  onKeyDown,
  'aria-label': ariaLabel,
  onSubmit,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query && query.length === 0) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await usersApi.mentionSearch(query)
        setSuggestions(results)
      } catch { setSuggestions([]) }
      finally { setIsLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    onChange(val)
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\w.]*)$/)
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length)
      setQuery(atMatch[1])
      setShowDropdown(true)
      setSelectedIndex(0)
    } else {
      setShowDropdown(false)
      setMentionStart(null)
      setQuery('')
    }
  }

  const insertMention = useCallback((user: MentionUser) => {
    if (mentionStart === null) return
    const cursor = inputRef.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const token = `@[${user.displayName}](${user.userId})`
    const newValue = before + token + ' ' + after
    onChange(newValue)
    setShowDropdown(false)
    setMentionStart(null)
    setQuery('')
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + token.length + 1
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }, [mentionStart, value, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[selectedIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowDropdown(false); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && value.trim() && !showDropdown) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
  }

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        aria-label={ariaLabel}
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 bottom-full mb-1 w-60 bg-white border border-border-light rounded-xl shadow-lg overflow-hidden"
          role="listbox"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-text-muted">Đang tìm kiếm...</div>
          ) : suggestions.length === 0 ? (
            query ? <div className="px-4 py-3 text-sm text-text-muted">Không tìm thấy</div> : null
          ) : (
            suggestions.map((user, idx) => (
              <button
                key={user.userId}
                role="option"
                aria-selected={idx === selectedIndex}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer
                  ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-app-bg'}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
                <p className="text-sm font-semibold text-text-primary truncate">{user.displayName}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
