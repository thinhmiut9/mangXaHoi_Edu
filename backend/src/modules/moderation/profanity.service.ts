import bannedKeywords from '../../config/bannedKeywords.json'
import { compactNormalizedText, normalizeText } from '../../utils/normalizeText'

export type ModerationContentType = 'message' | 'comment' | 'post' | 'document'
type ModerationAction = 'allow' | 'review' | 'block'

type KeywordRule = {
  keyword: string
  normalizedKeyword?: string
  action: Exclude<ModerationAction, 'allow'>
  appliesTo: ModerationContentType[]
}

type ModerationMatch = {
  keyword: string
  normalizedKeyword: string
  action: Exclude<ModerationAction, 'allow'>
}

type ModerationResult = {
  action: ModerationAction
  normalizedText: string
  matchedRules: ModerationMatch[]
}

const profanityRules = (bannedKeywords as KeywordRule[]).map((rule) => {
  const normalizedKeyword = normalizeText(rule.normalizedKeyword || rule.keyword)
  return {
    ...rule,
    normalizedKeyword,
    compactKeyword: normalizedKeyword.replace(/\s+/g, ''),
  }
})

function appliesToContent(rule: KeywordRule, contentType: ModerationContentType): boolean {
  return rule.appliesTo.includes(contentType)
}

function isTokenMatch(tokens: Set<string>, keyword: string): boolean {
  return tokens.has(keyword)
}

function shouldUseTokenMatch(keyword: string): boolean {
  return keyword.length <= 3 && !keyword.includes(' ')
}

export const profanityService = {
  scanText(content: string, contentType: ModerationContentType): ModerationResult {
    const normalizedText = normalizeText(content)
    if (!normalizedText) {
      return { action: 'allow', normalizedText, matchedRules: [] }
    }

    const compactText = compactNormalizedText(content)
    const tokens = new Set(normalizedText.split(' ').filter(Boolean))

    const matchedRules = profanityRules
      .filter((rule) => appliesToContent(rule, contentType))
      .filter((rule) => {
        if (shouldUseTokenMatch(rule.normalizedKeyword)) {
          return isTokenMatch(tokens, rule.normalizedKeyword)
        }

        if (normalizedText.includes(rule.normalizedKeyword)) return true
        return rule.compactKeyword.length >= 3 && compactText.includes(rule.compactKeyword)
      })
      .map<ModerationMatch>((rule) => ({
        keyword: rule.keyword,
        normalizedKeyword: rule.normalizedKeyword,
        action: rule.action,
      }))

    const action: ModerationAction = matchedRules.some((rule) => rule.action === 'block')
      ? 'block'
      : matchedRules.some((rule) => rule.action === 'review')
        ? 'review'
        : 'allow'

    return { action, normalizedText, matchedRules }
  },
}
