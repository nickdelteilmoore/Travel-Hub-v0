// Minimal 8-bit PNG codec for the asset scripts. No dependency: the app ships
// no image library, and pulling one in for two build-time scripts would put a
// native binary in the install path for every contributor.
//
// Handles what the brand assets actually are — 8-bit, non-interlaced — and
// throws on anything else rather than guessing.
import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Decodes a PNG to `{ width, height, channels, px }` of raw 8-bit samples. */
export function decodePng(path) {
  const d = readFileSync(path);
  let pos = 8;
  let header = null;
  const idat = [];
  while (pos < d.length) {
    const len = d.readUInt32BE(pos);
    const type = d.toString("ascii", pos + 4, pos + 8);
    const body = d.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      header = {
        width: d.readUInt32BE(pos + 8),
        height: d.readUInt32BE(pos + 12),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (!header) throw new Error(`${path}: no IHDR`);
  const { width, height, depth, colorType, interlace } = header;
  if (depth !== 8) throw new Error(`${path}: expected 8-bit, got ${depth}`);
  if (interlace) throw new Error(`${path}: interlaced PNGs are not supported`);

  const channels = CHANNELS[colorType];
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p];
    p += 1;
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    // PNG per-scanline reconstruction filters (spec §9.2).
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(px, y * stride);
    prev = line;
  }
  return { width, height, channels, px };
}

/** Encodes raw samples back to a PNG buffer. `channels` is 3 (RGB) or 4 (RGBA). */
export function encodePng({ width, height, channels, px }) {
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Alpha below this counts as background — the brand assets have keyed edges. */
export const ALPHA_FLOOR = 16;

/**
 * Bounding box of the opaque artwork within a keyed image, in source pixels.
 * The brand assets carry uneven transparent padding, so nothing may size them
 * by their canvas (DESIGN.md §2).
 */
export function opaqueBounds({ width, height, channels, px }) {
  if (channels !== 4 && channels !== 2) {
    throw new Error("expected a keyed image — no alpha channel present");
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (px[(y * width + x) * channels + (channels - 1)] < ALPHA_FLOOR) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error("image is fully transparent");
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
