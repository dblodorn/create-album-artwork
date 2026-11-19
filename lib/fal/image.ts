import 'server-only'

/** Binary cap for an uploaded layer image, under Vercel's 4.5 MB body limit. */
export const MAX_INPUT_BYTES = 4 * 1024 * 1024

export type InputImageType = 'image/png' | 'image/jpeg' | 'image/webp'

/** The image type from its first bytes; the declared type isn't trusted. */
export function sniffImageType(bytes: Uint8Array): InputImageType | null {
  const at = (offset: number, ...values: number[]) =>
    values.every((value, i) => bytes[offset + i] === value)
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  // RIFF....WEBP
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

export type ResultImage = { url: string; width: number | null; height: number | null }

const isFalMediaHost = (host: string) => host === 'fal.media' || host.endsWith('.fal.media')

/** The cutout from a model's output, or throws if it isn't a fal media URL. */
export function parseResultImage(data: unknown): ResultImage {
  const image = (data as { image?: { url?: unknown; width?: unknown; height?: unknown } })?.image
  if (typeof image?.url !== 'string') throw new Error('Model output has no image URL.')
  const url = new URL(image.url)
  if (url.protocol !== 'https:' || !isFalMediaHost(url.hostname)) {
    throw new Error(`Unexpected result host: ${url.hostname}`)
  }
  return {
    url: url.toString(),
    width: typeof image.width === 'number' ? image.width : null,
    height: typeof image.height === 'number' ? image.height : null,
  }
}
