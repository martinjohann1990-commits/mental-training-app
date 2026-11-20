import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Card, Divider, Icon, SectionHeader } from '@/components/ui';
import { allPhotosQuery } from '@/db/repo/body';
import { formatDay, formatMeasure, summarizeFields } from '@/domain/body';
import { useBodyData } from '@/hooks/use-body';
import { photoUri } from '@/lib/photo-storage';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function BodyScreen() {
  const c = useColors();
  const unit = useSettings((s) => s.unit);
  const lockMode = useSettings((s) => s.appLock);
  const { fields, entries } = useBodyData();
  const { data: photos } = useLiveQuery(allPhotosQuery());
  const summaries = summarizeFields(entries, fields.map((f) => f.key));
  const withData = fields.filter((_, i) => summaries[i].count > 0);
  const latestPhoto = photos[0];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Button title="Messung eintragen" icon="tape-measure" onPress={() => router.push('/body/measure')} />

      <SectionHeader>Fototagebuch</SectionHeader>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fototagebuch öffnen"
        onPress={() => router.push('/body/photos')}
        style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        {latestPhoto && lockMode === 'off' ? (
          <Image source={{ uri: photoUri(latestPhoto.uri) }} style={{ width: 56, height: 72, borderRadius: radius.sm }} contentFit="cover" />
        ) : (
          <View style={{ width: 56, height: 72, borderRadius: radius.sm, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={lockMode === 'off' ? 'camera-outline' : 'lock-outline'} color={c.accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: '700' }}>Fortschrittsfotos</AppText>
          <AppText variant="caption" muted>
            {photos.length === 0
              ? 'Noch keine Fotos – starte mit Vorne/Seite/Hinten.'
              : `${photos.length} Fotos · zuletzt ${formatDay(photos[0].day, false)}`}
          </AppText>
        </View>
        <Icon name="chevron-right" color={c.textMuted} />
      </Pressable>

      <SectionHeader>Maße</SectionHeader>
      {withData.length === 0 ? (
        <Card>
          <AppText muted>Noch keine Messungen. Trage dein Gewicht und deine Umfänge ein, um den Verlauf zu sehen.</AppText>
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.xs }}>
          {withData.map((f, i) => {
            const s = summaries[fields.indexOf(f)];
            const change = s.change;
            return (
              <View key={f.key}>
                {i > 0 && <Divider />}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/body/metric/[key]', params: { key: f.key } })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '600' }}>{f.label}</AppText>
                    <AppText variant="caption" muted>
                      {s.latest ? formatDay(s.latest.day, false) : ''}
                      {s.total !== null ? ` · seit Beginn ${s.total > 0 ? '+' : ''}${formatMeasure(s.total, f.unit, unit)}` : ''}
                    </AppText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText variant="heading">{s.latest ? formatMeasure(s.latest.value, f.unit, unit) : '–'}</AppText>
                    {change !== null && change !== 0 && (
                      <AppText variant="caption" muted>
                        {change > 0 ? '▲ +' : '▼ '}
                        {formatMeasure(change, f.unit, unit)}
                      </AppText>
                    )}
                  </View>
                  <Icon name="chevron-right" color={c.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}
