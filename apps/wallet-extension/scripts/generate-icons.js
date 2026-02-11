/**
 * Generate StableNet Wallet icons
 * Design: Shield with "S" letter representing stability and security
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZES = [16, 32, 48, 128]

// Icon colors for different states
const ICON_COLORS = {
  default: { primary: { r: 79, g: 70, b: 229 }, secondary: { r: 99, g: 102, b: 241 } }, // Indigo
  locked: { primary: { r: 245, g: 158, b: 11 }, secondary: { r: 251, g: 191, b: 36 } }, // Amber
  gray: { primary: { r: 107, g: 114, b: 128 }, secondary: { r: 156, g: 163, b: 175 } }, // Gray
  pending: { primary: { r: 239, g: 68, b: 68 }, secondary: { r: 248, g: 113, b: 113 } }, // Red
}

/**
 * CRC32 table for PNG
 */
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crcData = Buffer.concat([typeBytes, data])
  const crcValue = crc32(crcData)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crcValue)
  return Buffer.concat([length, typeBytes, data, crc])
}

/**
 * Check if point is inside a rounded rectangle
 */
function _isInRoundedRect(x, y, rx, ry, rw, rh, radius, size) {
  const scale = size / 128
  rx *= scale
  ry *= scale
  rw *= scale
  rh *= scale
  radius *= scale

  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false

  // Check corners
  const corners = [
    { cx: rx + radius, cy: ry + radius },
    { cx: rx + rw - radius, cy: ry + radius },
    { cx: rx + radius, cy: ry + rh - radius },
    { cx: rx + rw - radius, cy: ry + rh - radius },
  ]

  for (const corner of corners) {
    const dx = x - corner.cx
    const dy = y - corner.cy
    const inCornerArea =
      (x < rx + radius || x > rx + rw - radius) && (y < ry + radius || y > ry + rh - radius)
    if (inCornerArea && dx * dx + dy * dy > radius * radius) {
      return false
    }
  }
  return true
}

/**
 * Check if point is inside the shield shape
 */
function isInShield(x, y, size) {
  const scale = size / 128
  const centerX = size / 2

  // Shield dimensions (scaled from 128x128 base)
  const topY = 12 * scale
  const bottomY = 116 * scale
  const maxWidth = 96 * scale
  const cornerRadius = 12 * scale

  // Shield has rounded top and comes to a point at bottom
  const shieldHeight = bottomY - topY
  const progress = (y - topY) / shieldHeight

  if (y < topY || y > bottomY) return false

  let halfWidth
  if (progress < 0.6) {
    // Top portion - consistent width with rounded corners
    halfWidth = maxWidth / 2

    // Round top corners
    if (y < topY + cornerRadius) {
      const cornerCenterY = topY + cornerRadius
      const _cornerCenterX = centerX - halfWidth + cornerRadius
      const dx = Math.abs(x - centerX)
      if (dx > halfWidth - cornerRadius) {
        const cornerDx = dx - (halfWidth - cornerRadius)
        const cornerDy = cornerCenterY - y
        if (cornerDx * cornerDx + cornerDy * cornerDy > cornerRadius * cornerRadius) {
          return false
        }
      }
    }
  } else {
    // Bottom portion - tapers to point
    const taperProgress = (progress - 0.6) / 0.4
    halfWidth = (maxWidth / 2) * (1 - taperProgress * 0.85)
  }

  return Math.abs(x - centerX) <= halfWidth
}

/**
 * Draw the "S" letter path
 */
