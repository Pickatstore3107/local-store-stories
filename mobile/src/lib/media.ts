import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { LocalFile } from "./stories";

// Getting a post's photos ready on the phone, as the website's
// src/lib/media.ts: cropped four wide by five tall in the middle, and saved
// again as a JPEG, which leaves out everything the camera stored with the
// photo, including where it was taken.

// Must match MAX_PHOTOS in the website's src/lib/server/photos.ts and the photoIds check in firestore.rules.
export const MAX_PHOTOS = 5;
export const POST_FRAME = { width: 1080, height: 1350 };
// Profile photos are square, and shown in a circle.
export const AVATAR_FRAME = { width: 480, height: 480 };

export type Frame = { width: number; height: number };

/** A photo ready to post: the JPEG on the phone, also used as its preview. */
export type ReadyPhoto = LocalFile & { key: string };

/** Crops the middle of a photo to the frame's shape and size, as a JPEG. */
export async function preparePhoto(asset: { uri: string; width: number; height: number }, frame: Frame = POST_FRAME): Promise<ReadyPhoto> {
  const want = frame.width / frame.height;
  const { width, height } = asset;
  const cropWidth = width / height > want ? Math.round(height * want) : width;
  const cropHeight = width / height > want ? height : Math.round(width / want);
  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({ originX: Math.round((width - cropWidth) / 2), originY: Math.round((height - cropHeight) / 2), width: cropWidth, height: cropHeight });
  context.resize({ width: frame.width, height: frame.height });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { key: saved.uri, uri: saved.uri, name: "photo.jpg", type: "image/jpeg" };
}

export type PickResult = { photos: ReadyPhoto[]; extra: boolean } | { denied: true } | null;

/** Lets someone choose photos from their phone, up to `room` of them. Null if they cancel. */
export async function pickPhotos(room: number, frame: Frame = POST_FRAME): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== "limited") return { denied: true };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: room > 1,
    selectionLimit: room,
    orderedSelection: true,
    exif: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const chosen = result.assets.slice(0, room);
  const photos: ReadyPhoto[] = [];
  for (const asset of chosen) photos.push(await preparePhoto(asset, frame));
  return { photos, extra: result.assets.length > room };
}
