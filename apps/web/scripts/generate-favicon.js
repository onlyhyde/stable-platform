/**
 * Generate StableNet Web App Favicon
 * Design: Shield with "S" letter representing stability and security
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const _SIZES = [16, 32, 48, 180, 192, 512]

// Brand color - Indigo
const COLORS = {
  primary: { r: 79, g: 70, b: 229 },
  secondary: { r: 99, g: 102, b: 241 },
}

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

function isInShield(x, y, size) {
  const scale = size / 128
  const centerX = size / 2
  const topY = 12 * scale
  const bottomY = 116 * scale
  const maxWidth = 96 * scale
  const cornerRadius = 12 * scale
  const shieldHeight = bottomY - topY
  const progress = (y - topY) / shieldHeight

  if (y < topY || y > bottomY) return false

  let halfWidth
  if (progress < 0.6) {
    halfWidth = maxWidth / 2
    if (y < topY + cornerRadius) {
      const cornerCenterY = topY + cornerRadius
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
    const taperProgress = (progress - 0.6) / 0.4
    halfWidth = (maxWidth / 2) * (1 - taperProgress * 0.85)
  }

  return Math.abs(x - centerX) <= halfWidth
}

function isInSLetter(x, y, size) {
  const scale = size / 128
  const centerX = size / 2
  const letterTop = 28 * scale
  const letterBottom = 100 * scale
  const letterWidth = 48 * scale
  const strokeWidth = Math.max(2, 12 * scale)
  const halfStroke = strokeWidth / 2
  const letterHeight = letterBottom - letterTop
  const arcHeight = letterHeight / 2
  const arcRadius = arcHeight / 2
  const topArcCenterX = centerX + letterWidth / 4
  const topArcCenterY = letterTop + arcRadius
  const bottomArcCenterX = centerX - letterWidth / 4
  const bottomArcCenterY = letterBottom - arcRadius

  if (y >= letterTop - halfStroke && y <= letterTop + halfStroke) {
    if (x >= centerX - letterWidth / 3 && x <= centerX + letterWidth / 2) return true
  }

  const topDx = x - topArcCenterX
  const topDy = y - topArcCenterY
  const topDist = Math.sqrt(topDx * topDx + topDy * topDy)
  if (topDist >= arcRadius - halfStroke && topDist <= arcRadius + halfStroke) {
    if (x >= topArcCenterX - arcRadius * 0.3 && y >= letterTop && y <= letterTop + arcHeight)
      return true
  }

  const middleY = letterTop + arcHeight
  if (y >= middleY - halfStroke && y <= middleY + halfStroke) {
    if (x >= centerX - letterWidth / 3 && x <= centerX + letterWidth / 3) return true
  }

  const bottomDx = x - bottomArcCenterX
  const bottomDy = y - bottomArcCenterY
  const bottomDist = Math.sqrt(bottomDx * bottomDx + bottomDy * bottomDy)
  if (bottomDist >= arcRadius - halfStroke && bottomDist <= arcRadius + halfStroke) {
    if (x <= bottomArcCenterX + arcRadius * 0.3 && y >= middleY && y <= letterBottom) return true
  }

  if (y >= letterBottom - halfStroke && y <= letterBottom + halfStroke) {
    if (x >= centerX - letterWidth / 2 && x <= centerX + letterWidth / 3) return true
  }

  return false
}

function generatePNG(size) {
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
  const { primary, secondary } = COLORS

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1)
    rawData[rowOffset] = 0

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4
      const inShield = isInShield(x + 0.5, y + 0.5, size)
      const inS = isInSLetter(x + 0.5, y + 0.5, size)

      if (inS && inShield) {
        rawData[pixelOffset] = 255
        rawData[pixelOffset + 1] = 255
        rawData[pixelOffset + 2] = 255
        rawData[pixelOffset + 3] = 255
      } else if (inShield) {
        const gradientProgress = y / size
        const r = Math.round(secondary.r + (primary.r - secondary.r) * gradientProgress)
        const g = Math.round(secondary.g + (primary.g - secondary.g) * gradientProgress)
        const b = Math.round(secondary.b + (primary.b - secondary.b) * gradientProgress)
        rawData[pixelOffset] = r
        rawData[pixelOffset + 1] = g
        rawData[pixelOffset + 2] = b
        rawData[pixelOffset + 3] = 255
      } else {
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

/**
 * Generate ICO file from PNG data
 */
function generateICO(sizes) {
  const images = sizes.map((size) => {
    const png = generatePNG(size)
    return { size, data: png }
  })

  // ICO header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type (1 = ICO)
  header.writeUInt16LE(images.length, 4) // Number of images

  // Directory entries
  const directories = []
  let offset = 6 + images.length * 16

  for (const img of images) {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, 0) // Width
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, 1) // Height
    dir.writeUInt8(0, 2) // Color palette
    dir.writeUInt8(0, 3) // Reserved
    dir.writeUInt16LE(1, 4) // Color planes
    dir.writeUInt16LE(32, 6) // Bits per pixel
    dir.writeUInt32LE(img.data.length, 8) // Image size
    dir.writeUInt32LE(offset, 12) // Image offset
    directories.push(dir)
    offset += img.data.length
  }

  return Buffer.concat([header, ...directories, ...images.map((i) => i.data)])
}

// Generate SVG for scalable contexts
function generateSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#4F46E5"/>
    </linearGradient>
  </defs>
  <path d="M16 12 C16 12 16 12 16 12 L112 12 C118 12 112 12 112 18 L112 76 C112 76 112 82 108 88 L64 116 L20 88 C16 82 16 76 16 76 L16 18 C16 12 16 12 16 12 Z" fill="url(#shieldGradient)"/>
  <path d="M48 28 L80 28 A18 18 0 0 1 80 64 L48 64 A18 18 0 0 0 48 100 L80 100" stroke="white" stroke-width="12" stroke-linecap="round" fill="none"/>
</svg>`
}

// Main execution
const publicDir = path.join(__dirname, '..', 'public')

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Generate favicon.ico (16x16, 32x32)
const icoData = generateICO([16, 32])
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoData)

// Generate PNG files
const pngSizes = {
  16: 'favicon-16x16.png',
  32: 'favicon-32x32.png',
  180: 'apple-touch-icon.png',
  192: 'icon-192.png',
  512: 'icon-512.png',
}
for (const [size, filename] of Object.entries(pngSizes)) {
  const png = generatePNG(Number.parseInt(size, 10))
  fs.writeFileSync(path.join(publicDir, filename), png)
}

// Generate SVG
fs.writeFileSync(path.join(publicDir, 'icon.svg'), generateSVG())
