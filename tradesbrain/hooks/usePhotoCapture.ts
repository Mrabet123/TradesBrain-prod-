// D6 Flow04 + D6 Flow12 RULE 5 — Photo capture for Rex session.
// Stage-aware compression per D4 §3.3 (60/50/40 quality buckets) PLUS a
// silent recompression pass when the picked photo's base64 exceeds the
// 8 MB cap. Worker is never alerted — the photo just gets smaller.
//
// Permission denial returns null cleanly so the caller can show the amber
// "camera/library denied" banner without crashing (D6 Flow12 S1/S2).

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getCompressionSettings } from '../utils/imageCompression';

export interface CapturedPhoto {
  uri: string;
  base64: string;
  mime: string;
}

export interface CaptureResult {
  photo: CapturedPhoto | null;
  /** When the picker was cancelled or permission was denied, we want the
   *  caller to tell the worker something. denied=true means the caller should
   *  surface the permission banner. */
  denied: boolean;
}

const MAX_BASE64_BYTES = 8 * 1024 * 1024; // 8 MB raw bundle cap

function estimateBytes(base64: string): number {
  return Math.floor(base64.length * 0.75);
}

async function recompressIfTooLarge(
  uri: string,
  base64: string,
  mime: string,
  quality: number,
  maxDimension: number,
): Promise<{ uri: string; base64: string; mime: string }> {
  if (estimateBytes(base64) <= MAX_BASE64_BYTES) {
    return { uri, base64, mime };
  }
  // Resize to maxDimension on the longer side, drop quality to 35%
  // (more aggressive than the stage bucket). Repeat with a smaller dimension
  // if still too big.
  let q = Math.min(quality, 0.35);
  let dim = maxDimension;
  let out = { uri, base64, mime };
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await ImageManipulator.manipulateAsync(
      out.uri,
      [{ resize: { width: dim } }],
      { compress: q, base64: true, format: ImageManipulator.SaveFormat.JPEG },
    );
    out = {
      uri: result.uri,
      base64: result.base64 ?? '',
      mime: 'image/jpeg',
    };
    if (estimateBytes(out.base64) <= MAX_BASE64_BYTES) return out;
    q = Math.max(0.2, q - 0.05);
    dim = Math.max(400, Math.floor(dim * 0.75));
  }
  return out;
}

export function usePhotoCapture() {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const capture = useCallback(
    async (stage: number, fromLibrary = false): Promise<CaptureResult> => {
      const settings = getCompressionSettings(stage);
      const perm = fromLibrary
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        return { photo: null, denied: true };
      }
      setPermissionDenied(false);

      const result = fromLibrary
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: settings.quality,
            base64: true,
            allowsEditing: false,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: settings.quality,
            base64: true,
            allowsEditing: false,
          });

      if (result.canceled || !result.assets?.[0]) {
        return { photo: null, denied: false };
      }
      const a = result.assets[0];
      const mime = a.mimeType ?? 'image/jpeg';

      const compressed = await recompressIfTooLarge(
        a.uri,
        a.base64 ?? '',
        mime,
        settings.quality,
        settings.maxDimension,
      );

      const captured: CapturedPhoto = compressed;
      setPhoto(captured);
      return { photo: captured, denied: false };
    },
    [],
  );

  const clear = useCallback(() => setPhoto(null), []);

  return { photo, capture, clear, permissionDenied };
}
