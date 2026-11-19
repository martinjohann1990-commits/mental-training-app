import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { allExercisesQuery } from '@/db/repo/exercises';
import { MUSCLES } from '@/domain/catalog';
import { EMPTY_FILTER, filterExercises } from '@/domain/exercise-filter';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { exerciseIcon } from './icons';
import { AppText, Button, Divider, ListRow, TextField } from './ui';

/** Modal zur Auswahl einer Übung (z. B. für Komplexe; später auch für Routinen). */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  excludeIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  excludeIds?: string[];
}) {
  const c = useColors();
  const { data } = useLiveQuery(allExercisesQuery());
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => filterExercises(data.filter((e) => !excludeIds.includes(e.id)), { ...EMPTY_FILTER, query }, null),
    [data, query, excludeIds],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Übung auswählen
          </AppText>
          <Button title="Schließen" variant="ghost" small onPress={onClose} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TextField placeholder="Suchen …" value={query} onChangeText={setQuery} autoFocus accessibilityLabel="Übung suchen" />
        </View>
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 48 }}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={MUSCLES[item.primaryMuscle]}
              icon={exerciseIcon(item.primaryMuscle, item.equipment)}
              right={<View />}
              onPress={() => {
                onPick(item.id);
                setQuery('');
              }}
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
