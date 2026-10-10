import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME,
  clampCrop,
  cropLimits,
  NO_CROP,
  prepareVideo,
  turnRight,
  UnreadableVideoError,
} from "../src/lib/media";

describe("cropping a photo", () => {
  it("fills the frame with a wide photo, which can then move sideways only", () => {
    const limits = cropLimits(4000, 3000, NO_CROP);
    expect(limits.scale).toBeCloseTo(0.45);
    expect(limits.x).toBeCloseTo(1 / 3);
    expect(limits.y).toBe(0);
  });

  it("swaps width and height once the photo is turned", () => {
    const limits = cropLimits(4000, 3000, { ...NO_CROP, rotation: 90 });
    expect(limits.scale).toBeCloseTo(0.36);
    expect(limits.x).toBe(0);
    expect(limits.y).toBeCloseTo(1 / 30);
  });

  it("keeps the photo filling the frame and the zoom in range", () => {
    expect(clampCrop(4000, 3000, { rotation: 0, zoom: 1, x: 2, y: -1 })).toEqual({
      rotation: 0,
      zoom: 1,
      x: cropLimits(4000, 3000, NO_CROP).x,
      y: 0,
    });
    expect(clampCrop(4000, 3000, { ...NO_CROP, zoom: 9 }).zoom).toBe(3);
    expect(clampCrop(4000, 3000, { ...NO_CROP, zoom: 0.2 }).zoom).toBe(1);
    expect(clampCrop(4000, 3000, { ...NO_CROP, zoom: Number.NaN }).zoom).toBe(1);
    const zoomed = clampCrop(1080, 1350, { rotation: 0, zoom: 2, x: -0.4, y: 0.4 });
    expect(zoomed.x).toBeCloseTo(-0.4);
    expect(zoomed.y).toBeCloseTo(0.4);
    expect(clampCrop(1080, 1350, { rotation: 0, zoom: 2, x: -0.9, y: 0.9 })).toEqual({
      rotation: 0,
      zoom: 2,
      x: -0.5,
      y: 0.5,
    });
  });

  it("crops a square profile photo with its own limits", () => {
    // A wide photo has less room to move sideways in a square frame than in a tall one.
    const square = clampCrop(4000, 3000, { ...NO_CROP, x: 2 }, AVATAR_FRAME);
    expect(square.x).toBeCloseTo(cropLimits(4000, 3000, NO_CROP, 480, 480).x);
    expect(square.x).toBeCloseTo(1 / 6);
    expect(clampCrop(4000, 3000, { ...NO_CROP, x: 2 }).x).toBeCloseTo(1 / 3);
    expect(clampCrop(3000, 4000, { ...NO_CROP, y: -2 }, AVATAR_FRAME).y).toBeCloseTo(-1 / 6);
  });

  it("turns a quarter at a time, back to the middle", () => {
    let crop = { rotation: 0, zoom: 2, x: 0.2, y: 0.1 } as const;
    const turns = [];
    for (let i = 0; i < 4; i++) {
      const next = turnRight(crop);
      turns.push(next.rotation);
      expect(next).toMatchObject({ zoom: 2, x: 0, y: 0 });
      crop = next as never;
    }
    expect(turns).toEqual([90, 180, 270, 0]);
  });
});

