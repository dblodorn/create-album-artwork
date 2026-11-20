// Turns the Photos search field into the keyword list sent to the API:
// split on commas (keywords can contain spaces, e.g. "eastern sierras"),
// inner whitespace collapsed, trimmed, lowercased, de-duplicated, at most
// 10, each at most 64 characters (longer ones are dropped). The API also
// normalises; this just keeps requests (and the connection key) tidy.
export const MAX_SEARCH_KEYWORDS = 10
const MAX_KEYWORD_LENGTH = 64

export function parseKeywords(input: string): string[] {
  const keywords: string[] = []
  for (const raw of input.split(',')) {
    const keyword = raw.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!keyword || keyword.length > MAX_KEYWORD_LENGTH || keywords.includes(keyword)) continue
    keywords.push(keyword)
    if (keywords.length === MAX_SEARCH_KEYWORDS) break
  }
  return keywords
}
