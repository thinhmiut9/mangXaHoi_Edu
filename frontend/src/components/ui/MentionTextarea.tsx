import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { usersApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'

interface MentionUser {
  userId: string
  displayName: string
  avatarUrl?: string
}

type MentionToken = {
  displayName: string
  userId: string
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

const mentionTokenRegex = /@\[([^\]]+)\]\(([^)]+)\)/g

function parseMentionTokens(value: string): MentionToken[] {
  const tokens: MentionToken[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  mentionTokenRegex.lastIndex = 0
  while ((match = mentionTokenRegex.exec(value)) !== null) {
    const displayName = match[1]
    const userId = match[2]
    const key = `${displayName}:${userId}`
    if (!seen.has(key)) {
      seen.add(key)
      tokens.push({ displayName, userId })
    }
  }

  return tokens
}

function toDisplayValue(value: string): string {
  return value.replace(mentionTokenRegex, '@$1')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toStoredValue(displayValue: string, tokens: MentionToken[]): string {
  return tokens.reduce((next, token) => {
    const pattern = new RegExp(`@${escapeRegExp(token.displayName)}(?![\\p{L}\\p{N}_])`, 'gu')
    return next.replace(pattern, `@[${token.displayName}](${token.userId})`)
  }, displayValue)
}

/* ─────────────────────────────────────────────
   Portal-based Emoji Picker
   Renders at document.body so it's NEVER clipped
   by overflow:hidden / overflow:auto ancestors.
   Automatically positions itself to avoid going
   off-screen (like Facebook).
───────────────────────────────────────────── */
interface EmojiPortalProps {
  anchorRef: React.RefObject<HTMLElement>
  onSelect: (emoji: { native: string }) => void
  onClose: () => void
}

function EmojiPortal({ anchorRef, onSelect, onClose }: EmojiPortalProps) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden', position: 'fixed', zIndex: 9999 })
  const pickerRef = useRef<HTMLDivElement>(null)

  // Calculate smart position based on anchor button's screen coordinates
  useEffect(() => {
    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const pickerW = 352
      const pickerH = 435
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Horizontal: right-align with anchor, clamp to viewport
      let left = rect.right - pickerW
      if (left < 8) left = 8
      if (left + pickerW > vw - 8) left = vw - pickerW - 8

      // Vertical: prefer above, fallback below
      let top: number
      if (rect.top >= pickerH + 12) {
        top = rect.top - pickerH - 6
      } else {
        top = rect.bottom + 6
      }
      if (top + pickerH > vh - 8) top = vh - pickerH - 8
      if (top < 8) top = 8

      setStyle({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef])

  // Close when clicking outside picker and anchor
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const anchor = anchorRef.current
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        (!anchor || !anchor.contains(e.target as Node))
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  return createPortal(
    <div ref={pickerRef} style={style} className="drop-shadow-2xl rounded-2xl overflow-hidden">
      <Picker
        data={data}
        locale="vi"
        onEmojiSelect={onSelect}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>,
    document.body
  )
}

/* ─────────────────────────────────────────────
   MentionTextarea – multi-line, for creating posts
───────────────────────────────────────────── */
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
  const emojiBtnRef = useRef<HTMLButtonElement>(null)

  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [displayValue, setDisplayValue] = useState(() => toDisplayValue(value))
  const [mentionTokens, setMentionTokens] = useState<MentionToken[]>(() => parseMentionTokens(value))

  useEffect(() => {
    setDisplayValue(toDisplayValue(value))
    setMentionTokens(parseMentionTokens(value))
  }, [value])

  useEffect(() => {
    if (!query && query.length === 0) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try { const results = await usersApi.mentionSearch(query); setSuggestions(results) }
      catch { setSuggestions([]) }
      finally { setIsLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        textareaRef.current && !textareaRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setDisplayValue(val)
    onChange(toStoredValue(val, mentionTokens))
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\p{L}\p{N}_.]*)$/u)
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
    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? displayValue.length
    const before = displayValue.slice(0, mentionStart)
    const after = displayValue.slice(cursor)
    const token = `@[${user.displayName}](${user.userId})`
    const displayMention = `@${user.displayName}`
    const nextDisplay = before + displayMention + ' ' + after
    const nextTokens = [...mentionTokens.filter(t => t.userId !== user.userId), { displayName: user.displayName, userId: user.userId }]
    setDisplayValue(nextDisplay)
    setMentionTokens(nextTokens)
    onChange(toStoredValue(nextDisplay, nextTokens))
    setShowDropdown(false)
    setMentionStart(null)
    setQuery('')
    setTimeout(() => {
      if (textarea) { const pos = before.length + displayMention.length + 1; textarea.focus(); textarea.setSelectionRange(pos, pos) }
    }, 0)
  }, [mentionStart, displayValue, mentionTokens, onChange])

  const insertEmoji = useCallback((emoji: { native: string }) => {
    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? displayValue.length
    const newValue = displayValue.slice(0, cursor) + emoji.native + displayValue.slice(cursor)
    setDisplayValue(newValue)
    onChange(toStoredValue(newValue, mentionTokens))
    setShowEmojiPicker(false)
    setTimeout(() => {
      if (textarea) { const pos = cursor + emoji.native.length; textarea.focus(); textarea.setSelectionRange(pos, pos) }
    }, 0)
  }, [displayValue, mentionTokens, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[selectedIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowDropdown(false); return }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative w-full">
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
      />

      {/* Emoji button – bottom-right corner of the textarea area */}
      <button
        ref={emojiBtnRef}
        type="button"
        onClick={() => setShowEmojiPicker(v => !v)}
        className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-yellow-500 hover:bg-slate-100 transition-colors text-lg"
        aria-label="Chọn emoji"
        title="Chọn emoji"
      >
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='10' />
          <path d='M8 14s1.5 2 4 2 4-2 4-2' />
          <line x1='9' y1='9' x2='9.01' y2='9' />
          <line x1='15' y1='9' x2='15.01' y2='9' />
        </svg>
      </button>

      {/* Portal picker – never clipped by modal overflow */}
      {showEmojiPicker && (
        <EmojiPortal
          anchorRef={emojiBtnRef as React.RefObject<HTMLElement>}
          onSelect={insertEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Mention dropdown */}
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-app-bg'}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
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

/* ─────────────────────────────────────────────
   MentionInput – single-line, for comments / replies
───────────────────────────────────────────── */
interface MentionInputProps extends Omit<MentionTextareaProps, 'rows'> {
  onSubmit?: () => void
  showEmojiBtn?: boolean
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
  showEmojiBtn = true,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)

  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [displayValue, setDisplayValue] = useState(() => toDisplayValue(value))
  const [mentionTokens, setMentionTokens] = useState<MentionToken[]>(() => parseMentionTokens(value))

  useEffect(() => {
    setDisplayValue(toDisplayValue(value))
    setMentionTokens(parseMentionTokens(value))
  }, [value])

  useEffect(() => {
    if (!query && query.length === 0) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try { const results = await usersApi.mentionSearch(query); setSuggestions(results) }
      catch { setSuggestions([]) }
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
    setDisplayValue(val)
    onChange(toStoredValue(val, mentionTokens))
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\p{L}\p{N}_.]*)$/u)
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
    const cursor = inputRef.current?.selectionStart ?? displayValue.length
    const before = displayValue.slice(0, mentionStart)
    const after = displayValue.slice(cursor)
    const displayMention = `@${user.displayName}`
    const newValue = before + displayMention + ' ' + after
    const nextTokens = [...mentionTokens.filter(t => t.userId !== user.userId), { displayName: user.displayName, userId: user.userId }]
    setDisplayValue(newValue)
    setMentionTokens(nextTokens)
    onChange(toStoredValue(newValue, nextTokens))
    setShowDropdown(false)
    setMentionStart(null)
    setQuery('')
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + displayMention.length + 1
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }, [mentionStart, displayValue, mentionTokens, onChange])

  const insertEmoji = useCallback((emoji: { native: string }) => {
    const input = inputRef.current
    const cursor = input?.selectionStart ?? displayValue.length
    const newValue = displayValue.slice(0, cursor) + emoji.native + displayValue.slice(cursor)
    setDisplayValue(newValue)
    onChange(toStoredValue(newValue, mentionTokens))
    setShowEmojiPicker(false)
    setTimeout(() => {
      if (input) { const pos = cursor + emoji.native.length; input.focus(); input.setSelectionRange(pos, pos) }
    }, 0)
  }, [displayValue, mentionTokens, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[selectedIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowDropdown(false); return }
      if (e.key === 'Enter') { e.preventDefault(); insertMention(suggestions[selectedIndex]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && displayValue.trim() && !showDropdown) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
  }

  return (
    // Flex row: [input flexes to fill] [emoji button fixed width]
    <div className="relative flex-1 min-w-0 flex items-center gap-1">
      {/* Input – no visible border / outline */}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`flex-1 min-w-0 border-0 outline-none ring-0 focus:outline-none focus:ring-0 bg-transparent ${className ?? ''}`}
        disabled={disabled}
        aria-label={ariaLabel}
      />

      {/* Emoji toggle button – sits as flex sibling inside the rounded pill */}
      {showEmojiBtn && (
        <button
          ref={emojiBtnRef}
          type="button"
          onClick={() => setShowEmojiPicker(v => !v)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-yellow-500 hover:bg-black/5 transition-colors text-base"
          aria-label="Chọn emoji"
          title="Chọn emoji"
        >
          <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='10' />
          <path d='M8 14s1.5 2 4 2 4-2 4-2' />
          <line x1='9' y1='9' x2='9.01' y2='9' />
          <line x1='15' y1='9' x2='15.01' y2='9' />
        </svg>
        </button>
      )}

      {/* Portal picker – renders at document.body, never clipped */}
      {showEmojiPicker && (
        <EmojiPortal
          anchorRef={emojiBtnRef as React.RefObject<HTMLElement>}
          onSelect={insertEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Mention dropdown */}
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${idx === selectedIndex ? 'bg-primary-50' : 'hover:bg-app-bg'}`}
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