function isInSLetter(x, y, size) {
  const scale = size / 128
  const centerX = size / 2

  // S letter parameters (scaled)
  const letterTop = 28 * scale
  const letterBottom = 100 * scale
  const letterWidth = 48 * scale
  const strokeWidth = Math.max(2, 12 * scale)
  const halfStroke = strokeWidth / 2

  // S is made of two arcs connected
  const letterHeight = letterBottom - letterTop
  const arcHeight = letterHeight / 2
  const arcRadius = arcHeight / 2

  // Top arc center
  const topArcCenterX = centerX + letterWidth / 4
  const topArcCenterY = letterTop + arcRadius

  // Bottom arc center
  const bottomArcCenterX = centerX - letterWidth / 4
  const bottomArcCenterY = letterBottom - arcRadius

  // Check if point is on the S stroke
  // Top horizontal part
  if (y >= letterTop - halfStroke && y <= letterTop + halfStroke) {
    if (x >= centerX - letterWidth / 3 && x <= centerX + letterWidth / 2) {
      return true
    }
  }

  // Top arc (right side, going down)
  const topDx = x - topArcCenterX
  const topDy = y - topArcCenterY
  const topDist = Math.sqrt(topDx * topDx + topDy * topDy)
  if (topDist >= arcRadius - halfStroke && topDist <= arcRadius + halfStroke) {
    if (x >= topArcCenterX - arcRadius * 0.3 && y >= letterTop && y <= letterTop + arcHeight) {
      return true
    }
  }

  // Middle horizontal connector
  const middleY = letterTop + arcHeight
  if (y >= middleY - halfStroke && y <= middleY + halfStroke) {
    if (x >= centerX - letterWidth / 3 && x <= centerX + letterWidth / 3) {
      return true
    }
  }

  // Bottom arc (left side, going down)
  const bottomDx = x - bottomArcCenterX
  const bottomDy = y - bottomArcCenterY
  const bottomDist = Math.sqrt(bottomDx * bottomDx + bottomDy * bottomDy)
  if (bottomDist >= arcRadius - halfStroke && bottomDist <= arcRadius + halfStroke) {
    if (x <= bottomArcCenterX + arcRadius * 0.3 && y >= middleY && y <= letterBottom) {
      return true
    }
  }

  // Bottom horizontal part
  if (y >= letterBottom - halfStroke && y <= letterBottom + halfStroke) {
    if (x >= centerX - letterWidth / 2 && x <= centerX + letterWidth / 3) {
      return true
    }
  }

  return false
}

/**
 * Generate StableNet icon
 */
function generateIcon(size, colors) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8)
  ihdr.writeUInt8(6, 9)
  ihdr.writeUInt8(0, 10)
  ihdr.writeUInt8(0, 11)
  ihdr.writeUInt8(0, 12)
  const ihdrChunk = createChunk('IHDR', ihdr)

  const rawData = Buffer.alloc(size * (size * 4 + 1))
  const { primary, secondary } = colors

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1)
    rawData[rowOffset] = 0

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4

      const inShield = isInShield(x + 0.5, y + 0.5, size)
      const inS = isInSLetter(x + 0.5, y + 0.5, size)

      if (inS && inShield) {
        // White S letter
        rawData[pixelOffset] = 255
        rawData[pixelOffset + 1] = 255
        rawData[pixelOffset + 2] = 255
        rawData[pixelOffset + 3] = 255
      } else if (inShield) {
        // Gradient from top (secondary) to bottom (primary)
        const gradientProgress = y / size
        const r = Math.round(secondary.r + (primary.r - secondary.r) * gradientProgress)
        const g = Math.round(secondary.g + (primary.g - secondary.g) * gradientProgress)
        const b = Math.round(secondary.b + (primary.b - secondary.b) * gradientProgress)
        rawData[pixelOffset] = r
        rawData[pixelOffset + 1] = g
        rawData[pixelOffset + 2] = b
        rawData[pixelOffset + 3] = 255
      } else {
        // Transparent
        rawData[pixelOffset] = 0
        rawData[pixelOffset + 1] = 0
        rawData[pixelOffset + 2] = 0
        rawData[pixelOffset + 3] = 0
      }
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 })
  const idatChunk = createChunk('IDAT', compressed)
  const iendChunk = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

// Main execution
const iconsDir = path.join(__dirname, '..', 'public', 'icons')

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate all icons
for (const [state, colors] of Object.entries(ICON_COLORS)) {
  for (const size of SIZES) {
    const suffix = state === 'default' ? '' : `-${state}`
    const filename = `icon-${size}${suffix}.png`
    const filepath = path.join(iconsDir, filename)
    const iconData = generateIcon(size, colors)
    fs.writeFileSync(filepath, iconData)
  }
}