// A tiny MP4: a row of boxes, each its size, its four-letter type, then its contents.
function box(type: string, ...contents: Uint8Array[]) {
  const size = 8 + contents.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  let at = 8;
  for (const part of contents) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const text = (value: string) => new TextEncoder().encode(value);

function mvhd(version: 0 | 1, timescale: number, duration: number) {
  const body = new Uint8Array(version === 1 ? 108 : 96);
  const view = new DataView(body.buffer);
  view.setUint8(0, version);
  if (version === 1) {
    view.setUint32(20, timescale);
    view.setBigUint64(24, BigInt(duration));
  } else {
    view.setUint32(12, timescale);
    view.setUint32(16, duration);
  }
  return box("mvhd", body);
}

const PLACE = "+17.3850+078.4867/";
const XMP = new Uint8Array([0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8]);
const PICTURES = text("pictures and sound go here");

function video(header = mvhd(0, 600, 600 * 12), mdat = box("mdat", PICTURES)) {
  return new Blob([
    box("ftyp", text("isom"), new Uint8Array(4), text("isommp42")),
    box(
      "moov",
      header,
      box("udta", box("©xyz", text(PLACE))),
      box("trak", box("tkhd", new Uint8Array(84)), box("udta", text(PLACE)), box("mdia", new Uint8Array(8))),
      box("meta", text(`com.apple.quicktime.location.ISO6709${PLACE}`)),
    ),
    mdat,
    box("uuid", XMP, text(`<xmp>${PLACE}</xmp>`)),
  ], { type: "video/mp4" });
}

/** The types of a run of boxes. */
function types(bytes: Uint8Array, from = 0, to = bytes.length) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const found: string[] = [];
  for (let at = from; at < to; ) {
    const size = view.getUint32(at);
    found.push(String.fromCharCode(...bytes.slice(at + 4, at + 8)));
    at += size;
  }
  return found;
}

describe("getting a video ready", () => {
  it("blanks every box that can hold the place, and keeps the rest exactly", async () => {
    const before = video();
    const { video: after, duration } = await prepareVideo(before);
    expect(duration).toBe(12);
    expect(after.size).toBe(before.size);
    expect(after.type).toBe("video/mp4");

    const bytes = new Uint8Array(await after.arrayBuffer());
    expect(types(bytes)).toEqual(["ftyp", "moov", "mdat", "free"]);
    const ftyp = new DataView(bytes.buffer).getUint32(0);
    const moovSize = new DataView(bytes.buffer).getUint32(ftyp);
    expect(types(bytes, ftyp + 8, ftyp + moovSize)).toEqual(["mvhd", "free", "trak", "free"]);
    const trak = ftyp + 8 + 8 + 96 + (8 + 8 + PLACE.length);
    const trakSize = new DataView(bytes.buffer).getUint32(trak);
    expect(types(bytes, trak + 8, trak + trakSize)).toEqual(["tkhd", "free", "mdia"]);

    const words = new TextDecoder().decode(bytes);
    expect(words).not.toContain(PLACE);
    expect(words).not.toContain("location");
    expect(words).toContain("pictures and sound go here");
    expect(words).toContain("isommp42");
  });

  it("reads the length from a newer movie header, and a very large picture box", async () => {
    const large = new Uint8Array(16 + PICTURES.length);
    const view = new DataView(large.buffer);
    view.setUint32(0, 1);
    large.set(text("mdat"), 4);
    view.setBigUint64(8, BigInt(large.length));
    large.set(PICTURES, 16);
    const { duration } = await prepareVideo(video(mvhd(1, 90000, 90000 * 45.5), large));
    expect(duration).toBe(45.5);
  });

  it("gives no length when the movie header is missing", async () => {
    const { duration } = await prepareVideo(video(box("free", new Uint8Array(4))));
    expect(duration).toBeNull();
  });

  it("refuses anything that isn't an MP4 or MOV video", async () => {
    const refused = (blob: Blob) => expect(prepareVideo(blob)).rejects.toBeInstanceOf(UnreadableVideoError);
    await refused(new Blob([text("not a video at all, just some words")]));
    await refused(new Blob([]));
    await refused(new Blob([box("ftyp", text("isom")), box("mdat", PICTURES)]));
    await refused(new Blob([box("ftyp", text("isom")), box("moov", mvhd(0, 600, 600))]));
    const whole = new Uint8Array(await video().arrayBuffer());
    await refused(new Blob([whole.slice(0, whole.length - 3)]));
    const broken = whole.slice();
    new DataView(broken.buffer).setUint32(new DataView(broken.buffer).getUint32(0) + 8, 4);
    await refused(new Blob([broken]));
  });
});
