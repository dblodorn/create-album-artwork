import 'server-only'

/*
 * The operations `/api/dmbk` forwards to the dmbk GraphQL API, by name.
 *
 * The browser sends `{ operation, variables }`; the query text lives only
 * here, so the route can do exactly what the editor does and nothing more.
 * Adding an operation means adding it below and its result type to
 * `lib/dmbk/client.ts`.
 */

export const DEFAULT_API_URL = 'https://graphql.dmbk.network/graphql'

export const apiUrl = () => process.env.DMBK_GRAPHQL_API_URL || DEFAULT_API_URL
export const apiKey = () => process.env.DMBK_GRAPHQL_API_KEY || undefined

type Variables = Record<string, unknown>

type Operation = {
  query: string
  // Returns the variables to forward, or null when they're invalid.
  parseVariables: (raw: unknown) => Variables | null
}

const MAX_CURSOR_LENGTH = 512
const MAX_ID_LENGTH = 256

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIntInRange = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max

const isOptionalCursor = (value: unknown): value is string | undefined | null =>
  value == null ||
  (typeof value === 'string' && value.length > 0 && value.length <= MAX_CURSOR_LENGTH)

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
}

// hasOwn, so a name like "constructor" can't reach the prototype.
export const getOperation = (name: unknown): Operation | undefined =>
  typeof name === 'string' && Object.hasOwn(OPERATIONS, name)
    ? OPERATIONS[name]
    : undefined
