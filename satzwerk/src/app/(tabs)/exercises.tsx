import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { exerciseIcon } from '@/components/icons';
import { AppText, Chip, Divider, EmptyState, Icon, ListRow, TextField, ToggleRow } from '@/components/ui';
import { allExercisesQuery } from '@/db/repo/exercises';
import { EQUIPMENT, EQUIPMENT_KEYS, type Equipment, MUSCLE_KEYS, MUSCLES, type Muscle } from '@/domain/catalog';
import { EMPTY_FILTER, filterExercises } from '@/domain/exercise-filter';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function ExercisesScreen() {
  const c = useColors();
  const { data } = useLiveQuery(allExercisesQuery());
  const active = useActiveEquipment();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const list = useMemo(
    () =>
      filterExercises(
        data,
        { ...EMPTY_FILTER, query: deferredQuery, muscle, equipment, onlyAvailable },
        active?.config ?? null,
      ),
    [data, deferredQuery, muscle, equipment, onlyAvailable, active],
  );

  return (
    <>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96 }}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <TextField
              placeholder="Übung suchen …"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              accessibilityLabel="Übung suchen"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              <Chip label="Alle Muskeln" selected={!muscle} onPress={() => setMuscle(null)} />
              {MUSCLE_KEYS.map((m) => (
                <Chip key={m} label={MUSCLES[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              <Chip label="Alle Geräte" selected={!equipment} onPress={() => setEquipment(null)} />
              {EQUIPMENT_KEYS.map((e) => (
                <Chip
                  key={e}
                  label={EQUIPMENT[e]}
                  selected={equipment === e}
                  onPress={() => setEquipment(equipment === e ? null : e)}
                />
              ))}
            </ScrollView>
            <ToggleRow
              label="Nur mit meinem Equipment"
              hint={active ? `Profil: ${active.name}` : undefined}
              value={onlyAvailable}
              onChange={setOnlyAvailable}
            />
            <AppText variant="caption" muted>
              {list.length} {list.length === 1 ? 'Übung' : 'Übungen'}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="magnify" title="Keine Übung gefunden" text="Passe die Filter an oder lege eine eigene Übung an." />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={[MUSCLES[item.primaryMuscle], item.isCustom ? 'Eigene' : null, item.complexParts ? 'Komplex' : null]
              .filter(Boolean)
              .join(' · ')}
            icon={exerciseIcon(item.primaryMuscle, item.equipment)}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
          />
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Eigene Übung anlegen"
        onPress={() => router.push('/exercise/edit')}
        style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="plus" size={28} color={c.onAccent} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  hscroll: { gap: spacing.sm, paddingRight: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
