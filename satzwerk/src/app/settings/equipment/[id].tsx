import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { EQUIPMENT_ICONS } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { AppText, Button, Card, Chip, ChipRow, Divider, EmptyState, Icon, SectionHeader, TextField, ToggleRow } from '@/components/ui';
import { createCustomEquipment, customEquipmentQuery, deleteCustomEquipment, parseWeightList, updateCustomEquipment } from '@/db/repo/custom-equipment';
import { allProfilesQuery, deleteProfile, saveProfile } from '@/db/repo/equipment';
import type { EquipmentProfileRow } from '@/db/schema';
import { EQUIPMENT, EQUIPMENT_KEYS, type EquipmentRef, KETTLEBELL_STEPS } from '@/domain/catalog';
import { dumbbellWeights, type EquipmentConfig, normalizeKettlebells, parseEquipmentConfig } from '@/domain/equipment';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { confirmAction } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

function NumberField({
  label,
  value,
  onChange,
  suffix = 'kg',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  const [text, setText] = useState(formatDecimal(value));
  const [lastValue, setLastValue] = useState(value);
  // Externe Wertänderung übernehmen (State-Anpassung während des Renderns statt Effekt).
  if (lastValue !== value) {
    setLastValue(value);
    setText(formatDecimal(value));
  }
  return (
    <View style={{ flex: 1 }}>
      <TextField
        label={`${label} (${suffix})`}
        value={text}
        keyboardType="decimal-pad"
        onChangeText={setText}
        onBlur={() => {
          const n = parseDecimal(text);
          if (n === null) setText(formatDecimal(value));
          else onChange(n);
        }}
      />
    </View>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const c = useColors();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel={`${label} verringern`}
        onPress={() => onChange(Math.max(0, value - 1))}
        style={[styles.stepBtn, { backgroundColor: c.surfaceAlt }]}>
        <Icon name="minus" size={18} />
      </Pressable>
      <AppText style={{ minWidth: 28, textAlign: 'center', fontWeight: '700' }}>{value}</AppText>
      <Pressable
        accessibilityLabel={`${label} erhöhen`}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, { backgroundColor: c.surfaceAlt }]}>
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

function confirmDelete(name: string, onConfirm: () => void) {
  const msg = `Profil „${name}“ wirklich löschen?`;
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(msg)) onConfirm();
    return;
  }
  Alert.alert('Profil löschen', msg, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function EquipmentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profiles, updatedAt } = useLiveQuery(allProfilesQuery());
  const profile = profiles.find((p) => p.id === id);

  if (!profile) {
    return updatedAt ? <EmptyState icon="alert-circle-outline" title="Profil nicht gefunden" /> : null;
  }
  return <ProfileForm key={profile.id} profile={profile} profileCount={profiles.length} otherIds={profiles.filter((p) => p.id !== profile.id).map((p) => p.id)} />;
}

