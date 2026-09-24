// Generates placeholder brand assets (solid botanical fills) so the app
// builds. Replace with your own leaf mark before shipping.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const FOREST = [62, 92, 75, 255]; // #3E5C4B
const PAPER = [247, 244, 236, 255]; // #F7F4EC
const OFFWHITE = [247, 244, 236, 255];
const CLEAR = [0, 0, 0, 0];

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// size, bg colour, optional centred circle colour + radius fraction
function png(size, bg, circle) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const r = circle ? size * circle.radius : 0;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let col = bg;
      if (circle) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) col = circle.color;
      }
      const p = rowStart + 1 + x * 4;
      raw[p] = col[0];
      raw[p + 1] = col[1];
      raw[p + 2] = col[2];
      raw[p + 3] = col[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const write = (name, buf) => {
  writeFileSync(join(outDir, name), buf);
  console.log(`wrote assets/${name} (${buf.length} bytes)`);
};

write("icon.png", png(1024, FOREST, { color: OFFWHITE, radius: 0.28 }));
write("splash.png", png(1024, FOREST, { color: OFFWHITE, radius: 0.16 }));
write("adaptive-icon.png", png(1024, FOREST, { color: OFFWHITE, radius: 0.28 }));
write("icon-leaf-foreground.png", png(1024, CLEAR, { color: OFFWHITE, radius: 0.32 }));
write("widget-preview-tasks.png", png(512, PAPER, { color: FOREST, radius: 0.12 }));
write("widget-preview-boost.png", png(256, PAPER, { color: FOREST, radius: 0.22 }));
