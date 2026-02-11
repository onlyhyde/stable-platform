/**
 * Generate state-specific icons for the wallet extension
 * States: locked (yellow), gray (disconnected), pending (red)
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZES = [16, 32, 48, 128]

// Icon colors for different states
const ICON_COLORS = {
  // Default: Indigo (#4F46E5)
  default: { r: 79, g: 70, b: 229 },
  // Locked: Yellow/Amber (#F59E0B)
  locked: { r: 245, g: 158, b: 11 },
  // Gray/Disconnected (#9CA3AF)
  gray: { r: 156, g: 163, b: 175 },
  // Pending: Red (#EF4444)
  pending: { r: 239, g: 68, b: 68 },
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

/**
 * Calculate CRC32
 */
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Create PNG chunk
 */
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
 * Generate a simple circular icon PNG
 */
function generateIcon(size, color) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(6, 9) // color type (RGBA)
  ihdr.writeUInt8(0, 10) // compression
  ihdr.writeUInt8(0, 11) // filter
  ihdr.writeUInt8(0, 12) // interlace
  const ihdrChunk = createChunk('IHDR', ihdr)

  // Create image data (RGBA)
  const centerX = size / 2
  const centerY = size / 2
  const radius = size / 2 - 1

  // Raw image data with filter byte per row
  const rawData = Buffer.alloc(size * (size * 4 + 1))

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1)
    rawData[rowOffset] = 0 // Filter type: None

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4
      const dx = x - centerX + 0.5
      const dy = y - centerY + 0.5
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= radius) {
        // Inside circle - use the color
        rawData[pixelOffset] = color.r // R
        rawData[pixelOffset + 1] = color.g // G
        rawData[pixelOffset + 2] = color.b // B
        rawData[pixelOffset + 3] = 255 // A (opaque)
      } else if (distance <= radius + 1) {
        // Anti-aliasing edge
        const alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - distance) * 255)))
        rawData[pixelOffset] = color.r
        rawData[pixelOffset + 1] = color.g
        rawData[pixelOffset + 2] = color.b
        rawData[pixelOffset + 3] = alpha
      } else {
        // Outside circle - transparent
        rawData[pixelOffset] = 0
        rawData[pixelOffset + 1] = 0
        rawData[pixelOffset + 2] = 0
        rawData[pixelOffset + 3] = 0
      }
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(rawData, { level: 9 })
  const idatChunk = createChunk('IDAT', compressed)

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

// Main execution
const iconsDir = path.join(__dirname, '..', 'public', 'icons')

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate icons for each state and size
for (const [state, color] of Object.entries(ICON_COLORS)) {
  if (state === 'default') continue // Skip default, already exists

  for (const size of SIZES) {
    const filename = `icon-${size}-${state}.png`
    const filepath = path.join(iconsDir, filename)
    const iconData = generateIcon(size, color)
    fs.writeFileSync(filepath, iconData)
  }
}
