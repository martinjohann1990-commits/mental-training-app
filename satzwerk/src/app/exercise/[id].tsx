import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { ExerciseProgress } from '@/components/exercise-progress';
import { EQUIPMENT_ICONS } from '@/components/icons';
import { AppText, Button, Card, Chip, ChipRow, EmptyState, ListRow, SectionHeader } from '@/components/ui';
import { allExercisesQuery, archiveExercise } from '@/db/repo/exercises';
import { EQUIPMENT, LOGGING_TYPES, MUSCLES } from '@/domain/catalog';
import { canPerform } from '@/domain/equipment';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: all } = useLiveQuery(allExercisesQuery());
  const active = useActiveEquipment();
  const c = useColors();
  const ex = all.find((e) => e.id === id);

  if (!ex) {
    return <EmptyState icon="alert-circle-outline" title="Übung nicht gefunden" />;
  }

  const parts = (ex.complexParts ?? []).map((pid) => all.find((e) => e.id === pid)).filter((e) => !!e);
  const available = active ? canPerform(active.config, ex.equipment) : true;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: ex.isCustom ? 'Eigene Übung' : 'Übung' }} />
      <AppText variant="title">{ex.name}</AppText>

      <Card>
        <AppText variant="label" muted>
          Hauptmuskel
        </AppText>
        <ChipRow>
          <Chip label={MUSCLES[ex.primaryMuscle]} selected />
        </ChipRow>
        {ex.secondaryMuscles.length > 0 && (
          <>
            <AppText variant="label" muted style={{ marginTop: spacing.sm }}>
              Sekundär
            </AppText>
            <ChipRow>
              {ex.secondaryMuscles.map((m) => (
                <Chip key={m} label={MUSCLES[m]} />
              ))}
            </ChipRow>
          </>
        )}
      </Card>

      <Card>
        <AppText variant="label" muted>
          Equipment
        </AppText>
        <ChipRow>
          {ex.equipment.length === 0 ? (
            <Chip label="Körpergewicht" icon="human-handsup" />
          ) : (
            ex.equipment.map((e) => <Chip key={e} label={EQUIPMENT[e]} icon={EQUIPMENT_ICONS[e]} />)
          )}
        </ChipRow>
        {active && (
          <AppText variant="caption" muted={available} style={!available ? { color: c.danger } : undefined}>
            {available ? `✓ Mit Profil „${active.name}“ machbar` : `Mit Profil „${active.name}“ nicht vollständig machbar`}
          </AppText>
        )}
        <AppText variant="label" muted style={{ marginTop: spacing.sm }}>
          Erfassung
        </AppText>
        <AppText>{LOGGING_TYPES[ex.loggingType].label}</AppText>
      </Card>

      {parts.length > 0 && (
        <View>
          <SectionHeader>Bewegungen im Komplex</SectionHeader>
          <Card style={{ paddingVertical: spacing.xs }}>
            {parts.map((p, i) => (
              <ListRow
                key={`${p.id}-${i}`}
                title={`${i + 1}. ${p.name}`}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: p.id } })}
              />
            ))}
          </Card>
        </View>
      )}

      {ex.instructions ? (
        <View>
          <SectionHeader>Ausführung</SectionHeader>
          <Card>
            <AppText>{ex.instructions}</AppText>
          </Card>
        </View>
      ) : null}

      <ExerciseProgress exerciseId={ex.id} loggingType={ex.loggingType} />

      {ex.isCustom && (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title="Bearbeiten"
            icon="pencil"
            variant="secondary"
            onPress={() => router.push({ pathname: '/exercise/edit', params: { id: ex.id } })}
          />
          <Button
            title="Übung löschen"
            icon="trash-can-outline"
            variant="danger"
            onPress={() =>
              confirm('Übung löschen?', `„${ex.name}“ wird aus der Bibliothek entfernt.`, () => {
                void archiveExercise(ex.id).then(() => goBack('/exercises'));
              })
            }
          />
        </View>
      )}
    </ScrollView>
  );
}
