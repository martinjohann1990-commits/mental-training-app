import * as ImagePicker from 'expo-image-picker';

import { notify } from './confirm';

export type PickSource = 'camera' | 'library';

/** Öffnet Kamera oder Galerie. Liefert die URIs der gewählten Medien (leer bei Abbruch). */
export async function pickMedia(source: PickSource, opts: { multiple?: boolean; video?: boolean } = {}): Promise<string[]> {
  const mediaTypes: ImagePicker.MediaType[] = opts.video ? ['images', 'videos'] : ['images'];
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify('Kein Kamerazugriff', 'Erlaube Satzwerk den Kamerazugriff in den Android-Einstellungen.');
        return [];
      }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.8 });
      return r.canceled ? [] : r.assets.map((a) => a.uri);
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.8,
      allowsMultipleSelection: !!opts.multiple,
      selectionLimit: opts.multiple ? 6 : 1,
    });
    return r.canceled ? [] : r.assets.map((a) => a.uri);
  } catch (e) {
    notify('Fehler', e instanceof Error ? e.message : 'Medium konnte nicht geöffnet werden.');
    return [];
  }
}
