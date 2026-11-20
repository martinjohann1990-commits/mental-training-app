import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { LockGate } from '@/components/lock-gate';
import { AppText, Button, Chip, ChipRow, EmptyState, TextField } from '@/components/ui';
import { allPhotosQuery, deletePhoto, updatePhoto } from '@/db/repo/body';
import { formatDay } from '@/domain/body';
import { confirmAction } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { photoUri } from '@/lib/photo-storage';
import { POSES } from '@/lib/poses';
import { radius, spacing } from '@/theme/colors';

export default function PhotoScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Foto' }} />
      <LockGate scope="photos">
        <PhotoDetail />
      </LockGate>
    </>
  );
}

function PhotoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: photos, updatedAt } = useLiveQuery(allPhotosQuery());
  const photo = photos.find((p) => p.id === id);
  const [note, setNote] = useState<string | null>(null);
  if (!photo) return updatedAt ? <EmptyState icon="image-off-outline" title="Foto nicht gefunden" /> : null;

  const w = Math.min(width - 2 * spacing.lg, 520);
  return (
    <KeyboardScreen>
      <FormScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <AppText variant="heading">{formatDay(photo.day)}</AppText>
      <Image
        source={{ uri: photoUri(photo.uri) }}
        style={{ width: w, height: w * (4 / 3), borderRadius: radius.md, alignSelf: 'center' }}
        contentFit="contain"
        accessibilityLabel="Fortschrittsfoto"
      />
      <ChipRow>
        {POSES.map((p) => (
          <Chip key={p.value} label={p.label} selected={photo.pose === p.value} onPress={() => void updatePhoto(photo.id, { pose: p.value })} />
        ))}
      </ChipRow>
      <TextField
        label="Notiz"
        value={note ?? photo.note}
        onChangeText={setNote}
        onBlur={() => note !== null && void updatePhoto(photo.id, { note: note.trim() })}
        placeholder="z. B. morgens nüchtern"
      />
      <View style={{ marginTop: spacing.md }}>
        <Button
          title="Foto löschen"
          icon="trash-can-outline"
          variant="danger"
          onPress={() =>
            confirmAction('Foto löschen?', 'Das Foto wird endgültig aus der App gelöscht.', 'Löschen', async () => {
              await deletePhoto(photo.id);
              goBack('/body/photos');
            })
          }
        />
      </View>
    </FormScrollView>
      </KeyboardScreen>
  );
}
