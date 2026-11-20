import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { AppText, Button, Card, Divider, Icon, Segmented, SectionHeader, TextField } from '@/components/ui';
import { createCustomField, saveMeasurements } from '@/db/repo/body';
import { dayKey, dayToTime, displayUnit, formatDay, fromDisplayMeasure, type MeasureUnit, toDisplayMeasure, valueOnOrBefore } from '@/domain/body';
import { useBodyData } from '@/hooks/use-body';
import { goBack } from '@/lib/navigation';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function MeasureScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const { fields, entries, loaded } = useBodyData();
  const [day, setDay] = useState(() => params.day ?? dayKey(Date.now()));
  if (!loaded) return null;
  // Formular pro Tag neu aufbauen, damit die Werte des gewählten Tages vorbelegt sind.
  return <MeasureForm key={`${day}-${fields.length}`} day={day} setDay={setDay} fields={fields} entries={entries} />;
}

function MeasureForm({
  day,
  setDay,
  fields,
  entries,
}: {
  day: string;
  setDay: (d: string) => void;
  fields: ReturnType<typeof useBodyData>['fields'];
  entries: ReturnType<typeof useBodyData>['entries'];
}) {
  const c = useColors();
  const unit = useSettings((s) => s.unit);
  const [newField, setNewField] = useState<{ name: string; unit: MeasureUnit } | null>(null);
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => {
    const o: Record<string, string> = {};
    for (const f of fields) {
      const e = entries.find((x) => x.day === day && x.key === f.key);
      o[f.key] = e ? formatDecimal(toDisplayMeasure(e.value, f.unit, unit)) : '';
    }
    return o;
  }, [fields, entries, day, unit]);
  const [text, setText] = useState(initial);

  const [today] = useState(() => dayKey(Date.now()));
  const shift = (n: number) => {
    const d = new Date(dayToTime(day));
    d.setDate(d.getDate() + n);
    const k = dayKey(d);
    if (k <= today) setDay(k);
  };

  async function save() {
    const values: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = text[f.key]?.trim() ?? '';
      if (raw === (initial[f.key] ?? '')) continue; // unverändert
      if (raw === '') {
        values[f.key] = null;
        continue;
      }
      const n = parseDecimal(raw);
      if (n === null) continue;
      values[f.key] = fromDisplayMeasure(n, f.unit, unit);
    }
    setSaving(true);
    await saveMeasurements(day, values);
    goBack('/body');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Messung' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Tag" hitSlop={10} onPress={() => shift(-1)}>
            <Icon name="chevron-left" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="heading">{day === today ? 'Heute' : formatDay(day)}</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nächster Tag"
            hitSlop={10}
            disabled={day >= today}
            onPress={() => shift(1)}
            style={{ opacity: day >= today ? 0.3 : 1 }}>
            <Icon name="chevron-right" />
          </Pressable>
        </Card>
        <AppText variant="caption" muted>
          Nur ausgefüllte Felder werden gespeichert. Ein geleertes Feld löscht den Wert dieses Tages.
        </AppText>

        <Card style={{ paddingVertical: spacing.xs }}>
          {fields.map((f, i) => {
            const last = valueOnOrBefore(entries.filter((e) => e.day !== day), f.key, day);
            return (
              <View key={f.key}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '600' }}>{f.label}</AppText>
                    {last && (
                      <AppText variant="caption" muted>
                        Zuletzt {formatDecimal(toDisplayMeasure(last.value, f.unit, unit))} {displayUnit(f.unit, unit)}
                      </AppText>
                    )}
                  </View>
                  <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        accessibilityLabel={f.label}
                        value={text[f.key] ?? ''}
                        keyboardType="decimal-pad"
                        placeholder={last ? formatDecimal(toDisplayMeasure(last.value, f.unit, unit)) : '–'}
                        onChangeText={(t) => setText((s) => ({ ...s, [f.key]: t }))}
                        style={{ textAlign: 'right' }}
                      />
                    </View>
                    <AppText muted style={{ width: 26 }}>
                      {displayUnit(f.unit, unit)}
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        <Button title="Eigenes Maß hinzufügen" icon="plus" variant="secondary" small onPress={() => setNewField({ name: '', unit: 'cm' })} />
        <SectionHeader> </SectionHeader>
        <Button title={saving ? 'Speichern …' : 'Speichern'} icon="check" disabled={saving} onPress={() => void save()} />
        <Button title="Abbrechen" variant="ghost" onPress={() => router.back()} />
      </ScrollView>

      <Sheet visible={!!newField} onClose={() => setNewField(null)} title="Eigenes Maß">
        {newField && (
          <View style={{ gap: spacing.md }}>
            <TextField label="Name" value={newField.name} onChangeText={(name) => setNewField({ ...newField, name })} placeholder="z. B. Unterarm, Bauch (Nabelhöhe)" autoFocus />
            <Segmented
              options={[
                { value: 'cm', label: 'cm' },
                { value: 'kg', label: 'kg' },
                { value: '%', label: '%' },
                { value: '', label: 'ohne' },
              ]}
              value={newField.unit}
              onChange={(u) => setNewField({ ...newField, unit: u })}
            />
            <Button
              title="Hinzufügen"
              disabled={!newField.name.trim()}
              onPress={async () => {
                await createCustomField(newField.name, newField.unit);
                setNewField(null);
              }}
            />
            <AppText variant="caption" style={{ color: c.textMuted }}>
              Eigene Maße erscheinen danach in jeder Messung.
            </AppText>
          </View>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
