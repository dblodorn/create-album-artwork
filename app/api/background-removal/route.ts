import { guardBackgroundRemoval, respond } from '@/lib/fal/guard'
import { MAX_INPUT_BYTES, sniffImageType } from '@/lib/fal/image'
import { signJob } from '@/lib/fal/jobToken'
import { MAX_PROMPT_LENGTH, getModel, isModelId } from '@/lib/fal/models'

/*
 * Starts a background-removal run.
 *
 *   POST multipart { image, model, prompt? } → { job }
 *
 * The image goes to fal storage (expiring after an hour) and the run onto
 * fal's queue; the browser polls `/api/background-removal/job` with the
 * signed `job` token. Errors are short codes; causes are logged here only.
 */
export async function POST(request: Request) {
  const guard = await guardBackgroundRemoval(request)
  if (guard instanceof Response) return guard
  const { viewer, fal } = guard

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return respond(400, { error: 'bad_request' })
  }

  const modelId = form.get('model')
  if (!isModelId(modelId)) return respond(400, { error: 'bad_request' })
  const model = getModel(modelId)

  const rawPrompt = form.get('prompt')
  if (rawPrompt !== null && typeof rawPrompt !== 'string') {
    return respond(400, { error: 'bad_request' })
  }
  const prompt = rawPrompt?.trim() || undefined
  if (prompt && (!model.supportsPrompt || prompt.length > MAX_PROMPT_LENGTH)) {
    return respond(400, { error: 'bad_request' })
  }

  const image = form.get('image')
  if (!(image instanceof Blob) || !image.size || image.size > MAX_INPUT_BYTES) {
    return respond(400, { error: 'bad_request' })
  }
  const bytes = new Uint8Array(await image.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type) return respond(400, { error: 'bad_request' })

  try {
    const imageUrl = await fal.storage.upload(new Blob([bytes], { type }), {
      lifecycle: { expiresIn: '1h' },
    })
    const { request_id } = await fal.queue.submit(model.endpoint, {
      input: model.toInput(imageUrl, prompt),
    })
    return respond(200, {
      job: signJob({ endpoint: model.endpoint, requestId: request_id, viewerId: viewer.id }),
    })
  } catch (error) {
    console.error('[background-removal] Submit failed:', error)
    return respond(502, { error: 'upstream' })
  }
}
