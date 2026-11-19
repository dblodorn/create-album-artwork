import { guardBackgroundRemoval, respond } from '@/lib/fal/guard'
import { parseResultImage } from '@/lib/fal/image'
import { type Job, verifyJob } from '@/lib/fal/jobToken'

/*
 * Follows a run started by `POST /api/background-removal`.
 *
 *   POST   { job } → { status: 'queued' | 'running' } | { status: 'done', image }
 *   DELETE { job } → { ok }  cancel, best effort
 *
 * A token that's forged, expired or someone else's reads as not found.
 */

async function readJob(request: Request, viewerId: string): Promise<Job | null> {
  try {
    const body = (await request.json()) as { job?: unknown } | null
    return verifyJob(body?.job, viewerId)
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const guard = await guardBackgroundRemoval(request)
  if (guard instanceof Response) return guard
  const { viewer, fal } = guard

  const job = await readJob(request, viewer.id)
  if (!job) return respond(404, { error: 'not_found' })

  try {
    const status = await fal.queue.status(job.endpoint, { requestId: job.requestId })
    if (status.status === 'IN_QUEUE') return respond(200, { status: 'queued' })
    if (status.status === 'IN_PROGRESS') return respond(200, { status: 'running' })

    const result = await fal.queue.result(job.endpoint, { requestId: job.requestId })
    return respond(200, { status: 'done', image: parseResultImage(result.data) })
  } catch (error) {
    console.error('[background-removal] Status failed:', error)
    return respond(502, { error: 'upstream' })
  }
}

export async function DELETE(request: Request) {
  const guard = await guardBackgroundRemoval(request)
  if (guard instanceof Response) return guard
  const { viewer, fal } = guard

  const job = await readJob(request, viewer.id)
  if (!job) return respond(404, { error: 'not_found' })

  try {
    await fal.queue.cancel(job.endpoint, { requestId: job.requestId })
  } catch (error) {
    // Already finished or already gone: nothing left to cancel.
    console.warn('[background-removal] Cancel failed:', error)
  }
  return respond(200, { ok: true })
}
