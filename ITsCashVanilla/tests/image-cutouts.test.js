import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { imageCutouts } from "../shared/data/image-cutouts.js";

// Read PNG alpha without changing or re-encoding the generated assets.
function alphaCounts(png) {
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png[24], 8, "Expected 8-bit channels");
  assert.equal(png[25], 6, "The cutout must have an RGBA alpha channel");
  assert.equal(png[28], 0, "Expected a non-interlaced PNG");
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  let prior = Buffer.alloc(stride), transparent = 0, opaque = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(stride), offset = y * (stride + 1), filter = raw[offset];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0, b = prior[x], c = x >= 4 ? prior[x - 4] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      assert.notEqual(predictor, undefined);
      row[x] = (raw[offset + x + 1] + predictor) & 255;
      if (x % 4 === 3) {
        if (row[x] === 0) transparent++;
        if (row[x] >= 250) opaque++; // Generated cutouts can use 98–100% alpha on fabric.
      }
    }
    prior = row;
  }
  return { transparent, opaque, pixels: width * height };
}

test("all uniform cutouts exist with real transparency and visible fabric; originals remain available", async () => {
  assert.equal(Object.keys(imageCutouts).length, 19); // Two products share the same trousers photo.
  for (const [original, cutout] of Object.entries(imageCutouts)) {
    await access(new URL("../assets/images/" + original, import.meta.url));
    const png = await readFile(new URL("../assets/images/" + cutout, import.meta.url));
    const counts = alphaCounts(png);
    assert.ok(counts.transparent > counts.pixels * .01, `${cutout}: background must be transparent`);
    assert.ok(counts.opaque > counts.pixels * .01, `${cutout}: clothing must remain visible`);
  }
});
