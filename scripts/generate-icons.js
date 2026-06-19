/* eslint-disable */
/**
 * Generates placeholder PWA icons for Utility Protocol.
 * Creates simple but recognizable utility/energy-themed icons
 * using only Node.js built-ins (zlib for PNG compression).
 *
 * Design: Dark background (#0a0a0a) with a stylized lightning-bolt
 * motif in a teal accent color.
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BG = [0x0a, 0x0a, 0x0a, 0xff]; // #0a0a0a
const ACCENT = [0x00, 0xd4, 0xaa, 0xff]; // teal/green accent

function createCRC(buf) {
  // CRC-32 for PNG
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(createCRC(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function createPNG(width, height, pixels) {
  const signature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk("IHDR", ihdrData);

  // Raw image data with filter byte per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dst = rowOffset + 1 + x * 4;
      rawData[dst] = pixels[idx];
      rawData[dst + 1] = pixels[idx + 1];
      rawData[dst + 2] = pixels[idx + 2];
      rawData[dst + 3] = pixels[idx + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk("IDAT", compressed);
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * Draw a simple utility/energy icon:
 * - Dark rounded square background
 * - Stylized lightning-bolt shape in teal
 */
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;

  // Corner radius for rounded rect
  const cornerR = size * 0.12;

  function distToRectEdge(px, py) {
    const half = outerR;
    const left = cx - half;
    const right = cx + half;
    const top = cy - half;
    const bottom = cy + half;

    // Inside rect
    if (px >= left + cornerR && px <= right - cornerR && py >= top && py <= bottom) return -1;
    if (py >= top + cornerR && py <= bottom - cornerR && px >= left && px <= right) return -1;

    // Distance from corners
    function dist(x1, y1, x2, y2) {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    const corners = [
      [left + cornerR, top + cornerR],
      [right - cornerR, top + cornerR],
      [left + cornerR, bottom - cornerR],
      [right - cornerR, bottom - cornerR],
    ];

    let minDist = Infinity;
    for (const [cx2, cy2] of corners) {
      minDist = Math.min(minDist, dist(px, py, cx2, cy2) - cornerR);
    }

    // Edges
    if (px >= left && px <= right) {
      minDist = Math.min(minDist, py - top, bottom - py);
    }
    if (py >= top && py <= bottom) {
      minDist = Math.min(minDist, px - left, right - px);
    }

    return minDist;
  }

  // Draw lightning bolt shape inside the rect
  function insideLightning(px, py) {
    // Normalize to center
    const dx = px - cx;
    const dy = py - cy;
    const boltWidth = size * 0.2;

    // Lightning bolt: zigzag vertical path
    const topY = -size * 0.25;
    const midY = 0;
    const bottomY = size * 0.25;
    const leftX = -boltWidth * 0.3;
    const rightX = boltWidth * 0.3;

    function segmentDist(sx, sy, x1, y1, x2, y2) {
      const sdx = x2 - x1;
      const sdy = y2 - y1;
      const lenSq = sdx * sdx + sdy * sdy;
      if (lenSq === 0) return Math.sqrt((sx - x1) ** 2 + (sy - y1) ** 2);

      let t = ((sx - x1) * sdx + (sy - y1) * sdy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * sdx;
      const projY = y1 + t * sdy;
      return Math.sqrt((sx - projX) ** 2 + (sy - projY) ** 2);
    }

    // Top segment from (leftX, topY) to (rightX, midY)
    const seg1 = segmentDist(dx, dy, leftX, topY, rightX, midY);
    // Middle segment
    const seg2 = segmentDist(dx, dy, rightX, midY, rightX * 0.5, midY * 0.1);
    // Bottom segment
    const seg3 = segmentDist(dx, dy, rightX * 0.5, midY * 0.1, leftX, bottomY);
    // Bottom-right segment
    const seg4 = segmentDist(dx, dy, leftX, bottomY, rightX * 0.4, bottomY * 0.3);

    const minSeg = Math.min(seg1, seg2, seg3, seg4);
    return minSeg < boltWidth * 0.25;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const d = distToRectEdge(x, y);

      if (d < 0) {
        // Inside the rounded rect background
        pixels[idx] = BG[0];
        pixels[idx + 1] = BG[1];
        pixels[idx + 2] = BG[2];
        pixels[idx + 3] = BG[3];

        // Draw the accent shape
        if (insideLightning(x, y)) {
          pixels[idx] = ACCENT[0];
          pixels[idx + 1] = ACCENT[1];
          pixels[idx + 2] = ACCENT[2];
          pixels[idx + 3] = ACCENT[3];
        }
      } else if (d < 1.5) {
        // Anti-aliased edge
        const alpha = Math.max(0, 1 - d / 1.5);
        pixels[idx] = BG[0];
        pixels[idx + 1] = BG[1];
        pixels[idx + 2] = BG[2];
        pixels[idx + 3] = Math.round(BG[3] * alpha);
      } else {
        // Transparent outside
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  return pixels;
}

// Generate both sizes
const publicDir = path.join(__dirname, "..", "public");

[192, 512].forEach((size) => {
  const pixels = drawIcon(size);
  const png = createPNG(size, size, pixels);
  const filePath = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.warn(`Created ${filePath} (${png.length} bytes)`);
});
