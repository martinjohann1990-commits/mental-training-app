import { Platform, Share } from 'react-native';

import { notify } from './confirm';

/** Teilt Text über das System-Menü (dort auch „Kopieren“). Auf dem Web: Zwischenablage. */
export async function shareText(text: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      notify('Kopiert', 'Der Text liegt in der Zwischenablage.');
    } catch {
      notify('Nicht möglich', 'Bitte den Text im Feld markieren und kopieren.');
    }
    return;
  }
  try {
    await Share.share({ message: text, title });
  } catch {
    notify('Nicht möglich', 'Teilen ist fehlgeschlagen. Markiere den Text im Feld und kopiere ihn.');
  }
}
