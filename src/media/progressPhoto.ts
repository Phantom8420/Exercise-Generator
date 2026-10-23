import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const MAX_WIDTH = 1080;
const QUALITY = 0.6;

/**
 * Takes or picks a photo, shrinks it to ≤1080 px wide JPEG and stores it in app storage.
 * Returns a URI to keep in the DB, or null when the user cancelled.
 */
export async function captureProgressPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is off. Allow it in system settings, or pick from your gallery.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return null;
  const asset = res.assets[0];

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const img = await ctx.renderAsync();
  // Web has no persistent file system, so the image lives in the DB as a data URI.
  const web = Platform.OS === 'web';
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: web });
  if (web) return `data:image/jpeg;base64,${out.base64}`;

  const dir = new Directory(Paths.document, 'progress');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  await new File(out.uri).move(dest);
  return dest.uri;
}

export function deletePhotoFile(uri: string) {
  if (uri.startsWith('data:')) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone; the DB row is what matters.
  }
}
