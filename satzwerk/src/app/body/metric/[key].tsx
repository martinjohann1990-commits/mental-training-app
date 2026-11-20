import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { LineChart, StatTile } from '@/components/charts';
import { AppText, Button, Card, Divider, EmptyState, Icon } from '@/components/ui';
import { deleteCustomField, deleteMeasurement } from '@/db/repo/body';
import { dayToTime, formatDay, formatMeasure, summarizeFields, toDisplayMeasure } from '@/domain/body';
import { useBodyData } from '@/hooks/use-body';
import { confirmAction } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function MetricScreen() {
  const c = useColors();
  const { key } = useLocalSearchParams<{ key: string }>();
  const unit = useSettings((s) => s.unit);
  const { fields, entries, loaded } = useBodyData();
  const field = fields.find((f) => f.key === key);
  if (!loaded) return null;
  if (!field) return <EmptyState icon="alert-circle-outline" title="Maß nicht gefunden" />;

  const list = entries.filter((e) => e.key === key).sort((a, b) => a.day.localeCompare(b.day));
  const [s] = summarizeFields(entries, [field.key]);
  const fmt = (v: number) => formatMeasure(v, field.unit, unit);
  const signed = (v: number | null) => (v === null ? null : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatMeasure(Math.abs(v), field.unit, unit)}`);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: field.label }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile label="Aktuell" value={s.latest ? fmt(s.latest.value) : '–'} sub={s.latest ? formatDay(s.latest.day, false) : null} />
        <StatTile label="Seit Beginn" value={signed(s.total) ?? '–'} sub={s.first ? `seit ${formatDay(s.first.day, false)}` : null} />
      </View>

      {list.length >= 2 && (
        <Card>
          <LineChart
            accessibilityLabel={`${field.label} über ${list.length} Messungen`}
            points={list.map((e) => ({ x: dayToTime(e.day), y: toDisplayMeasure(e.value, field.unit, 'kg') }))}
            formatY={(v) => fmt(v)}
            formatX={(x) => new Date(x).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
          />
        </Card>
      )}

      <Card style={{ paddingVertical: spacing.xs }}>
        {list.length === 0 && <AppText muted style={{ paddingVertical: spacing.md }}>Noch keine Werte.</AppText>}
        {[...list].reverse().map((e, i, arr) => {
          const prev = arr[i + 1];
          return (
            <View key={e.id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Messung vom ${formatDay(e.day)} bearbeiten`}
                  onPress={() => router.push({ pathname: '/body/measure', params: { day: e.day } })}
                  style={{ flex: 1 }}>
                  <AppText>{formatDay(e.day)}</AppText>
                  {prev && (
                    <AppText variant="caption" muted>
                      {signed(Math.round((e.value - prev.value) * 100) / 100)}
                    </AppText>
                  )}
                </Pressable>
                <AppText style={{ fontWeight: '700' }}>{fmt(e.value)}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Messung vom ${formatDay(e.day)} löschen`}
                  hitSlop={8}
                  onPress={() => confirmAction('Wert löschen?', `${field.label} vom ${formatDay(e.day)}`, 'Löschen', () => void deleteMeasurement(e.id))}>
                  <Icon name="trash-can-outline" size={20} color={c.textMuted} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      {field.custom && (
        <Button
          title="Eigenes Maß entfernen"
          icon="trash-can-outline"
          variant="danger"
          onPress={() =>
            confirmAction('Maß entfernen?', `„${field.label}“ und alle Werte werden gelöscht.`, 'Entfernen', async () => {
              await deleteCustomField(field.key.replace('custom:', ''));
              goBack('/body');
            })
          }
        />
      )}
    </ScrollView>
  );
}
