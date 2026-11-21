/*
 * Browser-side calls to the dmbk GraphQL API, through `/api/dmbk`.
 *
 * Result types are written by hand to match the query text in
 * `lib/dmbk/operations.ts`; keep the two in step when adding an operation.
 */

export type PageInfo = { hasNextPage: boolean; endCursor: string | null }

export type Connection<T> = {
  edges: { cursor?: string; node: T }[]
  pageInfo: PageInfo
}

export type GeneratedImage = {
  id: string
  url: string
  prompt: string
  width: number | null
  height: number | null
  createdAt: string
}

export type LoraTraining = {
  id: string
  triggerWord: string
  status: string
  createdAt: string
  trainingImageUrls: string[]
  images: { edges: { node: GeneratedImage }[] }
}

export type DmbkPhoto = {
  id: string
  title: string | null
  hidden: boolean | null
  width: number | null
  height: number | null
  thumbUrl: string | null
  displayUrl: string | null
}

export type Operations = {
  LoraTrainings: {
    variables: { first: number; after?: string | null }
    result: { loraTrainerTrainings: Connection<LoraTraining> }
  }
  LoraTrainingImages: {
    variables: { id: string; first: number; after?: string | null }
    result: {
      node: {
        id: string
        triggerWord: string
        images: Connection<GeneratedImage>
      } | null
    }
  }
  DmbkPhotos: {
    variables: { first: number; after?: string | null; keywords?: string[] | null }
    result: { dmbkPhotos: Connection<DmbkPhoto> }
  }
}

export type OperationName = keyof Operations

export type DmbkErrorKind =
  | 'not_configured'
  | 'upstream'
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'

const KNOWN_ERRORS: DmbkErrorKind[] = ['not_configured', 'bad_request', 'unauthenticated', 'forbidden']

export class DmbkError extends Error {
  constructor(public kind: DmbkErrorKind) {
    super(`dmbk API request failed: ${kind}`)
    this.name = 'DmbkError'
  }
}

export async function dmbkQuery<Op extends OperationName>(
  operation: Op,
  variables: Operations[Op]['variables']
): Promise<Operations[Op]['result']> {
  let res: Response
  try {
    res = await fetch('/api/dmbk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, variables }),
    })
  } catch {
    // Offline, or our own server is down: same outcome for the user.
    throw new DmbkError('upstream')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const error = body?.error
    throw new DmbkError(KNOWN_ERRORS.includes(error) ? error : 'upstream')
  }
  const { data } = (await res.json()) as { data: Operations[Op]['result'] }
  return data
}
