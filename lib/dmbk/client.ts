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

type Operations = {
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
}

export type OperationName = keyof Operations

export type DmbkErrorKind = 'not_configured' | 'upstream' | 'bad_request'

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
    throw new DmbkError(
      error === 'not_configured' || error === 'bad_request' ? error : 'upstream'
    )
  }
  const { data } = (await res.json()) as { data: Operations[Op]['result'] }
  return data
}
