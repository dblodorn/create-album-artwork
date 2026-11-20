import 'server-only'

/*
 * The operations `/api/dmbk` forwards to the dmbk GraphQL API, by name.
 *
 * The browser sends `{ operation, variables }`; the query text lives only
 * here, so the route can do exactly what the editor does and nothing more.
 * Adding an operation means adding it below and its result type to
 * `lib/dmbk/client.ts`. The call itself (key, session, timeout) is
 * `callDmbkApi` in `lib/dmbk/api.ts`.
 */

type Variables = Record<string, unknown>

type Operation = {
  query: string
  // Returns the variables to forward, or null when they're invalid.
  parseVariables: (raw: unknown) => Variables | null
  // Who may run it. 'admin' is checked by `/api/dmbk` before the API is
  // called, even when the API itself would answer anyone. Default: public.
  access?: 'public' | 'admin'
}

const MAX_CURSOR_LENGTH = 512
const MAX_ID_LENGTH = 256
const MAX_KEYWORDS = 10
const MAX_KEYWORD_LENGTH = 64

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIntInRange = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max

const isOptionalCursor = (value: unknown): value is string | undefined | null =>
  value == null ||
  (typeof value === 'string' && value.length > 0 && value.length <= MAX_CURSOR_LENGTH)

// Optional keyword list: trimmed, each 1–64 characters, at most 10. Empty
// means no filter (null). Case is left to the API, which normalises it.
const parseKeywords = (value: unknown): string[] | null | undefined => {
  if (value == null) return null
  if (!Array.isArray(value) || value.length > MAX_KEYWORDS) return undefined
  const keywords: string[] = []
  for (const k of value) {
    if (typeof k !== 'string') return undefined
    const trimmed = k.trim()
    if (!trimmed || trimmed.length > MAX_KEYWORD_LENGTH) return undefined
    keywords.push(trimmed)
  }
  return keywords.length ? keywords : null
}

const IMAGE_FIELDS = 'id url prompt width height createdAt'

const OPERATIONS: Record<string, Operation> = {
  LoraTrainings: {
    query: `query LoraTrainings($first: Int!, $after: String) {
  loraTrainerTrainings(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        triggerWord
        status
        createdAt
        trainingImageUrls
        images(first: 1) { edges { node { ${IMAGE_FIELDS} } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`,
    parseVariables(raw) {
      if (!isObject(raw)) return null
      const { first, after } = raw
      if (!isIntInRange(first, 1, 30) || !isOptionalCursor(after)) return null
      return { first, after: after ?? null }
    },
  },
  LoraTrainingImages: {
    query: `query LoraTrainingImages($id: ID!, $first: Int!, $after: String) {
  node(id: $id) {
    ... on LoraTraining {
      id
      triggerWord
      images(first: $first, after: $after) {
        edges { cursor node { ${IMAGE_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`,
    parseVariables(raw) {
      if (!isObject(raw)) return null
      const { id, first, after } = raw
      if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) {
        return null
      }
      if (!isIntInRange(first, 1, 48) || !isOptionalCursor(after)) return null
      return { id, first, after: after ?? null }
    },
  },
  // The owner's dmbk-photos collection, hidden photos included. Admin only:
  // photos aren't tied to an account yet, so there's no "your photos" scope.
  DmbkPhotos: {
    access: 'admin',
    query: `query DmbkPhotos($first: Int!, $after: String, $keywords: [String!]) {
  dmbkPhotos(first: $first, after: $after, keywords: $keywords, visibility: ANY) {
    edges { cursor node { id title hidden width height thumbUrl displayUrl } }
    pageInfo { hasNextPage endCursor }
  }
}`,
    parseVariables(raw) {
      if (!isObject(raw)) return null
      const { first, after, keywords: rawKeywords } = raw
      if (!isIntInRange(first, 1, 48) || !isOptionalCursor(after)) return null
      const keywords = parseKeywords(rawKeywords)
      if (keywords === undefined) return null
      return { first, after: after ?? null, keywords }
    },
  },
}

// hasOwn, so a name like "constructor" can't reach the prototype.
export const getOperation = (name: unknown): Operation | undefined =>
  typeof name === 'string' && Object.hasOwn(OPERATIONS, name)
    ? OPERATIONS[name]
    : undefined
