import React from 'react'

/** A square broken into pixels: turn a layer into an image. */
export function Rasterize() {
  return (
    <svg height="16" width="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor">
        <rect x="1" y="1" width="4" height="4" />
        <rect x="6" y="1" width="4" height="4" opacity="0.6" />
        <rect x="11" y="1" width="4" height="4" />
        <rect x="1" y="6" width="4" height="4" opacity="0.6" />
        <rect x="6" y="6" width="4" height="4" />
        <rect x="11" y="6" width="4" height="4" opacity="0.6" />
        <rect x="1" y="11" width="4" height="4" />
        <rect x="6" y="11" width="4" height="4" opacity="0.6" />
        <rect x="11" y="11" width="4" height="4" />
      </g>
    </svg>
  )
}
