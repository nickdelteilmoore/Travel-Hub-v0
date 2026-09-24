// Generates the launcher icons from assets/Lead-Icon-Transparent.png — the
// keyed leaf mark, and the single source for both (DESIGN.md).
// Run after replacing that file: `npm run gen:appicon`.
//
//   icon.png                  1024² opaque, leaf on Cream Linen. Expo's `icon`,
//                             and Android's legacy launcher icon. Opaque on
//                             purpose: a keyed PNG here renders the leaf on
//                             whatever the launcher puts behind it, which on
//                             most is black.
//   icon-leaf-foreground.png  1024² keyed, for the Android adaptive icon over
//                             a Cream Linen background layer.
//
// The output geometry deliberately matches what these two assets already
// carried — this makes the named file the source, it does not restyle the mark.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodePng, encodePng, opaqueBounds } from "./lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CREAM = [245, 243, 237]; // Cream Linen #F5F3ED — the adaptive ground too.
const SIZE = 1024;

/**
 * Longest side of the leaf as a fraction of the canvas.
 *
 * The adaptive foreground sits smaller because Android only guarantees the
 * central 66 of 108 units survives the launcher's mask (0.611): 0.58 keeps the
 * mark inside that circle whatever shape the device crops to. The legacy icon
 * has no mask, so it takes the fuller 0.69.
 */
const INK = { legacy: 0.694, adaptive: 0.584 };

/**
 * Draws the source artwork centred in a `SIZE` square at `inkScale`.
 *
 * Downsampling is a box filter over the source rect each destination pixel
 * covers. The leaf is thin monoline at 2048px and nearest-neighbour would break
 * its strokes up; averaging the whole footprint keeps them continuous.
 *
 * `background` null keys the output; otherwise the artwork is composited onto
 * that colour and the result is opaque RGB.
 */
function render(src, box, inkScale, background) {
  const channels = background ? 3 : 4;
  const out = Buffer.alloc(SIZE * SIZE * channels);

  const ink = SIZE * inkScale;
  const scale = ink / Math.max(box.width, box.height); // dest px per source px
  const drawWidth = box.width * scale;
  const drawHeight = box.height * scale;
  const originX = (SIZE - drawWidth) / 2;
  const originY = (SIZE - drawHeight) / 2;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      // Source rect this destination pixel covers, clamped to the artwork box.
      const sx0 = box.x + (x - originX) / scale;
      const sx1 = box.x + (x + 1 - originX) / scale;
      const sy0 = box.y + (y - originY) / scale;
      const sy1 = box.y + (y + 1 - originY) / scale;

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = Math.max(box.y, Math.floor(sy0)); sy < Math.min(box.y + box.height, Math.ceil(sy1)); sy += 1) {
        for (let sx = Math.max(box.x, Math.floor(sx0)); sx < Math.min(box.x + box.width, Math.ceil(sx1)); sx += 1) {
          const i = (sy * src.width + sx) * src.channels;
          const alpha = src.px[i + 3] / 255;
          // Premultiplied, so a transparent pixel's arbitrary RGB cannot bleed
          // colour into the average along the keyed edge.
          r += src.px[i] * alpha;
          g += src.px[i + 1] * alpha;
          b += src.px[i + 2] * alpha;
          a += alpha;
          n += 1;
        }
      }

      const p = (y * SIZE + x) * channels;
      if (n === 0 || a === 0) {
        if (background) {
          out[p] = background[0];
          out[p + 1] = background[1];
          out[p + 2] = background[2];
        }
        continue;
      }

      const alpha = a / n;
      // Un-premultiply back to straight alpha for the output pixel.
      const cr = r / a;
      const cg = g / a;
      const cb = b / a;

      if (background) {
        out[p] = Math.round(cr * alpha + background[0] * (1 - alpha));
        out[p + 1] = Math.round(cg * alpha + background[1] * (1 - alpha));
        out[p + 2] = Math.round(cb * alpha + background[2] * (1 - alpha));
      } else {
        out[p] = Math.round(cr);
        out[p + 1] = Math.round(cg);
        out[p + 2] = Math.round(cb);
        out[p + 3] = Math.round(alpha * 255);
      }
    }
  }

  return { width: SIZE, height: SIZE, channels, px: out };
}

const sourcePath = join(root, "assets", "Lead-Icon-Transparent.png");
const source = decodePng(sourcePath);
if (source.channels !== 4) {
  throw new Error(
    `${sourcePath} has no alpha channel — the adaptive foreground needs keyed ` +
      `artwork. Re-export it with a transparent background.`,
  );
}
const box = opaqueBounds(source);

for (const [name, inkScale, background] of [
  ["icon.png", INK.legacy, CREAM],
  ["icon-leaf-foreground.png", INK.adaptive, null],
]) {
  const buf = encodePng(render(source, box, inkScale, background));
  writeFileSync(join(root, "assets", name), buf);
  console.log(
    `wrote assets/${name} — ${SIZE}², leaf at ${inkScale} of the canvas ` +
      `(${(buf.length / 1024).toFixed(0)}KB)`,
  );
}