function ProfileForm({
  profile,
  profileCount,
  otherIds,
}: {
  profile: EquipmentProfileRow;
  profileCount: number;
  otherIds: string[];
}) {
  const c = useColors();
  const { activeProfileId, setActiveProfileId } = useSettings();
  const [name, setName] = useState(profile.name);
  const [cfg, setCfg] = useState<EquipmentConfig>(() => parseEquipmentConfig(profile.config));
  const [dirty, setDirty] = useState(false);
  const { data: customItems } = useLiveQuery(customEquipmentQuery());
  const [customEdit, setCustomEdit] = useState<{ id: string | null; name: string; weights: string } | null>(null);

  const update = (patch: Partial<EquipmentConfig>) => {
    setCfg({ ...cfg, ...patch });
    setDirty(true);
  };
  const has = (e: EquipmentRef) => cfg.available.includes(e);
  const toggleEquipment = (e: EquipmentRef, on: boolean) =>
    update({ available: on ? [...cfg.available, e] : cfg.available.filter((x) => x !== e) });

  const dbWeights = dumbbellWeights(cfg.dumbbells);
  const isActive = profile.id === activeProfileId;

  return (
    <KeyboardScreen>
      <FormScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: profile.name }} />
      <TextField
        label="Profilname"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setDirty(true);
        }}
        maxLength={40}
      />

      <SectionHeader>Verfügbare Geräte</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        {EQUIPMENT_KEYS.filter((e) => e !== 'bodyweight').map((e, i) => (
          <View key={e}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name={EQUIPMENT_ICONS[e]} color={has(e) ? c.accent : c.textMuted} />
              <View style={{ flex: 1 }}>
                <ToggleRow label={EQUIPMENT[e]} value={has(e)} onChange={(v) => toggleEquipment(e, v)} />
              </View>
            </View>
          </View>
        ))}
      </Card>
      <AppText variant="caption" muted>
        Körpergewicht ist immer verfügbar.
      </AppText>

      <SectionHeader action={<Button title="Gerät" icon="plus" variant="ghost" small onPress={() => setCustomEdit({ id: null, name: '', weights: '' })} />}>
        Eigene Geräte
      </SectionHeader>
      <Card style={{ paddingVertical: customItems.length ? spacing.xs : spacing.lg }}>
        {customItems.length === 0 && (
          <AppText muted>z. B. Sandsack, Gymnastikringe, Slam Ball, Steel Mace, Bulgarian Bag – mit eigenen Gewichten.</AppText>
        )}
        {customItems.map((ci, i) => {
          const ref = `custom:${ci.id}` as EquipmentRef;
          return (
            <View key={ci.id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${ci.name} bearbeiten`}
                  hitSlop={6}
                  onPress={() => setCustomEdit({ id: ci.id, name: ci.name, weights: ci.weights.map(formatDecimal).join(' ') })}>
                  <Icon name="pencil-outline" color={c.textMuted} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <ToggleRow
                    label={ci.name}
                    hint={ci.weights.length ? `${ci.weights.map(formatDecimal).join(' · ')} kg` : undefined}
                    value={has(ref)}
                    onChange={(v) => toggleEquipment(ref, v)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </Card>
      {customItems.length > 0 && (
        <AppText variant="caption" muted>
          Eigene Geräte gelten für alle Profile; der Schalter legt fest, ob sie in diesem Profil vorhanden sind.
        </AppText>
      )}

      {has('kettlebell') && (
        <>
          <SectionHeader>Kettlebells</SectionHeader>
          <Card>
            <AppText variant="caption" muted>
              Welche Gewichte besitzt du / stehen zur Verfügung?
            </AppText>
            <ChipRow>
              {KETTLEBELL_STEPS.map((w) => (
                <Chip
                  key={w}
                  label={`${w} kg`}
                  selected={cfg.kettlebells.includes(w)}
                  onPress={() =>
                    update({
                      kettlebells: normalizeKettlebells(
                        cfg.kettlebells.includes(w) ? cfg.kettlebells.filter((x) => x !== w) : [...cfg.kettlebells, w],
                      ),
                    })
                  }
                />
              ))}
            </ChipRow>
          </Card>
        </>
      )}

      {has('dumbbell') && (
        <>
          <SectionHeader>Kurzhanteln</SectionHeader>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <NumberField label="Von" value={cfg.dumbbells.min} onChange={(min) => update({ dumbbells: { ...cfg.dumbbells, min } })} />
              <NumberField label="Bis" value={cfg.dumbbells.max} onChange={(max) => update({ dumbbells: { ...cfg.dumbbells, max } })} />
              <NumberField
                label="Schritt"
                value={cfg.dumbbells.step}
                onChange={(step) => step > 0 && update({ dumbbells: { ...cfg.dumbbells, step } })}
              />
            </View>
            <AppText variant="caption" muted>
              {dbWeights.length > 0
                ? `${dbWeights.length} Gewichte: ${dbWeights.map(formatDecimal).join(' · ')} kg`
                : 'Ungültiger Bereich'}
            </AppText>
          </Card>
        </>
      )}

      {has('barbell') && (
        <>
          <SectionHeader>Langhantel & Scheiben</SectionHeader>
          <Card>
            <NumberField
              label="Stangengewicht"
              value={cfg.barbell.barWeight}
              onChange={(barWeight) => update({ barbell: { ...cfg.barbell, barWeight } })}
            />
            <AppText variant="label" muted style={{ marginTop: spacing.sm }}>
              Scheiben (Paare)
            </AppText>
            {cfg.barbell.plates.map((p, i) => (
              <View key={p.weight} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText style={{ flex: 1 }}>{formatDecimal(p.weight)} kg</AppText>
                <Stepper
                  label={`${formatDecimal(p.weight)}-kg-Scheiben`}
                  value={p.pairs}
                  onChange={(pairs) =>
                    update({
                      barbell: {
                        ...cfg.barbell,
                        plates: cfg.barbell.plates.map((x, j) => (j === i ? { ...x, pairs } : x)),
                      },
                    })
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {has('ez_bar') && (
        <>
          <SectionHeader>SZ-Stange</SectionHeader>
          <Card>
            <NumberField label="Stangengewicht" value={cfg.ezBar.barWeight} onChange={(barWeight) => update({ ezBar: { barWeight } })} />
          </Card>
        </>
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          title="Speichern"
          icon="check"
          disabled={!dirty}
          onPress={async () => {
            await saveProfile(profile.id, name, cfg);
            setDirty(false);
            goBack('/settings/equipment');
          }}
        />
        {!isActive && <Button title="Als aktives Profil verwenden" icon="check-circle-outline" variant="secondary" onPress={() => setActiveProfileId(profile.id)} />}
        {profileCount > 1 && (
          <Button
            title="Profil löschen"
            icon="trash-can-outline"
            variant="danger"
            onPress={() =>
              confirmDelete(profile.name, async () => {
                if (isActive && otherIds[0]) setActiveProfileId(otherIds[0]);
                await deleteProfile(profile.id);
                goBack('/settings/equipment');
              })
            }
          />
        )}
      </View>
        <Sheet visible={!!customEdit} onClose={() => setCustomEdit(null)} title={customEdit?.id ? 'Gerät bearbeiten' : 'Eigenes Gerät'}>
          {customEdit && (
            <View style={{ gap: spacing.md }}>
              <TextField label="Name" value={customEdit.name} onChangeText={(name) => setCustomEdit({ ...customEdit, name })} placeholder="z. B. Sandsack" maxLength={40} autoFocus />
              <TextField
                label="Gewichte in kg (optional)"
                value={customEdit.weights}
                onChangeText={(weights) => setCustomEdit({ ...customEdit, weights })}
                placeholder="z. B. 10 15 20 oder 10; 12,5; 15"
                keyboardType="numbers-and-punctuation"
              />
              <AppText variant="caption" muted>
                Mit Gewichten erscheint beim Loggen eine Auswahl wie bei Kettlebells.
              </AppText>
              <Button
                title="Speichern"
                disabled={!customEdit.name.trim()}
                onPress={async () => {
                  const weights = parseWeightList(customEdit.weights);
                  if (customEdit.id) {
                    await updateCustomEquipment(customEdit.id, customEdit.name, weights);
                  } else {
                    const ref = await createCustomEquipment(customEdit.name, weights);
                    toggleEquipment(ref, true);
                  }
                  setCustomEdit(null);
                }}
              />
              {customEdit.id && (
                <Button
                  title="Gerät löschen"
                  icon="trash-can-outline"
                  variant="danger"
                  onPress={() => {
                    const id = customEdit.id!;
                    const name = customEdit.name;
                    setCustomEdit(null);
                    confirmAction('Gerät löschen?', `„${name}“ wird aus allen Profilen und Übungen entfernt.`, 'Löschen', async () => {
                      await deleteCustomEquipment(id);
                      update({ available: cfg.available.filter((e) => e !== `custom:${id}`) });
                    });
                  }}
                />
              )}
            </View>
          )}
        </Sheet>
      </FormScrollView>
      </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
