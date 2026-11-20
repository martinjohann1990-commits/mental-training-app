import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { type GestureResponderEvent, ScrollView, useWindowDimensions, View } from 'react-native';

import { LockGate } from '@/components/lock-gate';
import { AppText, Card, Chip, ChipRow, EmptyState, Segmented, SectionHeader } from '@/components/ui';
import { allPhotosQuery } from '@/db/repo/body';
import type { PhotoPose, ProgressPhotoRow } from '@/db/schema';
import { formatDay, formatMeasure, valueOnOrBefore } from '@/domain/body';
import { useBodyData } from '@/hooks/use-body';
import { photoUri } from '@/lib/photo-storage';
import { POSES } from '@/lib/poses';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function CompareScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Vorher / Nachher' }} />
      <LockGate scope="photos">
        <Compare />
      </LockGate>
    </>
  );
}

/** Überblend-Vergleich: links „Vorher“, rechts „Nachher“, Trennlinie per Finger verschiebbar. */
function SliderCompare({ before, after, size }: { before: string; after: string; size: { w: number; h: number } }) {
  const c = useColors();
  const [pos, setPos] = useState(0.5);
  const move = (e: GestureResponderEvent) => setPos(Math.min(1, Math.max(0, e.nativeEvent.locationX / size.w)));
  return (
    <View
      style={{ width: size.w, height: size.h, borderRadius: radius.md, overflow: 'hidden', alignSelf: 'center' }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Vergleichsregler"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pos * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => setPos((p) => Math.min(1, Math.max(0, p + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={move}
      onResponderMove={move}>
      <Image source={{ uri: after }} style={{ position: 'absolute', width: size.w, height: size.h }} contentFit="cover" pointerEvents="none" />
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pos * size.w, overflow: 'hidden' }} pointerEvents="none">
        <Image source={{ uri: before }} style={{ width: size.w, height: size.h }} contentFit="cover" />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: pos * size.w - 1, width: 2, backgroundColor: c.accent }} />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: size.h / 2 - 18, left: pos * size.w - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent }}
      />
      <AppText pointerEvents="none" variant="caption" style={{ position: 'absolute', left: 8, top: 8, color: '#fff', fontWeight: '800' }}>
        Vorher
      </AppText>
      <AppText pointerEvents="none" variant="caption" style={{ position: 'absolute', right: 8, top: 8, color: '#fff', fontWeight: '800' }}>
        Nachher
      </AppText>
    </View>
  );
}

function Compare() {
  const { width } = useWindowDimensions();
  const unit = useSettings((s) => s.unit);
  const { data: photos } = useLiveQuery(allPhotosQuery());
  const { entries } = useBodyData();
  const [pose, setPose] = useState<PhotoPose>('front');
  const [mode, setMode] = useState<'side' | 'slider'>('side');
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  const ofPose = useMemo(() => [...photos].filter((p) => p.pose === pose).sort((a, b) => a.day.localeCompare(b.day)), [photos, pose]);
  const before = ofPose.find((p) => p.id === beforeId) ?? ofPose[0];
  const after = ofPose.find((p) => p.id === afterId) ?? ofPose[ofPose.length - 1];
  const posesWithPhotos = POSES.filter((p) => photos.some((x) => x.pose === p.value));

  const label = (p: ProgressPhotoRow | undefined) => {
    if (!p) return '';
    const w = valueOnOrBefore(entries, 'weight', p.day);
    return `${formatDay(p.day, false)}${w ? ` · ${formatMeasure(w.value, 'kg', unit)}` : ''}`;
  };
  const full = Math.min(width - 2 * spacing.lg, 520);
  const half = (full - spacing.sm) / 2;

  if (photos.length === 0) return <EmptyState icon="compare" title="Noch keine Fotos" />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <ChipRow>
        {(posesWithPhotos.length ? posesWithPhotos : POSES).map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={pose === p.value}
            onPress={() => {
              setPose(p.value);
              setBeforeId(null);
              setAfterId(null);
            }}
          />
        ))}
      </ChipRow>
      <Segmented
        options={[
          { value: 'side', label: 'Nebeneinander' },
          { value: 'slider', label: 'Schieberegler' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {!before || !after ? (
        <AppText muted>Für diese Pose gibt es noch keine Fotos.</AppText>
      ) : mode === 'side' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'center' }}>
          {[before, after].map((p, i) => (
            <View key={`${p.id}-${i}`} style={{ gap: 4 }}>
              <Image source={{ uri: photoUri(p.uri) }} style={{ width: half, height: half * (4 / 3), borderRadius: radius.md }} contentFit="cover" />
              <AppText variant="caption" muted style={{ textAlign: 'center' }}>
                {i === 0 ? 'Vorher' : 'Nachher'} · {label(p)}
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <>
          <SliderCompare before={photoUri(before.uri)} after={photoUri(after.uri)} size={{ w: full, h: full * (4 / 3) }} />
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            {label(before)} → {label(after)}
          </AppText>
        </>
      )}

      {ofPose.length > 1 && (
        <>
          <SectionHeader>Vorher</SectionHeader>
          <ChipRow>
            {ofPose.map((p) => (
              <Chip key={p.id} label={formatDay(p.day, false)} selected={before?.id === p.id} onPress={() => setBeforeId(p.id)} />
            ))}
          </ChipRow>
          <SectionHeader>Nachher</SectionHeader>
          <ChipRow>
            {ofPose.map((p) => (
              <Chip key={p.id} label={formatDay(p.day, false)} selected={after?.id === p.id} onPress={() => setAfterId(p.id)} />
            ))}
          </ChipRow>
        </>
      )}
      {ofPose.length === 1 && (
        <Card>
          <AppText muted>Sobald du ein zweites Foto mit dieser Pose hast, kannst du Vorher und Nachher frei wählen.</AppText>
        </Card>
      )}
    </ScrollView>
  );
}
