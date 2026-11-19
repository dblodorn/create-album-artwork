// jsdom has no 2D canvas. Fabric only needs one to exist for these tests
// (object model, stacking, selection), not to paint, so every call is a no-op.
const noop = () => undefined

function stubContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = {
    canvas,
    measureText: (text: string) => ({ width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getTransform: () => new DOMMatrix(),
    getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ setTransform: noop }),
  }
  return new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : noop),
    set: (t, key, value) => {
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    if (!contexts.has(this)) contexts.set(this, stubContext(this))
    return contexts.get(this)!
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,'
}
