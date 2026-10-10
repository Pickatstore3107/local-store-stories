// Getting a post's photos or video ready on the phone, before they're
// uploaded. Plain browser code: no Firebase here.

// Must match MAX_PHOTOS in src/lib/server/photos.ts and the photoIds check in firestore.rules.
export const MAX_PHOTOS = 5;

// A post's photos are four wide by five tall, like Instagram's.
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1350;
export const MAX_ZOOM = 3;

// Only a video's first 30 seconds are shown (src/lib/server/photos.ts).
export const VIDEO_SECONDS = 30;
// Cloudinary's free plan takes videos up to 100 MB.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
// MP4 and MOV, as phones record them. Must match VIDEO_FORMATS in src/lib/server/photos.ts.
export const VIDEO_TYPES = "video/mp4,video/quicktime,video/x-m4v,video/3gpp";

export type Rotation = 0 | 90 | 180 | 270;

/**
 * How a photo sits in its frame: turned, zoomed in (1 fills the frame), and
 * moved off centre by a share of the frame's width (x) and height (y).
 */
export type Crop = { rotation: Rotation; zoom: number; x: number; y: number };

export const NO_CROP: Crop = { rotation: 0, zoom: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How big the photo is drawn, and how far it can move each way while still filling the frame. */
export function cropLimits(
  width: number,
  height: number,
  crop: Crop,
  frameWidth = PHOTO_WIDTH,
  frameHeight = PHOTO_HEIGHT,
) {
  const sideways = crop.rotation % 180 !== 0;
  const w = sideways ? height : width;
  const h = sideways ? width : height;
  const scale = Math.max(frameWidth / w, frameHeight / h) * crop.zoom;
  return {
    scale,
    x: Math.max(0, (w * scale - frameWidth) / 2 / frameWidth),
    y: Math.max(0, (h * scale - frameHeight) / 2 / frameHeight),
  };
}

/** Keeps the zoom in range and the photo filling the frame. */
export function clampCrop(width: number, height: number, crop: Crop): Crop {
  const zoom = clamp(Number.isFinite(crop.zoom) ? crop.zoom : 1, 1, MAX_ZOOM);
  const limits = cropLimits(width, height, { ...crop, zoom });
  return {
    rotation: crop.rotation,
    zoom,
    // "|| 0" turns -0 into 0.
    x: clamp(crop.x, -limits.x, limits.x) || 0,
    y: clamp(crop.y, -limits.y, limits.y) || 0,
  };
}

/** Turns the photo a quarter to the right, back in the middle of the frame. */
export function turnRight(crop: Crop): Crop {
  return { rotation: ((crop.rotation + 90) % 360) as Rotation, zoom: crop.zoom, x: 0, y: 0 };
}

type Drawable = CanvasImageSource & { width: number; height: number };

/** Draws the photo into a frame of any size, as the crop says. */
export function drawCrop(
  context: CanvasRenderingContext2D,
  image: Drawable,
  crop: Crop,
  frameWidth: number,
  frameHeight: number,
) {
  const { scale } = cropLimits(image.width, image.height, crop, frameWidth, frameHeight);
  context.fillStyle = "#ffffff"; // transparent PNGs get a white background
  context.fillRect(0, 0, frameWidth, frameHeight);
  context.save();
  context.translate(frameWidth * (0.5 + crop.x), frameHeight * (0.5 + crop.y));
  context.rotate((crop.rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, -image.width / 2, -image.height / 2);
  context.restore();
}

export class UnreadablePhotoError extends Error {}

/** Opens a photo the right way up, as the camera took it. */
export async function openPhoto(file: Blob) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadablePhotoError(file.type);
  }
}

/**
 * The cropped photo as a JPEG for upload. Drawing to a canvas drops all of
 * the original's metadata, including any GPS location the camera saved.
 */
export function cropPhoto(image: Drawable, crop: Crop) {
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  drawCrop(context, image, clampCrop(image.width, image.height, crop), PHOTO_WIDTH, PHOTO_HEIGHT);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))),
      "image/jpeg",
      0.85,
    ),
  );
}

// Videos: MP4 and MOV files are a row of boxes, each starting with its size
// and a four-letter type. Phones put the place a video was taken in a few
// of them; those are blanked out and renamed "free", which every player
// skips. Nothing moves, so the video plays exactly as before.

export class UnreadableVideoError extends Error {}

