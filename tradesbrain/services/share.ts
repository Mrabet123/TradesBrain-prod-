// services/share.ts — native share sheet for generated PDFs.
// Uses expo-sharing on native (handles file:// URIs on Android), falls back to
// React Native's Share API on iOS when expo-sharing is unavailable.

import { Share, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export async function sharePdf(localUri: string, title = 'Job document'): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
    return;
  }
  if (Platform.OS === 'ios') {
    await Share.share({ url: localUri, title });
  } else {
    await Share.share({ message: localUri, title });
  }
}
