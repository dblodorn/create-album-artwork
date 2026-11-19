import { describe, expect, it } from 'vitest'

import { parseResultImage, sniffImageType } from './image'

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (value: string) => new Uint8Array(Buffer.from(value))

describe('sniffImageType', () => {
  it('recognises PNG, JPEG and WebP by their magic bytes', () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array([...text('RIFF'), 0, 0, 0, 0, ...text('WEBP')]))).toBe(
      'image/webp'
    )
  })

  it('rejects anything else', () => {
    expect(sniffImageType(text('GIF89a'))).toBeNull()
    expect(sniffImageType(text('hello world'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})

describe('parseResultImage', () => {
  it('accepts an https fal media URL', () => {
    expect(
      parseResultImage({ image: { url: 'https://v3b.fal.media/x.png', width: 600, height: 400 } })
    ).toEqual({ url: 'https://v3b.fal.media/x.png', width: 600, height: 400 })
  })

  it.each([
    ['another host', 'https://evil.example/x.png'],
    ['plain http', 'http://v3.fal.media/x.png'],
    ['a lookalike host', 'https://fal.media.evil.com/x.png'],
  ])('rejects %s', (_, url) => {
    expect(() => parseResultImage({ image: { url } })).toThrow()
  })

  it('rejects output without an image URL', () => {
    expect(() => parseResultImage({})).toThrow()
    expect(() => parseResultImage(null)).toThrow()
  })
})
