import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { LockGate } from '@/components/lock-gate';
import { Sheet, SheetItem } from '@/components/sheet';
import { AppText, Button, Card, Chip, ChipRow, EmptyState } from '@/components/ui';
import { addPhoto, allPhotosQuery } from '@/db/repo/body';
import type { PhotoPose } from '@/db/schema';
import { dayKey, formatDay, formatMeasure, valueOnOrBefore } from '@/domain/body';
import { useBodyData } from '@/hooks/use-body';
import { photoUri, storePhoto } from '@/lib/photo-storage';
import { pickMedia, type PickSource } from '@/lib/pick-photo';
import { POSES } from '@/lib/poses';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';

export default function PhotosScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Fototagebuch' }} />
      <LockGate scope="photos">
        <PhotoTimeline />
      </LockGate>
    </>
  );
}

function PhotoTimeline() {
  const unit = useSettings((s) => s.unit);
  const { data: photos } = useLiveQuery(allPhotosQuery());
  const { entries } = useBodyData();
  const [adding, setAdding] = useState(false);
  const [pose, setPose] = useState<PhotoPose>('front');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const m = new Map<string, typeof photos>();
    for (const p of photos) m.set(p.day, [...(m.get(p.day) ?? []), p]);
    return [...m.entries()];
  }, [photos]);

  async function add(source: PickSource) {
    setAdding(false);
    const uris = await pickMedia(source, { multiple: source === 'library' });
    if (uris.length === 0) return;
    setBusy(true);
    try {
      const today = dayKey(Date.now());
      for (const uri of uris) await addPhoto(today, pose, await storePhoto(uri));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title={busy ? 'Speichern …' : 'Fotos hinzufügen'} icon="camera-plus-outline" style={{ flex: 1 }} disabled={busy} onPress={() => setAdding(true)} />
        <Button title="Vergleichen" icon="compare" variant="secondary" disabled={days.length < 1} onPress={() => router.push('/body/compare')} />
      </View>
      <AppText variant="caption" muted>
        Fotos bleiben privat in der App – sie erscheinen nicht in deiner Galerie.
      </AppText>

      {days.length === 0 && (
        <EmptyState icon="camera-outline" title="Noch keine Fotos" text="Tipp: Gleiches Licht, gleiche Pose, gleiche Tageszeit – dann sieht man Fortschritt am besten." />
      )}

      {days.map(([day, list]) => {
        const weight = valueOnOrBefore(entries, 'weight', day);
        return (
          <Card key={day}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText style={{ fontWeight: '700' }}>{formatDay(day)}</AppText>
              {weight && (
                <AppText muted>
                  {formatMeasure(weight.value, 'kg', unit)}
                  {weight.day !== day ? '*' : ''}
                </AppText>
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {list.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Foto ${POSES.find((x) => x.value === p.pose)?.label} vom ${formatDay(day)}`}
                  onPress={() => router.push({ pathname: '/body/photo/[id]', params: { id: p.id } })}>
                  <Image source={{ uri: photoUri(p.uri) }} style={{ width: 96, height: 128, borderRadius: radius.sm }} contentFit="cover" />
                  <AppText variant="caption" muted style={{ textAlign: 'center' }}>
                    {POSES.find((x) => x.value === p.pose)?.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {weight && weight.day !== day && (
              <AppText variant="caption" muted>
                * letztes Gewicht vor diesem Tag ({formatDay(weight.day, false)})
              </AppText>
            )}
          </Card>
        );
      })}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Foto hinzufügen">
        <AppText variant="label" muted style={{ marginBottom: spacing.sm }}>
          Pose
        </AppText>
        <ChipRow>
          {POSES.map((p) => (
            <Chip key={p.value} label={p.label} selected={pose === p.value} onPress={() => setPose(p.value)} />
          ))}
        </ChipRow>
        <View style={{ height: spacing.md }} />
        <SheetItem icon="camera-outline" label="Foto aufnehmen" onPress={() => void add('camera')} />
        <SheetItem icon="image-multiple-outline" label="Aus Galerie wählen" hint="Mehrere möglich – alle mit dieser Pose, Datum heute" onPress={() => void add('library')} />
      </Sheet>
    </ScrollView>
  );
}