type Box = { type: string; start: number; end: number; header: number };

const MOOV_MAX_BYTES = 32 * 1024 * 1024;

const typeAt = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

/** The box starting at "at" within "view", or null if it doesn't fit. */
function boxAt(view: DataView, at: number, end: number): Box | null {
  if (at + 8 > end) return null;
  let size = view.getUint32(at);
  let header = 8;
  if (size === 1) {
    if (at + 16 > end) return null;
    size = Number(view.getBigUint64(at + 8));
    header = 16;
  } else if (size === 0) {
    size = end - at; // to the end of the file
  }
  if (size < header || at + size > end) return null;
  return { type: typeAt(view, at + 4), start: at, end: at + size, header };
}

/** The boxes inside a box, from its bytes. Null if they don't add up. */
function children(view: DataView, from: number, to: number) {
  const boxes: Box[] = [];
  for (let at = from; at < to; ) {
    const box = boxAt(view, at, to);
    if (!box) return null;
    boxes.push(box);
    at = box.end;
  }
  return boxes;
}

// Where phones and editing apps keep the place, the date and the device.
const METADATA = new Set(["udta", "meta", "uuid"]);
const FREE = [0x66, 0x72, 0x65, 0x65]; // "free"

function blank(bytes: Uint8Array, box: Box) {
  bytes.set(FREE, box.start + 4);
  bytes.fill(0, box.start + box.header, box.end);
}

/** The video's length in seconds, from the movie header, or null if it can't be read. */
function readDuration(view: DataView, mvhd: Box) {
  const at = mvhd.start + mvhd.header;
  if (at + 32 > mvhd.end) return null;
  const version = view.getUint8(at);
  const timescale = view.getUint32(version === 1 ? at + 20 : at + 12);
  const duration =
    version === 1 ? Number(view.getBigUint64(at + 24)) : view.getUint32(at + 16);
  return timescale > 0 ? duration / timescale : null;
}

/**
 * Returns the video without the boxes that can hold where and when it was
 * taken, and its length in seconds (null when unknown). Throws
 * UnreadableVideoError for anything that isn't an MP4 or MOV file.
 */
export async function prepareVideo(file: Blob) {
  // The top-level boxes, reading only their headers.
  const top: Box[] = [];
  for (let at = 0; at < file.size; ) {
    const head = new DataView(await file.slice(at, at + 16).arrayBuffer());
    if (head.byteLength < 8) throw new UnreadableVideoError();
    const raw = head.getUint32(0);
    const header = raw === 1 ? 16 : 8;
    if (head.byteLength < header) throw new UnreadableVideoError();
    const size = raw === 0 ? file.size - at : raw === 1 ? Number(head.getBigUint64(8)) : raw;
    if (size < header || at + size > file.size) throw new UnreadableVideoError();
    top.push({ type: typeAt(head, 4), start: at, end: at + size, header });
    at += size;
  }
  const moov = top.find((box) => box.type === "moov");
  if (!moov || !top.some((box) => box.type === "mdat") || moov.end - moov.start > MOOV_MAX_BYTES) {
    throw new UnreadableVideoError();
  }

  const bytes = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const inMoov = children(view, moov.header, bytes.length);
  if (!inMoov) throw new UnreadableVideoError();
  let duration: number | null = null;
  for (const box of inMoov) {
    if (METADATA.has(box.type)) blank(bytes, box);
    if (box.type === "mvhd") duration = readDuration(view, box);
    if (box.type === "trak") {
      for (const inner of children(view, box.start + box.header, box.end) ?? []) {
        if (METADATA.has(inner.type)) blank(bytes, inner);
      }
    }
  }

  // Top-level boxes outside the movie can hold the same, so they go too.
  const parts: BlobPart[] = [];
  let from = 0;
  for (const box of top) {
    if (box === moov) {
      parts.push(file.slice(from, box.start), bytes);
      from = box.end;
    } else if (METADATA.has(box.type)) {
      parts.push(
        file.slice(from, box.start + 4),
        new Uint8Array(FREE),
        file.slice(box.start + 8, box.start + box.header), // a large box's 64-bit size
        new Uint8Array(box.end - box.start - box.header),
      );
      from = box.end;
    }
  }
  parts.push(file.slice(from));
  return { video: new Blob(parts, { type: file.type || "video/mp4" }), duration };
}
