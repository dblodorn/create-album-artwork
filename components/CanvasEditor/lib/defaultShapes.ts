import { ARTBOARD } from './constants'

export const STROKE = '#000000'
export const FILL = 'rgba(255, 255, 255, 0.0)'

export const CIRCLE = {
  radius: 100,
  left: ARTBOARD / 2 - 100,
  top: ARTBOARD / 2 - 100,
  fill: FILL,
  stroke: STROKE,
}

export const RECTANGLE = {
  left: ARTBOARD / 2 - 100,
  top: ARTBOARD / 2 - 100,
  fill: FILL,
  stroke: STROKE,
  width: 200,
  height: 200,
  angle: 0,
}

export const LINE = {
  points: [250, 500, 750, 500] as [number, number, number, number],
  options: {
    stroke: STROKE,
    strokeWidth: 4,
  },
}

export const TEXT = {
  width: 600,
  left: (ARTBOARD - 600) / 2,
  top: ARTBOARD / 2 - 40,
  fontSize: 64,
  textAlign: 'center' as const,
  fontFamily: 'Arial',
  fill: STROKE,
}
