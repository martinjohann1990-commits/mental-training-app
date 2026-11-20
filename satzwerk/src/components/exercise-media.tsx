import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { setExerciseMedia } from '@/db/repo/exercises';
import { confirmAction, notify } from '@/lib/confirm';
import { isVideo, openInSystemViewer, photoUri, storePhoto } from '@/lib/photo-storage';
import { pickMedia, type PickSource } from '@/lib/pick-photo';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { Sheet, SheetItem } from './sheet';
import { AppText, Button, Card, Icon } from './ui';

/** Eigenes Foto oder Video zu einer Übung (z. B. Ausführung, Geräteeinstellung). */
export function ExerciseMedia({ exerciseId, mediaUri }: { exerciseId: string; mediaUri: string | null }) {
  const c = useColors();
  const [picking, setPicking] = useState(false);

  async function add(source: PickSource) {
    setPicking(false);
    const [uri] = await pickMedia(source, { video: true });
    if (!uri) return;
    await setExerciseMedia(exerciseId, await storePhoto(uri, 'ex_'));
  }

  return (
    <Card>
      <AppText variant="label" muted>
        Eigenes Foto / Video
      </AppText>
      {mediaUri ? (
        isVideo(mediaUri) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Video abspielen"
            onPress={async () => {
              if (!(await openInSystemViewer(mediaUri))) notify('Nicht möglich', 'Das Video konnte nicht geöffnet werden.');
            }}
            style={{ height: 160, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Icon name="play-circle-outline" size={48} color={c.accent} />
            <AppText muted>Video abspielen</AppText>
          </Pressable>
        ) : (
          <Image source={{ uri: photoUri(mediaUri) }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Eigenes Übungsfoto" />
        )
      ) : (
        <AppText muted>Halte z. B. deine Sitzeinstellung oder die Ausführung fest.</AppText>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title={mediaUri ? 'Ersetzen' : 'Hinzufügen'} icon="camera-plus-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => setPicking(true)} />
        {mediaUri && (
          <Button
            title="Entfernen"
            icon="trash-can-outline"
            variant="danger"
            small
            onPress={() => confirmAction('Medium entfernen?', 'Das Foto/Video wird aus der App gelöscht.', 'Entfernen', () => void setExerciseMedia(exerciseId, null))}
          />
        )}
      </View>
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Foto / Video">
        <SheetItem icon="camera-outline" label="Mit Kamera aufnehmen" onPress={() => void add('camera')} />
        <SheetItem icon="image-outline" label="Aus Galerie wählen" onPress={() => void add('library')} />
      </Sheet>
    </Card>
  );
}
